-- New personal installations only. Existing databases require a separate migration.
PRAGMA foreign_keys=ON;
CREATE TABLE settings (
 id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL DEFAULT 0, active_rules TEXT,
 sync_enabled INTEGER NOT NULL DEFAULT 0 CHECK(sync_enabled IN (0,1)), client_id_hash TEXT,
 connected_at TEXT NOT NULL DEFAULT '1970-01-01T00:00:00.000Z',
 next_sync_at TEXT NOT NULL DEFAULT '1970-01-01T00:00:00.000Z',
 manual_sync_after TEXT NOT NULL DEFAULT '1970-01-01T00:00:00.000Z',
 reconcile_after TEXT NOT NULL DEFAULT '1970-01-01T00:00:00.000Z'
);
INSERT INTO settings(id) VALUES(1);
CREATE TABLE items (
 id TEXT NOT NULL,
 resources TEXT NOT NULL CHECK(json_valid(resources)), enabled INTEGER NOT NULL DEFAULT 1,
 PRIMARY KEY(id)
);
CREATE TABLE rule_sets (
 id TEXT NOT NULL, document TEXT NOT NULL CHECK(json_valid(document)),
 normalizer TEXT NOT NULL, created_at TEXT NOT NULL, ready INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(id)
);
CREATE TABLE category_groups (revision TEXT NOT NULL, id TEXT NOT NULL, name TEXT NOT NULL, PRIMARY KEY(revision,id), FOREIGN KEY(revision) REFERENCES rule_sets(id));
CREATE TABLE categories (revision TEXT NOT NULL, id TEXT NOT NULL, group_id TEXT NOT NULL, name TEXT NOT NULL, PRIMARY KEY(revision,id), FOREIGN KEY(revision,group_id) REFERENCES category_groups(revision,id));
CREATE TABLE aliases (revision TEXT NOT NULL, alias TEXT NOT NULL, category_id TEXT NOT NULL, PRIMARY KEY(revision,alias), FOREIGN KEY(revision,category_id) REFERENCES categories(revision,id));
CREATE TABLE rules (revision TEXT NOT NULL, id TEXT NOT NULL, position INTEGER NOT NULL, priority INTEGER NOT NULL, stage TEXT NOT NULL, active INTEGER NOT NULL, definition TEXT NOT NULL CHECK(json_valid(definition)), PRIMARY KEY(revision,id), FOREIGN KEY(revision) REFERENCES rule_sets(id));
-- One row per source identity. Projected/indexed columns serve SQL queries; raw
-- retains provider fields, not an opaque substitute for relational access.
CREATE TABLE entities (
 item_id TEXT NOT NULL, resource TEXT NOT NULL, parent_id TEXT NOT NULL DEFAULT '', id TEXT NOT NULL,
 source TEXT NOT NULL CHECK(json_valid(source)), normalized TEXT NOT NULL CHECK(json_valid(normalized)),
 relevant_hash TEXT NOT NULL, normalizer TEXT NOT NULL, source_created_at TEXT, source_updated_at TEXT, first_seen_at TEXT NOT NULL,
 observed_at TEXT NOT NULL, transaction_date TEXT, currency TEXT, amount_minor TEXT, amount_key TEXT, amount_digits TEXT, amount_sign INTEGER,
 account_type TEXT, direction TEXT, status TEXT, original_category TEXT, original_description TEXT,
 eligible INTEGER NOT NULL DEFAULT 0, deleted INTEGER NOT NULL DEFAULT 0, seen_operation TEXT,
 PRIMARY KEY(item_id,resource,parent_id,id), FOREIGN KEY(item_id) REFERENCES items(id)
);
CREATE INDEX entity_date ON entities(resource,transaction_date,id);
CREATE INDEX entity_account ON entities(item_id,resource,parent_id,id);
CREATE INDEX entity_status ON entities(resource,status,id);
CREATE INDEX entity_pending ON entities(item_id,parent_id,id) WHERE resource='transactions' AND status='PENDING' AND deleted=0;
CREATE INDEX entity_future ON entities(transaction_date,id) WHERE eligible=0 AND deleted=0;
CREATE INDEX entity_amount ON entities(resource,currency,amount_key);
CREATE INDEX entity_category ON entities(resource,original_category);
CREATE TABLE derived (
 item_id TEXT NOT NULL,resource TEXT NOT NULL,parent_id TEXT NOT NULL,id TEXT NOT NULL,
 rules_revision TEXT NOT NULL,category TEXT NOT NULL,category_id TEXT NOT NULL,group_id TEXT NOT NULL,description TEXT NOT NULL,
 ignored INTEGER NOT NULL,evidence TEXT NOT NULL CHECK(json_valid(evidence)),
 PRIMARY KEY(item_id,resource,parent_id,id),
 FOREIGN KEY(item_id,resource,parent_id,id) REFERENCES entities(item_id,resource,parent_id,id),
 FOREIGN KEY(rules_revision) REFERENCES rule_sets(id)
);
CREATE INDEX derived_category ON derived(category_id,group_id,id);
CREATE TABLE overrides (
 item_id TEXT NOT NULL,resource TEXT NOT NULL,parent_id TEXT NOT NULL,id TEXT NOT NULL,
 field TEXT NOT NULL CHECK(field IN ('category','description','ignored')), value TEXT NOT NULL, updated_at TEXT NOT NULL,
 PRIMARY KEY(item_id,resource,parent_id,id,field),
 FOREIGN KEY(item_id,resource,parent_id,id) REFERENCES entities(item_id,resource,parent_id,id)
);
CREATE TABLE tags (
 item_id TEXT NOT NULL,resource TEXT NOT NULL,parent_id TEXT NOT NULL,id TEXT NOT NULL,
 key TEXT NOT NULL,value TEXT NOT NULL,origin TEXT NOT NULL CHECK(origin IN ('derived','manual')),
 PRIMARY KEY(item_id,resource,parent_id,id,key,origin),
 FOREIGN KEY(item_id,resource,parent_id,id) REFERENCES entities(item_id,resource,parent_id,id)
);
CREATE INDEX tags_lookup ON tags(key,value,origin,id);
CREATE TABLE operations (
 id TEXT PRIMARY KEY, request_key TEXT NOT NULL,
 kind TEXT NOT NULL, input TEXT NOT NULL CHECK(json_valid(input)), input_hash TEXT NOT NULL, rules_revision TEXT NOT NULL,reference_day TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'working',phase TEXT NOT NULL DEFAULT 'queued',cancel_requested INTEGER NOT NULL DEFAULT 0,
 dispatched INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,
 progress TEXT NOT NULL DEFAULT '{}',result TEXT,error TEXT,
 UNIQUE(request_key),FOREIGN KEY(rules_revision) REFERENCES rule_sets(id)
);
CREATE INDEX operations_dispatch ON operations(dispatched,status,created_at);
CREATE INDEX operations_created ON operations(created_at);
-- Queue ownership never expires by a wall clock while an executor can publish.
CREATE TABLE locks (id INTEGER PRIMARY KEY CHECK(id=1),operation_id TEXT NOT NULL UNIQUE REFERENCES operations(id));
CREATE TABLE coverage (
 item_id TEXT NOT NULL,resource TEXT NOT NULL,parent_id TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL,bootstrap_complete INTEGER NOT NULL DEFAULT 0,confirmed_created_at TEXT,observed_at TEXT,parent_signature TEXT,
 PRIMARY KEY(item_id,resource,parent_id),FOREIGN KEY(item_id) REFERENCES items(id)
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
 event_id TEXT PRIMARY KEY,item_id TEXT NOT NULL,account_id TEXT NOT NULL,event TEXT NOT NULL,payload TEXT NOT NULL CHECK(json_valid(payload)),
 received_at TEXT NOT NULL,operation_id TEXT REFERENCES operations(id),processed_at TEXT,
 FOREIGN KEY(item_id) REFERENCES items(id)
);
CREATE INDEX inbox_dispatch ON inbox(operation_id,received_at);
CREATE TABLE migration_imports (source_key TEXT NOT NULL,source_hash TEXT NOT NULL,imported_at TEXT NOT NULL,PRIMARY KEY(source_key,source_hash));
CREATE VIEW effective_entities AS SELECT e.*,
 COALESCE(json_extract(oc.value,'$.name'),d.category,e.original_category) AS effective_category,
 COALESCE(od.value,d.description,e.original_description) AS effective_description,
 COALESCE(CAST(oi.value AS INTEGER),d.ignored,0) AS ignored,
 COALESCE(json_extract(oc.value,'$.id'),d.category_id) AS category_id,COALESCE(json_extract(oc.value,'$.group_id'),d.group_id) AS group_id,d.rules_revision,d.evidence
 FROM entities e LEFT JOIN derived d USING(item_id,resource,parent_id,id)
 LEFT JOIN overrides oc ON oc.item_id=e.item_id AND oc.resource=e.resource AND oc.parent_id=e.parent_id AND oc.id=e.id AND oc.field='category'
 LEFT JOIN overrides od ON od.item_id=e.item_id AND od.resource=e.resource AND od.parent_id=e.parent_id AND od.id=e.id AND od.field='description'
 LEFT JOIN overrides oi ON oi.item_id=e.item_id AND oi.resource=e.resource AND oi.parent_id=e.parent_id AND oi.id=e.id AND oi.field='ignored';

CREATE TABLE portal_sessions (
 id TEXT PRIMARY KEY, csrf TEXT NOT NULL, expires INTEGER NOT NULL, auth_version TEXT NOT NULL
);
CREATE INDEX portal_sessions_expiry ON portal_sessions(expires);
CREATE TABLE login_attempts (id TEXT PRIMARY KEY, attempts INTEGER NOT NULL, expires INTEGER NOT NULL);
CREATE TRIGGER pluggy_application_immutable BEFORE UPDATE OF client_id_hash ON settings
WHEN OLD.client_id_hash IS NOT NULL AND NEW.client_id_hash IS NOT OLD.client_id_hash
BEGIN SELECT RAISE(ABORT, 'APPLICATION_CHANGE_REQUIRES_MIGRATION'); END;
CREATE TRIGGER personal_item_limit BEFORE INSERT ON items
WHEN (SELECT COUNT(*) FROM items) >= 10 AND NOT EXISTS(SELECT 1 FROM items WHERE id=NEW.id)
BEGIN SELECT RAISE(ABORT, 'ITEM_LIMIT'); END;
