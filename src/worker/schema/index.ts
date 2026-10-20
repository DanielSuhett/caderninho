import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

import type { Checkpoint, CollectionStatus, RunStatus } from "../../domain";
export const connections = sqliteTable(
  "connections",
  {
    id: text("id").primaryKey(),
    importAdmittedAt: text("import_admitted_at"),
    importCheckpoint: text("import_checkpoint", {
      mode: "json",
    }).$type<Checkpoint>(),
    importError: text("import_error"),
    importId: text("import_id"),
    importSequence: integer("import_sequence").notNull().default(0),
    importStatus: text("import_status").$type<RunStatus>(),
    lastSuccessAt: text("last_success_at"),
  },
  (t) => [
    check("sequence_valid", sql`${t.importSequence}>=0`),
    check(
      "checkpoint_json",
      sql`${t.importCheckpoint} IS NULL OR json_valid(${t.importCheckpoint})`,
    ),
  ],
);
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
    lastCompletedTo: text("last_completed_to"),
    lastSeenRun: text("last_seen_run").notNull(),
    lastSuccessAt: text("last_success_at"),
    name: text("name").notNull(),
    observedAt: text("observed_at").notNull(),
    observedFrom: text("observed_from"),
    observedTo: text("observed_to"),
    sourceUpdatedAt: text("source_updated_at"),
    type: text("type").$type<"BANK" | "CREDIT">().notNull(),
  },
  (t) => [primaryKey({ columns: [t.connectionId, t.id] })],
);
export const transactions = sqliteTable(
  "transactions",
  {
    accountId: text("account_id").notNull(),
    amountMinor: text("amount_minor"),
    category: text("category"),
    connectionId: text("connection_id").notNull(),
    currency: text("currency").notNull(),
    date: text("date").notNull(),
    description: text("description").notNull(),
    direction: text("direction").$type<"DEBIT" | "CREDIT">().notNull(),
    id: text("id").notNull(),
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
    index("transaction_status").on(t.status, t.date),
    index("transaction_category").on(t.category),
  ],
);
