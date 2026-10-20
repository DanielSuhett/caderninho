import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

import type {
  AccountMap,
  Checkpoint,
  CommitResult,
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
  accounts: text("accounts", { mode: "json" })
    .$type<AccountMap>()
    .notNull()
    .default({}),
  id: text("id").primaryKey(),
  lastAdmittedAt: text("last_admitted_at"),
  lastSuccessAt: text("last_success_at"),
  name: text("name").notNull(),
  nextImportAt: text("next_import_at"),
  observedAt: text("observed_at").notNull(),
  status: text("status").notNull(),
});
export const transactions = sqliteTable(
  "transactions",
  {
    accountId: text("account_id").notNull(),
    amountMinor: text("amount_minor"),
    category: text("category"),
    currency: text("currency").notNull(),
    date: text("date").notNull(),
    description: text("description").notNull(),
    direction: text("direction").$type<"DEBIT" | "CREDIT">().notNull(),
    id: text("id").primaryKey(),
    status: text("status").$type<"PENDING" | "POSTED">().notNull(),
  },
  (t) => [
    index("transaction_date").on(t.date, t.accountId, t.id),
    index("transaction_account").on(t.accountId, t.date, t.id),
    index("transaction_status").on(t.status, t.date),
    index("transaction_category").on(t.category),
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
