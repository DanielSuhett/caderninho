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
} from "@/contracts/operation.types";
import { type CoverageStatus, type Resource, TagOrigin } from "@/domain/enums";
import { CorrectionField, type FinanceRecord } from "@/domain/finance.entity";
import type { ProviderRecord } from "@/domain/provider.entity";
import type { Derived, LegacyRules, Rules } from "@/domain/rules";
import type { JsonValue } from "@/shared/json.types";

import type { PageCommit, Progress } from "./sync";

// Mirrors the applied migrations. Wrangler owns DDL.
export const settings = sqliteTable(
  "settings",
  {
    active_rules: text("active_rules"),
    connected_at: text("connected_at")
      .notNull()
      .default(sql`'1970-01-01T00:00:00.000Z'`),
    id: integer("id").notNull().default(1),
    manual_sync_after: text("manual_sync_after")
      .notNull()
      .default(sql`'1970-01-01T00:00:00.000Z'`),
    next_sync_at: text("next_sync_at")
      .notNull()
      .default(sql`'1970-01-01T00:00:00.000Z'`),
    reconcile_after: text("reconcile_after")
      .notNull()
      .default(sql`'1970-01-01T00:00:00.000Z'`),
    revision: integer("revision").notNull().default(sql`0`),
    sync_enabled: integer("sync_enabled").notNull().default(0),
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
  },
  (t) => [primaryKey({ columns: [t.id] })],
);

export const rule_sets = sqliteTable(
  "rule_sets",
  {
    created_at: text("created_at").notNull(),
    document: text("document", { mode: "json" })
      .$type<Rules | LegacyRules>()
      .notNull(),
    id: text("id").notNull(),
    normalizer: text("normalizer").notNull(),
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
    id: text("id").notNull(),
    name: text("name").notNull(),
    revision: text("revision").notNull(),
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
    group_id: text("group_id").notNull(),
    id: text("id").notNull(),
    name: text("name").notNull(),
    revision: text("revision").notNull(),
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
    alias: text("alias").notNull(),
    category_id: text("category_id").notNull(),
    revision: text("revision").notNull(),
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
    active: integer("active").notNull(),
    definition: text("definition", { mode: "json" })
      .$type<Rules["rules"][number]>()
      .notNull(),
    id: text("id").notNull(),
    position: integer("position").notNull(),
    priority: integer("priority").notNull(),
    revision: text("revision").notNull(),
    stage: text("stage")
      .$type<Rules["rules"][number]["event"]["type"]>()
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
  account_type: text("account_type"),
  amount_digits: text("amount_digits"),
  amount_key: text("amount_key"),
  amount_minor: text("amount_minor"),
  amount_sign: integer("amount_sign"),
  currency: text("currency"),
  deleted: integer("deleted").notNull().default(sql`0`),
  direction: text("direction"),
  eligible: integer("eligible").notNull().default(sql`0`),
  first_seen_at: text("first_seen_at").notNull(),
  id: text("id").notNull(),
  item_id: text("item_id").notNull(),
  normalized: text("normalized", { mode: "json" })
    .$type<FinanceRecord>()
    .notNull(),
  normalizer: text("normalizer").notNull(),
  observed_at: text("observed_at").notNull(),
  original_category: text("original_category"),
  original_description: text("original_description"),
  parent_id: text("parent_id").notNull().default(sql`''`),
  relevant_hash: text("relevant_hash").notNull(),
  resource: text("resource").$type<Resource>().notNull(),
  seen_operation: text("seen_operation"),
  source: text("source", { mode: "json" }).$type<ProviderRecord>().notNull(),
  source_created_at: text("source_created_at"),
  source_updated_at: text("source_updated_at"),
  status: text("status"),
  transaction_date: text("transaction_date"),
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
    category: text("category").notNull(),
    category_id: text("category_id").notNull(),
    description: text("description").notNull(),
    evidence: text("evidence", { mode: "json" })
      .$type<Derived["evidence"]>()
      .notNull(),
    group_id: text("group_id").notNull(),
    id: text("id").notNull(),
    ignored: integer("ignored").notNull(),
    item_id: text("item_id").notNull(),
    parent_id: text("parent_id").notNull(),
    resource: text("resource").$type<Resource>().notNull(),
    rules_revision: text("rules_revision").notNull(),
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
    field: text("field", {
      enum: [
        CorrectionField.category,
        CorrectionField.description,
        CorrectionField.ignored,
      ],
    }).notNull(),
    id: text("id").notNull(),
    item_id: text("item_id").notNull(),
    parent_id: text("parent_id").notNull(),
    resource: text("resource").$type<Resource>().notNull(),
    updated_at: text("updated_at").notNull(),
    value: text("value").notNull(),
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
    id: text("id").notNull(),
    item_id: text("item_id").notNull(),
    key: text("key").notNull(),
    origin: text("origin", {
      enum: [TagOrigin.derived, TagOrigin.manual],
    }).notNull(),
    parent_id: text("parent_id").notNull(),
    resource: text("resource").$type<Resource>().notNull(),
    value: text("value").notNull(),
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
    cancel_requested: integer("cancel_requested").notNull().default(sql`0`),
    created_at: text("created_at").notNull(),
    dispatched: integer("dispatched").notNull().default(sql`0`),
    error: text("error", { mode: "json" }).$type<Record<string, JsonValue>>(),
    id: text("id").notNull(),
    input: text("input", { mode: "json" }).$type<OperationInput>().notNull(),
    input_hash: text("input_hash").notNull(),
    kind: text("kind").$type<OperationInput["kind"]>().notNull(),
    phase: text("phase")
      .$type<OperationPhase>()
      .notNull()
      .default(OperationPhase.queued),
    progress: text("progress", { mode: "json" })
      .$type<Partial<Progress>>()
      .notNull()
      .default(sql`'{}'`),
    reference_day: text("reference_day").notNull(),

    request_key: text("request_key").notNull(),
    result: text("result", { mode: "json" }).$type<Record<string, JsonValue>>(),
    rules_revision: text("rules_revision").notNull(),
    status: text("status")
      .$type<OperationStatus>()
      .notNull()
      .default(OperationStatus.working),
    updated_at: text("updated_at").notNull(),
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
    bootstrap_complete: integer("bootstrap_complete").notNull().default(sql`0`),
    confirmed_created_at: text("confirmed_created_at"),
    item_id: text("item_id").notNull(),
    observed_at: text("observed_at"),
    parent_id: text("parent_id").notNull().default(sql`''`),
    parent_signature: text("parent_signature"),
    resource: text("resource").$type<Resource>().notNull(),
    status: text("status").$type<CoverageStatus>().notNull(),
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
    collected: integer("collected").notNull().default(sql`0`),
    creation_floor: text("creation_floor"),
    cursor: text("cursor"),
    done: integer("done").notNull().default(sql`0`),
    expected_total: integer("expected_total"),
    item_id: text("item_id").notNull(),
    maximum_created_at: text("maximum_created_at"),
    operation_id: text("operation_id").notNull(),
    page: integer("page").notNull().default(sql`0`),
    parent_id: text("parent_id").notNull().default(sql`''`),
    resource: text("resource").$type<Resource>().notNull(),
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
    id: text("id").notNull(),
    item_id: text("item_id").notNull(),
    operation_id: text("operation_id").notNull(),
    parent_id: text("parent_id").notNull(),
    processed: integer("processed").notNull().default(sql`0`),
    resource: text("resource").$type<Resource>().notNull(),
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
    progress: text("progress", { mode: "json" }).$type<PageCommit>().notNull(),
    step_key: text("step_key").notNull(),
  },
  (t) => [primaryKey({ columns: [t.operation_id, t.step_key] })],
);

export const inbox = sqliteTable(
  "inbox",
  {
    account_id: text("account_id").notNull(),
    event: text("event").notNull(),
    event_id: text("event_id").notNull(),

    item_id: text("item_id").notNull(),
    operation_id: text("operation_id"),
    payload: text("payload", { mode: "json" })
      .$type<Partial<WebhookEvent>>()
      .notNull(),
    processed_at: text("processed_at"),
    received_at: text("received_at").notNull(),
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
    imported_at: text("imported_at").notNull(),
    source_hash: text("source_hash").notNull(),
    source_key: text("source_key").notNull(),
  },
  (t) => [primaryKey({ columns: [t.source_key, t.source_hash] })],
);

export const effective_entities = sqliteView("effective_entities", {
  ...entityColumns(),
  category_id: text("category_id"),
  effective_category: text("effective_category"),
  effective_description: text("effective_description"),
  evidence: text("evidence", { mode: "json" }).$type<Derived["evidence"]>(),
  group_id: text("group_id"),
  ignored: integer("ignored"),
  rules_revision: text("rules_revision"),
}).existing();

export const portal_sessions = sqliteTable(
  "portal_sessions",
  {
    auth_version: text("auth_version").notNull(),
    csrf: text("csrf").notNull(),
    expires: integer("expires").notNull(),
    id: text("id").primaryKey().notNull(),
  },
  (t) => [index("portal_sessions_expiry").on(t.expires)],
);
export const login_attempts = sqliteTable("login_attempts", {
  attempts: integer("attempts").notNull(),
  expires: integer("expires").notNull(),
  id: text("id").primaryKey().notNull(),
});
