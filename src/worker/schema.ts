import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  primaryKey,
  sqliteTable,
  sqliteView,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

import {
  type OperationInput,
  OperationPhase,
  OperationStatus,
  type WebhookEvent,
} from "#contracts/operation.types.ts";
import {
  type CoverageStatus,
  type Resource,
  TagOrigin,
} from "#domain/enums.ts";
import type { FinanceRecord } from "#domain/finance.types.ts";
import type { ProviderRecord } from "#domain/provider.types.ts";
import { CorrectionField } from "#domain/record-correction.types.ts";
import type { Derived, LegacyRules, Rules } from "#domain/rules/rules.types.ts";
import type { JsonValue } from "#shared/json.types.ts";
import type { PageCommit, Progress } from "#worker/sync/operation-storage.ts";

// Mirrors 0001_personal.sql. Wrangler owns migrations; this schema does not generate DDL.
export const settings = sqliteTable(
  "settings",
  {
    id: integer("id").notNull().default(1),
    sync_enabled: integer("sync_enabled").notNull().default(0),
    client_id_hash: text("client_id_hash"),
    connected_at: text("connected_at")
      .notNull()
      .default(sql`'1970-01-01T00:00:00.000Z'`),
    next_sync_at: text("next_sync_at")
      .notNull()
      .default(sql`'1970-01-01T00:00:00.000Z'`),
    manual_sync_after: text("manual_sync_after")
      .notNull()
      .default(sql`'1970-01-01T00:00:00.000Z'`),
    reconcile_after: text("reconcile_after")
      .notNull()
      .default(sql`'1970-01-01T00:00:00.000Z'`),
    revision: integer("revision").notNull().default(sql`0`),
    active_rules: text("active_rules"),
  },
  (t) => [
    primaryKey({ columns: [t.id] }),
    check("settings_singleton", sql`id=1`),
    check("settings_sync_enabled", sql`sync_enabled IN (0,1)`),
  ],
);

export const items = sqliteTable(
  "items",
  {
    id: text("id").notNull(),
    resources: text("resources", { mode: "json" })
      .$type<Resource[]>()
      .notNull(),
    enabled: integer("enabled").notNull().default(sql`1`),
  },
  (t) => [
    primaryKey({ columns: [t.id] }),
    check("items_resources_check", sql`json_valid(resources)`),
  ],
);

export const rule_sets = sqliteTable(
  "rule_sets",
  {
    id: text("id").notNull(),
    document: text("document", { mode: "json" })
      .$type<Rules | LegacyRules>()
      .notNull(),
    normalizer: text("normalizer").notNull(),
    created_at: text("created_at").notNull(),
    ready: integer("ready").notNull().default(sql`0`),
  },
  (t) => [
    primaryKey({ columns: [t.id] }),
    check("rule_sets_document_check", sql`json_valid(document)`),
  ],
);

export const category_groups = sqliteTable(
  "category_groups",
  {
    revision: text("revision").notNull(),
    id: text("id").notNull(),
    name: text("name").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.revision, t.id] }),
    foreignKey({
      columns: [t.revision],
      foreignColumns: [rule_sets.id],
    }),
  ],
);

export const categories = sqliteTable(
  "categories",
  {
    revision: text("revision").notNull(),
    id: text("id").notNull(),
    group_id: text("group_id").notNull(),
    name: text("name").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.revision, t.id] }),
    foreignKey({
      columns: [t.revision, t.group_id],
      foreignColumns: [category_groups.revision, category_groups.id],
    }),
  ],
);

export const aliases = sqliteTable(
  "aliases",
  {
    revision: text("revision").notNull(),
    alias: text("alias").notNull(),
    category_id: text("category_id").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.revision, t.alias] }),
    foreignKey({
      columns: [t.revision, t.category_id],
      foreignColumns: [categories.revision, categories.id],
    }),
  ],
);

export const rules = sqliteTable(
  "rules",
  {
    revision: text("revision").notNull(),
    id: text("id").notNull(),
    position: integer("position").notNull(),
    priority: integer("priority").notNull(),
    stage: text("stage")
      .$type<Rules["rules"][number]["event"]["type"]>()
      .notNull(),
    active: integer("active").notNull(),
    definition: text("definition", { mode: "json" })
      .$type<Rules["rules"][number]>()
      .notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.revision, t.id] }),
    foreignKey({
      columns: [t.revision],
      foreignColumns: [rule_sets.id],
    }),
    check("rules_definition_check", sql`json_valid(definition)`),
  ],
);

const entityColumns = () => ({
  item_id: text("item_id").notNull(),
  resource: text("resource").$type<Resource>().notNull(),
  parent_id: text("parent_id").notNull().default(sql`''`),
  id: text("id").notNull(),
  source: text("source", { mode: "json" }).$type<ProviderRecord>().notNull(),
  normalized: text("normalized", { mode: "json" })
    .$type<FinanceRecord>()
    .notNull(),
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
  eligible: integer("eligible").notNull().default(sql`0`),
  deleted: integer("deleted").notNull().default(sql`0`),
  seen_operation: text("seen_operation"),
});

export const entities = sqliteTable("entities", entityColumns(), (t) => [
  primaryKey({
    columns: [t.item_id, t.resource, t.parent_id, t.id],
  }),
  foreignKey({
    columns: [t.item_id],
    foreignColumns: [items.id],
  }),
  index("entity_category").on(t.resource, t.original_category),
  index("entity_amount").on(t.resource, t.currency, t.amount_key),
  index("entity_future")
    .on(t.transaction_date, t.id)
    .where(sql`eligible=0 AND deleted=0`),
  index("entity_pending")
    .on(t.item_id, t.parent_id, t.id)
    .where(sql`resource='transactions' AND status='PENDING' AND deleted=0`),
  index("entity_status").on(t.resource, t.status, t.id),
  index("entity_account").on(t.item_id, t.resource, t.parent_id, t.id),
  index("entity_date").on(t.resource, t.transaction_date, t.id),
  check("entities_source_check", sql`json_valid(source)`),
  check("entities_normalized_check", sql`json_valid(normalized)`),
]);

export const derived = sqliteTable(
  "derived",
  {
    item_id: text("item_id").notNull(),
    resource: text("resource").$type<Resource>().notNull(),
    parent_id: text("parent_id").notNull(),
    id: text("id").notNull(),
    rules_revision: text("rules_revision").notNull(),
    category: text("category").notNull(),
    category_id: text("category_id").notNull(),
    group_id: text("group_id").notNull(),
    description: text("description").notNull(),
    ignored: integer("ignored").notNull(),
    evidence: text("evidence", { mode: "json" })
      .$type<Derived["evidence"]>()
      .notNull(),
  },
  (t) => [
    primaryKey({
      columns: [t.item_id, t.resource, t.parent_id, t.id],
    }),
    foreignKey({
      columns: [t.rules_revision],
      foreignColumns: [rule_sets.id],
    }),
    foreignKey({
      columns: [t.item_id, t.resource, t.parent_id, t.id],
      foreignColumns: [
        entities.item_id,
        entities.resource,
        entities.parent_id,
        entities.id,
      ],
    }),
    index("derived_category").on(t.category_id, t.group_id, t.id),
    check("derived_evidence_check", sql`json_valid(evidence)`),
  ],
);

export const overrides = sqliteTable(
  "overrides",
  {
    item_id: text("item_id").notNull(),
    resource: text("resource").$type<Resource>().notNull(),
    parent_id: text("parent_id").notNull(),
    id: text("id").notNull(),
    field: text("field", {
      enum: [
        CorrectionField.category,
        CorrectionField.description,
        CorrectionField.ignored,
      ],
    }).notNull(),
    value: text("value").notNull(),
    updated_at: text("updated_at").notNull(),
  },
  (t) => [
    primaryKey({
      columns: [t.item_id, t.resource, t.parent_id, t.id, t.field],
    }),
    foreignKey({
      columns: [t.item_id, t.resource, t.parent_id, t.id],
      foreignColumns: [
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
    item_id: text("item_id").notNull(),
    resource: text("resource").$type<Resource>().notNull(),
    parent_id: text("parent_id").notNull(),
    id: text("id").notNull(),
    key: text("key").notNull(),
    value: text("value").notNull(),
    origin: text("origin", {
      enum: [TagOrigin.derived, TagOrigin.manual],
    }).notNull(),
  },
  (t) => [
    primaryKey({
      columns: [t.item_id, t.resource, t.parent_id, t.id, t.key, t.origin],
    }),
    foreignKey({
      columns: [t.item_id, t.resource, t.parent_id, t.id],
      foreignColumns: [
        entities.item_id,
        entities.resource,
        entities.parent_id,
        entities.id,
      ],
    }),
    index("tags_lookup").on(t.key, t.value, t.origin, t.id),
    check("tags_origin_check", sql`origin IN ('derived','manual')`),
  ],
);

export const operations = sqliteTable(
  "operations",
  {
    id: text("id").notNull(),

    request_key: text("request_key").notNull(),
    kind: text("kind").$type<OperationInput["kind"]>().notNull(),
    input: text("input", { mode: "json" }).$type<OperationInput>().notNull(),
    input_hash: text("input_hash").notNull(),
    rules_revision: text("rules_revision").notNull(),
    reference_day: text("reference_day").notNull(),
    status: text("status")
      .$type<OperationStatus>()
      .notNull()
      .default(OperationStatus.working),
    phase: text("phase")
      .$type<OperationPhase>()
      .notNull()
      .default(OperationPhase.queued),
    cancel_requested: integer("cancel_requested").notNull().default(sql`0`),
    dispatched: integer("dispatched").notNull().default(sql`0`),
    created_at: text("created_at").notNull(),
    updated_at: text("updated_at").notNull(),
    progress: text("progress", { mode: "json" })
      .$type<Partial<Progress>>()
      .notNull()
      .default(sql`'{}'`),
    result: text("result", { mode: "json" }).$type<Record<string, JsonValue>>(),
    error: text("error", { mode: "json" }).$type<Record<string, JsonValue>>(),
  },
  (t) => [
    primaryKey({ columns: [t.id] }),
    foreignKey({
      columns: [t.rules_revision],
      foreignColumns: [rule_sets.id],
    }),
    index("operations_created").on(t.created_at),
    index("operations_dispatch").on(t.dispatched, t.status, t.created_at),
    uniqueIndex("operations_request_key_unique").on(t.request_key),
    check("operations_input_check", sql`json_valid(input)`),
  ],
);

export const locks = sqliteTable(
  "locks",
  {
    id: integer("id").notNull().default(1),

    operation_id: text("operation_id").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.id] }),
    check("locks_singleton", sql`id=1`),
    foreignKey({ columns: [t.operation_id], foreignColumns: [operations.id] }),
    uniqueIndex("locks_operation_id_unique").on(t.operation_id),
  ],
);

export const coverage = sqliteTable(
  "coverage",
  {
    item_id: text("item_id").notNull(),
    resource: text("resource").$type<Resource>().notNull(),
    parent_id: text("parent_id").notNull().default(sql`''`),
    status: text("status").$type<CoverageStatus>().notNull(),
    bootstrap_complete: integer("bootstrap_complete").notNull().default(sql`0`),
    confirmed_created_at: text("confirmed_created_at"),
    observed_at: text("observed_at"),
    parent_signature: text("parent_signature"),
  },
  (t) => [
    primaryKey({ columns: [t.item_id, t.resource, t.parent_id] }),
    foreignKey({
      columns: [t.item_id],
      foreignColumns: [items.id],
    }),
  ],
);

export const checkpoints = sqliteTable(
  "checkpoints",
  {
    operation_id: text("operation_id").notNull(),
    item_id: text("item_id").notNull(),
    resource: text("resource").$type<Resource>().notNull(),
    parent_id: text("parent_id").notNull().default(sql`''`),
    cursor: text("cursor"),
    creation_floor: text("creation_floor"),
    maximum_created_at: text("maximum_created_at"),
    page: integer("page").notNull().default(sql`0`),
    done: integer("done").notNull().default(sql`0`),
    expected_total: integer("expected_total"),
    collected: integer("collected").notNull().default(sql`0`),
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
    resource: text("resource").$type<Resource>().notNull(),
    parent_id: text("parent_id").notNull(),
    id: text("id").notNull(),
    processed: integer("processed").notNull().default(sql`0`),
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
    progress: text("progress", { mode: "json" }).$type<PageCommit>().notNull(),
  },
  (t) => [primaryKey({ columns: [t.operation_id, t.step_key] })],
);

export const inbox = sqliteTable(
  "inbox",
  {
    event_id: text("event_id").notNull(),

    item_id: text("item_id").notNull(),
    account_id: text("account_id").notNull(),
    event: text("event").notNull(),
    payload: text("payload", { mode: "json" })
      .$type<Partial<WebhookEvent>>()
      .notNull(),
    received_at: text("received_at").notNull(),
    operation_id: text("operation_id"),
    processed_at: text("processed_at"),
  },
  (t) => [
    primaryKey({ columns: [t.event_id] }),
    foreignKey({
      columns: [t.item_id],
      foreignColumns: [items.id],
    }),
    foreignKey({ columns: [t.operation_id], foreignColumns: [operations.id] }),
    index("inbox_dispatch").on(t.operation_id, t.received_at),
    check("inbox_payload_check", sql`json_valid(payload)`),
  ],
);

export const migration_imports = sqliteTable(
  "migration_imports",
  {
    source_key: text("source_key").notNull(),
    source_hash: text("source_hash").notNull(),
    imported_at: text("imported_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.source_key, t.source_hash] })],
);

export const effective_entities = sqliteView("effective_entities", {
  ...entityColumns(),
  effective_category: text("effective_category"),
  effective_description: text("effective_description"),
  ignored: integer("ignored"),
  category_id: text("category_id"),
  group_id: text("group_id"),
  rules_revision: text("rules_revision"),
  evidence: text("evidence", { mode: "json" }).$type<Derived["evidence"]>(),
}).existing();

export const portal_sessions = sqliteTable(
  "portal_sessions",
  {
    id: text("id").primaryKey().notNull(),
    csrf: text("csrf").notNull(),
    expires: integer("expires").notNull(),
    auth_version: text("auth_version").notNull(),
  },
  (t) => [index("portal_sessions_expiry").on(t.expires)],
);
export const login_attempts = sqliteTable("login_attempts", {
  id: text("id").primaryKey().notNull(),
  attempts: integer("attempts").notNull(),
  expires: integer("expires").notNull(),
});
