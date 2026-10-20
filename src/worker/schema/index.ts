import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

import type { AccountMap, Checkpoint, RunStatus } from "../../domain";
export const connections = sqliteTable(
  "connections",
  {
    accounts: text("accounts", { mode: "json" })
      .$type<AccountMap>()
      .notNull()
      .default({}),
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
