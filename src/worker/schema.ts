import { sql } from "drizzle-orm";
import {
  sqliteTable,
  sqliteView,
  text,
  integer,
  primaryKey,
  foreignKey,
  index,
  uniqueIndex,
  check,
} from "drizzle-orm/sqlite-core";

// Mirrors 0001_financial.sql. Wrangler owns migrations; this schema does not generate DDL.
export const principals = sqliteTable(
  "principals",
  {
    id: text("id"),
    revision: integer("revision")
      .notNull()
      .default(sql`0`),
    active_rules: text("active_rules"),
    created_at: text("created_at")
      .notNull()
      .default(sql`strftime('%Y-%m-%dT%H:%M:%fZ','now')`),
  },
  (t) => [primaryKey({ columns: [t.id] })],
);

export const items = sqliteTable(
  "items",
  {
    principal: text("principal").notNull(),
    id: text("id").notNull(),
    resources: text("resources").notNull(),
    enabled: integer("enabled")
      .notNull()
      .default(sql`1`),
  },
  (t) => [
    primaryKey({ columns: [t.principal, t.id] }),
    foreignKey({ columns: [t.principal], foreignColumns: [principals.id] }),
    uniqueIndex("items_id_unique").on(t.id),
    check("items_resources_check", sql`json_valid(resources)`),
  ],
);

export const rule_sets = sqliteTable(
  "rule_sets",
  {
    principal: text("principal").notNull(),
    id: text("id").notNull(),
    document: text("document").notNull(),
    normalizer: text("normalizer").notNull(),
    created_at: text("created_at").notNull(),
    ready: integer("ready")
      .notNull()
      .default(sql`0`),
  },
  (t) => [
    primaryKey({ columns: [t.principal, t.id] }),
    foreignKey({ columns: [t.principal], foreignColumns: [principals.id] }),
    check("rule_sets_document_check", sql`json_valid(document)`),
  ],
);

export const category_groups = sqliteTable(
  "category_groups",
  {
    principal: text("principal").notNull(),
    revision: text("revision").notNull(),
    id: text("id").notNull(),
    name: text("name").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.principal, t.revision, t.id] }),
    foreignKey({
      columns: [t.principal, t.revision],
      foreignColumns: [rule_sets.principal, rule_sets.id],
    }),
  ],
);

export const categories = sqliteTable(
  "categories",
  {
    principal: text("principal").notNull(),
    revision: text("revision").notNull(),
    id: text("id").notNull(),
    group_id: text("group_id").notNull(),
    name: text("name").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.principal, t.revision, t.id] }),
    foreignKey({
      columns: [t.principal, t.revision, t.group_id],
      foreignColumns: [
        category_groups.principal,
        category_groups.revision,
        category_groups.id,
      ],
    }),
  ],
);

export const aliases = sqliteTable(
  "aliases",
  {
    principal: text("principal").notNull(),
    revision: text("revision").notNull(),
    alias: text("alias").notNull(),
    category_id: text("category_id").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.principal, t.revision, t.alias] }),
    foreignKey({
      columns: [t.principal, t.revision, t.category_id],
      foreignColumns: [
        categories.principal,
        categories.revision,
        categories.id,
      ],
    }),
  ],
);

export const rules = sqliteTable(
  "rules",
  {
    principal: text("principal").notNull(),
    revision: text("revision").notNull(),
    id: text("id").notNull(),
    position: integer("position").notNull(),
    priority: integer("priority").notNull(),
    stage: text("stage").notNull(),
    active: integer("active").notNull(),
    definition: text("definition").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.principal, t.revision, t.id] }),
    foreignKey({
      columns: [t.principal, t.revision],
      foreignColumns: [rule_sets.principal, rule_sets.id],
    }),
    check("rules_definition_check", sql`json_valid(definition)`),
  ],
);

export const entities = sqliteTable(
  "entities",
  {
    principal: text("principal").notNull(),
    item_id: text("item_id").notNull(),
    resource: text("resource").notNull(),
    parent_id: text("parent_id")
      .notNull()
      .default(sql`''`),
    id: text("id").notNull(),
    source: text("source").notNull(),
    normalized: text("normalized").notNull(),
    relevant_hash: text("relevant_hash").notNull(),
    normalizer: text("normalizer").notNull(),
    source_created_at: text("source_created_at"),
    source_updated_at: text("source_updated_at"),
    first_seen_at: text("first_seen_at").notNull(),
    observed_at: text("observed_at").notNull(),
    transaction_date: text("transaction_date"),
    currency: text("currency"),
    amount_minor: text("amount_minor"),
    amount_key: text("amount_key"),
    amount_digits: text("amount_digits"),
    amount_sign: integer("amount_sign"),
    account_type: text("account_type"),
    direction: text("direction"),
    status: text("status"),
    original_category: text("original_category"),
    original_description: text("original_description"),
    eligible: integer("eligible")
      .notNull()
      .default(sql`0`),
    deleted: integer("deleted")
      .notNull()
      .default(sql`0`),
    seen_operation: text("seen_operation"),
  },
  (t) => [
    primaryKey({
      columns: [t.principal, t.item_id, t.resource, t.parent_id, t.id],
    }),
    foreignKey({
      columns: [t.principal, t.item_id],
      foreignColumns: [items.principal, items.id],
    }),
    index("entity_category").on(t.principal, t.resource, t.original_category),
    index("entity_amount").on(
      t.principal,
      t.resource,
      t.currency,
      t.amount_key,
    ),
    index("entity_future")
      .on(t.principal, t.transaction_date, t.id)
      .where(sql`eligible=0 AND deleted=0`),
    index("entity_pending")
      .on(t.principal, t.item_id, t.parent_id, t.id)
      .where(sql`resource='transactions' AND status='PENDING' AND deleted=0`),
    index("entity_status").on(t.principal, t.resource, t.status, t.id),
    index("entity_account").on(
      t.principal,
      t.item_id,
      t.resource,
      t.parent_id,
      t.id,
    ),
    index("entity_date").on(t.principal, t.resource, t.transaction_date, t.id),
    check("entities_source_check", sql`json_valid(source)`),
    check("entities_normalized_check", sql`json_valid(normalized)`),
  ],
);

export const derived = sqliteTable(
  "derived",
  {
    principal: text("principal").notNull(),
    item_id: text("item_id").notNull(),
    resource: text("resource").notNull(),
    parent_id: text("parent_id").notNull(),
    id: text("id").notNull(),
    rules_revision: text("rules_revision").notNull(),
    category: text("category").notNull(),
    category_id: text("category_id").notNull(),
    group_id: text("group_id").notNull(),
    description: text("description").notNull(),
    ignored: integer("ignored").notNull(),
    evidence: text("evidence").notNull(),
  },
  (t) => [
    primaryKey({
      columns: [t.principal, t.item_id, t.resource, t.parent_id, t.id],
    }),
    foreignKey({
      columns: [t.principal, t.rules_revision],
      foreignColumns: [rule_sets.principal, rule_sets.id],
    }),
    foreignKey({
      columns: [t.principal, t.item_id, t.resource, t.parent_id, t.id],
      foreignColumns: [
        entities.principal,
        entities.item_id,
        entities.resource,
        entities.parent_id,
        entities.id,
      ],
    }),
    index("derived_category").on(t.principal, t.category_id, t.group_id, t.id),
    check("derived_evidence_check", sql`json_valid(evidence)`),
  ],
);

export const overrides = sqliteTable(
  "overrides",
  {
    principal: text("principal").notNull(),
    item_id: text("item_id").notNull(),
    resource: text("resource").notNull(),
    parent_id: text("parent_id").notNull(),
    id: text("id").notNull(),
    field: text("field").notNull(),
    value: text("value").notNull(),
    updated_at: text("updated_at").notNull(),
  },
  (t) => [
    primaryKey({
      columns: [t.principal, t.item_id, t.resource, t.parent_id, t.id, t.field],
    }),
    foreignKey({
      columns: [t.principal, t.item_id, t.resource, t.parent_id, t.id],
      foreignColumns: [
        entities.principal,
        entities.item_id,
        entities.resource,
        entities.parent_id,
        entities.id,
      ],
    }),
    check(
      "overrides_field_check",
      sql`field IN ('category','description','ignored')`,
    ),
  ],
);

export const tags = sqliteTable(
  "tags",
  {
    principal: text("principal").notNull(),
    item_id: text("item_id").notNull(),
    resource: text("resource").notNull(),
    parent_id: text("parent_id").notNull(),
    id: text("id").notNull(),
    key: text("key").notNull(),
    value: text("value").notNull(),
    origin: text("origin").notNull(),
  },
  (t) => [
    primaryKey({
      columns: [
        t.principal,
        t.item_id,
        t.resource,
        t.parent_id,
        t.id,
        t.key,
        t.origin,
      ],
    }),
    foreignKey({
      columns: [t.principal, t.item_id, t.resource, t.parent_id, t.id],
      foreignColumns: [
        entities.principal,
        entities.item_id,
        entities.resource,
        entities.parent_id,
        entities.id,
      ],
    }),
    index("tags_lookup").on(t.principal, t.key, t.value, t.origin, t.id),
    check("tags_origin_check", sql`origin IN ('derived','manual')`),
  ],
);

export const operations = sqliteTable(
  "operations",
  {
    id: text("id"),
    principal: text("principal").notNull(),
    request_key: text("request_key").notNull(),
    kind: text("kind").notNull(),
    input: text("input").notNull(),
    input_hash: text("input_hash").notNull(),
    rules_revision: text("rules_revision").notNull(),
    reference_day: text("reference_day").notNull(),
    status: text("status")
      .notNull()
      .default(sql`'working'`),
    phase: text("phase")
      .notNull()
      .default(sql`'queued'`),
    cancel_requested: integer("cancel_requested")
      .notNull()
      .default(sql`0`),
    dispatched: integer("dispatched")
      .notNull()
      .default(sql`0`),
    created_at: text("created_at").notNull(),
    updated_at: text("updated_at").notNull(),
    progress: text("progress")
      .notNull()
      .default(sql`'{}'`),
    result: text("result"),
    error: text("error"),
  },
  (t) => [
    primaryKey({ columns: [t.id] }),
    foreignKey({
      columns: [t.principal, t.rules_revision],
      foreignColumns: [rule_sets.principal, rule_sets.id],
    }),
    foreignKey({ columns: [t.principal], foreignColumns: [principals.id] }),
    index("operations_owner").on(t.principal, t.created_at),
    index("operations_dispatch").on(t.dispatched, t.status, t.created_at),
    uniqueIndex("operations_principal_request_key_unique").on(
      t.principal,
      t.request_key,
    ),
    check("operations_input_check", sql`json_valid(input)`),
  ],
);

export const locks = sqliteTable(
  "locks",
  {
    principal: text("principal"),
    operation_id: text("operation_id").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.principal] }),
    foreignKey({ columns: [t.operation_id], foreignColumns: [operations.id] }),
    foreignKey({ columns: [t.principal], foreignColumns: [principals.id] }),
    uniqueIndex("locks_operation_id_unique").on(t.operation_id),
  ],
);

export const coverage = sqliteTable(
  "coverage",
  {
    principal: text("principal").notNull(),
    item_id: text("item_id").notNull(),
    resource: text("resource").notNull(),
    parent_id: text("parent_id")
      .notNull()
      .default(sql`''`),
    status: text("status").notNull(),
    bootstrap_complete: integer("bootstrap_complete")
      .notNull()
      .default(sql`0`),
    confirmed_created_at: text("confirmed_created_at"),
    observed_at: text("observed_at"),
    parent_signature: text("parent_signature"),
  },
  (t) => [
    primaryKey({ columns: [t.principal, t.item_id, t.resource, t.parent_id] }),
    foreignKey({
      columns: [t.principal, t.item_id],
      foreignColumns: [items.principal, items.id],
    }),
  ],
);

export const checkpoints = sqliteTable(
  "checkpoints",
  {
    operation_id: text("operation_id").notNull(),
    item_id: text("item_id").notNull(),
    resource: text("resource").notNull(),
    parent_id: text("parent_id")
      .notNull()
      .default(sql`''`),
    cursor: text("cursor"),
    creation_floor: text("creation_floor"),
    maximum_created_at: text("maximum_created_at"),
    page: integer("page")
      .notNull()
      .default(sql`0`),
    done: integer("done")
      .notNull()
      .default(sql`0`),
    expected_total: integer("expected_total"),
    collected: integer("collected")
      .notNull()
      .default(sql`0`),
  },
  (t) => [
    primaryKey({
      columns: [t.operation_id, t.item_id, t.resource, t.parent_id],
    }),
    foreignKey({ columns: [t.operation_id], foreignColumns: [operations.id] }),
  ],
);

export const operation_targets = sqliteTable(
  "operation_targets",
  {
    operation_id: text("operation_id").notNull(),
    item_id: text("item_id").notNull(),
    resource: text("resource").notNull(),
    parent_id: text("parent_id").notNull(),
    id: text("id").notNull(),
    processed: integer("processed")
      .notNull()
      .default(sql`0`),
  },
  (t) => [
    primaryKey({
      columns: [t.operation_id, t.item_id, t.resource, t.parent_id, t.id],
    }),
    foreignKey({ columns: [t.operation_id], foreignColumns: [operations.id] }),
    index("targets_pending").on(
      t.operation_id,
      t.processed,
      t.item_id,
      t.parent_id,
      t.id,
    ),
  ],
);

export const page_commits = sqliteTable(
  "page_commits",
  {
    operation_id: text("operation_id").notNull(),
    step_key: text("step_key").notNull(),
    progress: text("progress").notNull(),
  },
  (t) => [primaryKey({ columns: [t.operation_id, t.step_key] })],
);

export const inbox = sqliteTable(
  "inbox",
  {
    event_id: text("event_id"),
    principal: text("principal").notNull(),
    item_id: text("item_id").notNull(),
    account_id: text("account_id").notNull(),
    event: text("event").notNull(),
    payload: text("payload").notNull(),
    received_at: text("received_at").notNull(),
    operation_id: text("operation_id"),
    processed_at: text("processed_at"),
  },
  (t) => [
    primaryKey({ columns: [t.event_id] }),
    foreignKey({
      columns: [t.principal, t.item_id],
      foreignColumns: [items.principal, items.id],
    }),
    foreignKey({ columns: [t.operation_id], foreignColumns: [operations.id] }),
    index("inbox_dispatch").on(t.operation_id, t.received_at),
    check("inbox_payload_check", sql`json_valid(payload)`),
  ],
);

export const migration_imports = sqliteTable(
  "migration_imports",
  {
    principal: text("principal").notNull(),
    source_key: text("source_key").notNull(),
    source_hash: text("source_hash").notNull(),
    imported_at: text("imported_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.principal, t.source_key, t.source_hash] })],
);

export const effective_entities = sqliteView("effective_entities", {
  principal: text("principal"),
  item_id: text("item_id"),
  resource: text("resource"),
  parent_id: text("parent_id"),
  id: text("id"),
  source: text("source"),
  normalized: text("normalized"),
  relevant_hash: text("relevant_hash"),
  normalizer: text("normalizer"),
  source_created_at: text("source_created_at"),
  source_updated_at: text("source_updated_at"),
  first_seen_at: text("first_seen_at"),
  observed_at: text("observed_at"),
  transaction_date: text("transaction_date"),
  currency: text("currency"),
  amount_minor: text("amount_minor"),
  amount_key: text("amount_key"),
  amount_digits: text("amount_digits"),
  amount_sign: integer("amount_sign"),
  account_type: text("account_type"),
  direction: text("direction"),
  status: text("status"),
  original_category: text("original_category"),
  original_description: text("original_description"),
  eligible: integer("eligible"),
  deleted: integer("deleted"),
  seen_operation: text("seen_operation"),
  effective_category: text("effective_category"),
  effective_description: text("effective_description"),
  ignored: integer("ignored"),
  category_id: text("category_id"),
  group_id: text("group_id"),
  rules_revision: text("rules_revision"),
  evidence: text("evidence"),
}).existing();
