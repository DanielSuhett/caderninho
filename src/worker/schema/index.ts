import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

import type {
  Checkpoint,
  Classification,
  CollectionStatus,
  CommitResult,
  ProviderAccount,
  ProviderTransaction,
  RunStatus,
} from "../../domain";
export const settings = sqliteTable(
  "settings",
  {
    id: integer("id").primaryKey(),
    revision: integer("revision").notNull().default(0),
    syncEnabled: integer("sync_enabled").notNull().default(1),
  },
  (t) => [
    check("settings_singleton", sql`${t.id}=1`),
    check("revision_valid", sql`${t.revision}>=0`),
  ],
);
export const connections = sqliteTable("connections", {
  id: text("id").primaryKey(),
  lastAdmittedAt: text("last_admitted_at"),
  lastSuccessAt: text("last_success_at"),
  name: text("name").notNull(),
  nextImportAt: text("next_import_at"),
  observedAt: text("observed_at").notNull(),
  status: text("status").notNull(),
});
export const accounts = sqliteTable(
  "accounts",
  {
    balanceMinor: text("balance_minor"),
    collectionStatus: text("collection_status")
      .$type<CollectionStatus>()
      .notNull()
      .default("never"),
    connectionId: text("connection_id")
      .notNull()
      .references(() => connections.id),
    currency: text("currency").notNull(),
    error: text("error"),
    id: text("id").notNull(),
    lastAttemptAt: text("last_attempt_at"),
    lastCompletedFrom: text("last_completed_from"),
    lastCompletedRun: text("last_completed_run"),
    lastCompletedTo: text("last_completed_to"),
    lastSeenRun: text("last_seen_run").notNull(),
    lastSuccessAt: text("last_success_at"),
    name: text("name").notNull(),
    observedAt: text("observed_at").notNull(),
    observedFrom: text("observed_from"),
    observedTo: text("observed_to"),
    source: text("source", { mode: "json" }).$type<ProviderAccount>().notNull(),
    sourceUpdatedAt: text("source_updated_at"),
    type: text("type").$type<"BANK" | "CREDIT">().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.connectionId, t.id] }),
    check("account_json", sql`json_valid(source)`),
  ],
);
export const transactions = sqliteTable(
  "transactions",
  {
    accountId: text("account_id").notNull(),
    amountMinor: text("amount_minor"),
    category: text("category"),
    categoryOverride: text("category_override"),
    classification: text("classification").$type<Classification>().notNull(),
    connectionId: text("connection_id").notNull(),
    correctedAt: text("corrected_at"),
    currency: text("currency").notNull(),
    date: text("date").notNull(),
    description: text("description").notNull(),
    descriptionOverride: text("description_override"),
    direction: text("direction").$type<"DEBIT" | "CREDIT">().notNull(),
    evidence: text("evidence", { mode: "json" }).$type<string[]>().notNull(),
    id: text("id").notNull(),
    ignoredOverride: integer("ignored_override"),
    lastSeenRun: text("last_seen_run").notNull(),
    observedAt: text("observed_at").notNull(),
    source: text("source", { mode: "json" })
      .$type<ProviderTransaction>()
      .notNull(),
    sourceUpdatedAt: text("source_updated_at"),
    status: text("status").$type<"PENDING" | "POSTED">().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.connectionId, t.accountId, t.id] }),
    foreignKey({
      columns: [t.connectionId, t.accountId],
      foreignColumns: [accounts.connectionId, accounts.id],
    }),
    index("transaction_date").on(t.date, t.connectionId, t.accountId, t.id),
    index("transaction_account").on(t.connectionId, t.accountId, t.date, t.id),
    index("transaction_presence").on(
      t.connectionId,
      t.accountId,
      t.lastSeenRun,
      t.date,
      t.id,
    ),
    index("transaction_status").on(t.status, t.date),
    index("transaction_category").on(sql`coalesce(category_override,category)`),
    check("transaction_json", sql`json_valid(source)`),
    check("evidence_json", sql`json_valid(evidence)`),
    check(
      "ignored_boolean",
      sql`ignored_override IS NULL OR ignored_override IN (0,1)`,
    ),
  ],
);
export const sync_runs = sqliteTable(
  "sync_runs",
  {
    checkpoint: text("checkpoint", { mode: "json" })
      .$type<Checkpoint>()
      .notNull(),
    connectionId: text("connection_id")
      .notNull()
      .references(() => connections.id),
    createdAt: text("created_at").notNull(),
    error: text("error"),
    id: text("id").primaryKey(),
    lastCommitId: text("last_commit_id"),
    lastResult: text("last_result", { mode: "json" }).$type<CommitResult>(),
    records: integer("records").notNull().default(0),
    sequence: integer("sequence").notNull().default(0),
    status: text("status").$type<RunStatus>().notNull().default("pending"),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [
    uniqueIndex("one_active_import")
      .on(t.connectionId)
      .where(sql`status IN ('pending','running')`),
    index("run_created").on(t.createdAt),
    check("sequence_valid", sql`sequence>=0`),
    check("checkpoint_json", sql`json_valid(checkpoint)`),
  ],
);
export const portal_sessions = sqliteTable(
  "portal_sessions",
  {
    auth_version: text("auth_version").notNull(),
    csrf: text("csrf").notNull(),
    expires: integer("expires").notNull(),
    id: text("id").primaryKey(),
  },
  (t) => [index("sessions_expiry").on(t.expires)],
);
