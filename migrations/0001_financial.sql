PRAGMA foreign_keys=ON;
CREATE TABLE principals (
 id TEXT PRIMARY KEY, revision INTEGER NOT NULL DEFAULT 0, active_rules TEXT,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE items (
 principal TEXT NOT NULL REFERENCES principals(id), id TEXT NOT NULL UNIQUE,
 resources TEXT NOT NULL CHECK(json_valid(resources)), enabled INTEGER NOT NULL DEFAULT 1,
 PRIMARY KEY(principal,id)
);
CREATE TABLE rule_sets (
 principal TEXT NOT NULL REFERENCES principals(id), id TEXT NOT NULL, document TEXT NOT NULL CHECK(json_valid(document)),
 normalizer TEXT NOT NULL, created_at TEXT NOT NULL, ready INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(principal,id)
);
CREATE TABLE category_groups (principal TEXT NOT NULL, revision TEXT NOT NULL, id TEXT NOT NULL, name TEXT NOT NULL, PRIMARY KEY(principal,revision,id), FOREIGN KEY(principal,revision) REFERENCES rule_sets(principal,id));
CREATE TABLE categories (principal TEXT NOT NULL, revision TEXT NOT NULL, id TEXT NOT NULL, group_id TEXT NOT NULL, name TEXT NOT NULL, PRIMARY KEY(principal,revision,id), FOREIGN KEY(principal,revision,group_id) REFERENCES category_groups(principal,revision,id));
CREATE TABLE aliases (principal TEXT NOT NULL, revision TEXT NOT NULL, alias TEXT NOT NULL, category_id TEXT NOT NULL, PRIMARY KEY(principal,revision,alias), FOREIGN KEY(principal,revision,category_id) REFERENCES categories(principal,revision,id));
CREATE TABLE rules (principal TEXT NOT NULL, revision TEXT NOT NULL, id TEXT NOT NULL, position INTEGER NOT NULL, priority INTEGER NOT NULL, stage TEXT NOT NULL, active INTEGER NOT NULL, definition TEXT NOT NULL CHECK(json_valid(definition)), PRIMARY KEY(principal,revision,id), FOREIGN KEY(principal,revision) REFERENCES rule_sets(principal,id));
-- One row per source identity. Projected/indexed columns serve SQL queries; raw
-- retains provider fields, not an opaque substitute for relational access.
CREATE TABLE entities (
 principal TEXT NOT NULL, item_id TEXT NOT NULL, resource TEXT NOT NULL, parent_id TEXT NOT NULL DEFAULT '', id TEXT NOT NULL,
 source TEXT NOT NULL CHECK(json_valid(source)), normalized TEXT NOT NULL CHECK(json_valid(normalized)),
 relevant_hash TEXT NOT NULL, normalizer TEXT NOT NULL, source_created_at TEXT, source_updated_at TEXT, first_seen_at TEXT NOT NULL,
 observed_at TEXT NOT NULL, transaction_date TEXT, currency TEXT, amount_minor TEXT, amount_key TEXT, amount_digits TEXT, amount_sign INTEGER,
 account_type TEXT, direction TEXT, status TEXT, original_category TEXT, original_description TEXT,
 eligible INTEGER NOT NULL DEFAULT 0, deleted INTEGER NOT NULL DEFAULT 0, seen_operation TEXT,
 PRIMARY KEY(principal,item_id,resource,parent_id,id), FOREIGN KEY(principal,item_id) REFERENCES items(principal,id)
);
CREATE INDEX entity_date ON entities(principal,resource,transaction_date,id);
CREATE INDEX entity_account ON entities(principal,item_id,resource,parent_id,id);
CREATE INDEX entity_status ON entities(principal,resource,status,id);
CREATE INDEX entity_pending ON entities(principal,item_id,parent_id,id) WHERE resource='transactions' AND status='PENDING' AND deleted=0;
CREATE INDEX entity_future ON entities(principal,transaction_date,id) WHERE eligible=0 AND deleted=0;
CREATE INDEX entity_amount ON entities(principal,resource,currency,amount_key);
CREATE INDEX entity_category ON entities(principal,resource,original_category);
CREATE TABLE derived (
 principal TEXT NOT NULL,item_id TEXT NOT NULL,resource TEXT NOT NULL,parent_id TEXT NOT NULL,id TEXT NOT NULL,
 rules_revision TEXT NOT NULL,category TEXT NOT NULL,category_id TEXT NOT NULL,group_id TEXT NOT NULL,description TEXT NOT NULL,
 ignored INTEGER NOT NULL,evidence TEXT NOT NULL CHECK(json_valid(evidence)),
 PRIMARY KEY(principal,item_id,resource,parent_id,id),
 FOREIGN KEY(principal,item_id,resource,parent_id,id) REFERENCES entities(principal,item_id,resource,parent_id,id),
 FOREIGN KEY(principal,rules_revision) REFERENCES rule_sets(principal,id)
);
CREATE INDEX derived_category ON derived(principal,category_id,group_id,id);
CREATE TABLE overrides (
 principal TEXT NOT NULL,item_id TEXT NOT NULL,resource TEXT NOT NULL,parent_id TEXT NOT NULL,id TEXT NOT NULL,
 field TEXT NOT NULL CHECK(field IN ('category','description','ignored')), value TEXT NOT NULL, updated_at TEXT NOT NULL,
 PRIMARY KEY(principal,item_id,resource,parent_id,id,field),
 FOREIGN KEY(principal,item_id,resource,parent_id,id) REFERENCES entities(principal,item_id,resource,parent_id,id)
);
CREATE TABLE tags (
 principal TEXT NOT NULL,item_id TEXT NOT NULL,resource TEXT NOT NULL,parent_id TEXT NOT NULL,id TEXT NOT NULL,
 key TEXT NOT NULL,value TEXT NOT NULL,origin TEXT NOT NULL CHECK(origin IN ('derived','manual')),
 PRIMARY KEY(principal,item_id,resource,parent_id,id,key,origin),
 FOREIGN KEY(principal,item_id,resource,parent_id,id) REFERENCES entities(principal,item_id,resource,parent_id,id)
);
CREATE INDEX tags_lookup ON tags(principal,key,value,origin,id);
CREATE TABLE operations (
 id TEXT PRIMARY KEY, principal TEXT NOT NULL REFERENCES principals(id), request_key TEXT NOT NULL,
 kind TEXT NOT NULL, input TEXT NOT NULL CHECK(json_valid(input)), input_hash TEXT NOT NULL, rules_revision TEXT NOT NULL,reference_day TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'working',phase TEXT NOT NULL DEFAULT 'queued',cancel_requested INTEGER NOT NULL DEFAULT 0,
 dispatched INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,
 progress TEXT NOT NULL DEFAULT '{}',result TEXT,error TEXT,
 UNIQUE(principal,request_key),FOREIGN KEY(principal,rules_revision) REFERENCES rule_sets(principal,id)
);
CREATE INDEX operations_dispatch ON operations(dispatched,status,created_at);
CREATE INDEX operations_owner ON operations(principal,created_at);
-- Queue ownership never expires by a wall clock while an executor can publish.
CREATE TABLE locks (principal TEXT PRIMARY KEY REFERENCES principals(id),operation_id TEXT NOT NULL UNIQUE REFERENCES operations(id));
CREATE TABLE coverage (
 principal TEXT NOT NULL,item_id TEXT NOT NULL,resource TEXT NOT NULL,parent_id TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL,bootstrap_complete INTEGER NOT NULL DEFAULT 0,confirmed_created_at TEXT,observed_at TEXT,parent_signature TEXT,
 PRIMARY KEY(principal,item_id,resource,parent_id),FOREIGN KEY(principal,item_id) REFERENCES items(principal,id)
);
CREATE TABLE checkpoints (
 operation_id TEXT NOT NULL REFERENCES operations(id),item_id TEXT NOT NULL,resource TEXT NOT NULL,parent_id TEXT NOT NULL DEFAULT '',
 cursor TEXT,creation_floor TEXT,maximum_created_at TEXT,page INTEGER NOT NULL DEFAULT 0,done INTEGER NOT NULL DEFAULT 0,expected_total INTEGER,collected INTEGER NOT NULL DEFAULT 0,
 PRIMARY KEY(operation_id,item_id,resource,parent_id)
);
CREATE TABLE operation_targets (operation_id TEXT NOT NULL REFERENCES operations(id), item_id TEXT NOT NULL, resource TEXT NOT NULL,parent_id TEXT NOT NULL,id TEXT NOT NULL,processed INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(operation_id,item_id,resource,parent_id,id));
CREATE INDEX targets_pending ON operation_targets(operation_id,processed,item_id,parent_id,id);
CREATE TABLE page_commits (operation_id TEXT NOT NULL,step_key TEXT NOT NULL,progress TEXT NOT NULL,PRIMARY KEY(operation_id,step_key));
CREATE TABLE inbox (
 event_id TEXT PRIMARY KEY,principal TEXT NOT NULL,item_id TEXT NOT NULL,account_id TEXT NOT NULL,event TEXT NOT NULL,payload TEXT NOT NULL CHECK(json_valid(payload)),
 received_at TEXT NOT NULL,operation_id TEXT REFERENCES operations(id),processed_at TEXT,
 FOREIGN KEY(principal,item_id) REFERENCES items(principal,id)
);
CREATE INDEX inbox_dispatch ON inbox(operation_id,received_at);
CREATE TABLE migration_imports (principal TEXT NOT NULL,source_key TEXT NOT NULL,source_hash TEXT NOT NULL,imported_at TEXT NOT NULL,PRIMARY KEY(principal,source_key,source_hash));
CREATE VIEW effective_entities AS SELECT e.*,
 COALESCE(json_extract(oc.value,'$.name'),d.category,e.original_category) AS effective_category,
 COALESCE(od.value,d.description,e.original_description) AS effective_description,
 COALESCE(CAST(oi.value AS INTEGER),d.ignored,0) AS ignored,
 COALESCE(json_extract(oc.value,'$.id'),d.category_id) AS category_id,COALESCE(json_extract(oc.value,'$.group_id'),d.group_id) AS group_id,d.rules_revision,d.evidence
 FROM entities e LEFT JOIN derived d USING(principal,item_id,resource,parent_id,id)
 LEFT JOIN overrides oc ON oc.principal=e.principal AND oc.item_id=e.item_id AND oc.resource=e.resource AND oc.parent_id=e.parent_id AND oc.id=e.id AND oc.field='category'
 LEFT JOIN overrides od ON od.principal=e.principal AND od.item_id=e.item_id AND od.resource=e.resource AND od.parent_id=e.parent_id AND od.id=e.id AND od.field='description'
 LEFT JOIN overrides oi ON oi.principal=e.principal AND oi.item_id=e.item_id AND oi.resource=e.resource AND oi.parent_id=e.parent_id AND oi.id=e.id AND oi.field='ignored';
