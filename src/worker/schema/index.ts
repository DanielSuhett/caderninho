import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

import type {
  AccountDetails,
  AccountMap,
  AccountSettings,
  Bill,
  BillPayment,
  CardSettings,
  Category,
  Checkpoint,
  Contribution,
  Goal,
  Installment,
  Investment,
  Loan,
  NotificationPreference,
  Recurrence,
  Rule,
  RunStatus,
  ScheduledPayment,
  Space,
  Tag,
  TransactionDetails,
  TransactionEdit,
} from "../../domain";
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

export const planningSpaces = sqliteTable("planning_spaces", {
  data: text("data", { mode: "json" }).$type<Space>().notNull(),
  id: text("id").primaryKey(),
});
export const planningAccounts = sqliteTable("planning_accounts", {
  data: text("data", { mode: "json" }).$type<AccountSettings>().notNull(),
  id: text("id").primaryKey(),
});
export const planningCards = sqliteTable("planning_cards", {
  data: text("data", { mode: "json" }).$type<CardSettings>().notNull(),
  id: text("id").primaryKey(),
});
export const planningEdits = sqliteTable("planning_edits", {
  data: text("data", { mode: "json" }).$type<TransactionEdit>().notNull(),
  id: text("id").primaryKey(),
});
export const planningCategories = sqliteTable("planning_categories", {
  data: text("data", { mode: "json" }).$type<Category>().notNull(),
  id: text("id").primaryKey(),
});
export const planningTags = sqliteTable("planning_tags", {
  data: text("data", { mode: "json" }).$type<Tag>().notNull(),
  id: text("id").primaryKey(),
});
export const planningRules = sqliteTable("planning_rules", {
  data: text("data", { mode: "json" }).$type<Rule>().notNull(),
  id: text("id").primaryKey(),
});
export const planningRecurrences = sqliteTable("planning_recurrences", {
  data: text("data", { mode: "json" }).$type<Recurrence>().notNull(),
  id: text("id").primaryKey(),
});
export const planningInstallments = sqliteTable("planning_installments", {
  data: text("data", { mode: "json" }).$type<Installment>().notNull(),
  id: text("id").primaryKey(),
});
export const planningGoals = sqliteTable("planning_goals", {
  data: text("data", { mode: "json" }).$type<Goal>().notNull(),
  id: text("id").primaryKey(),
});
export const planningContributions = sqliteTable("planning_contributions", {
  data: text("data", { mode: "json" }).$type<Contribution>().notNull(),
  id: text("id").primaryKey(),
});
export const planningInvestments = sqliteTable("planning_investments", {
  data: text("data", { mode: "json" }).$type<Investment>().notNull(),
  id: text("id").primaryKey(),
});
export const planningLoans = sqliteTable("planning_loans", {
  data: text("data", { mode: "json" }).$type<Loan>().notNull(),
  id: text("id").primaryKey(),
});
export const planningSchedules = sqliteTable("planning_schedules", {
  data: text("data", { mode: "json" }).$type<ScheduledPayment>().notNull(),
  id: text("id").primaryKey(),
});
export const planningBillPayments = sqliteTable("planning_billPayments", {
  data: text("data", { mode: "json" }).$type<BillPayment>().notNull(),
  id: text("id").primaryKey(),
});
export const planningNotifications = sqliteTable("planning_notifications", {
  data: text("data", { mode: "json" })
    .$type<NotificationPreference>()
    .notNull(),
  id: text("id").primaryKey(),
});
export const planningBills = sqliteTable("planning_bills", {
  data: text("data", { mode: "json" }).$type<Bill>().notNull(),
  id: text("id").primaryKey(),
});
export const planningAccountDetails = sqliteTable("planning_accountDetails", {
  data: text("data", { mode: "json" }).$type<AccountDetails>().notNull(),
  id: text("id").primaryKey(),
});
export const planningTransactionDetails = sqliteTable(
  "planning_transactionDetails",
  {
    data: text("data", { mode: "json" }).$type<TransactionDetails>().notNull(),
    id: text("id").primaryKey(),
  },
);
export const planningRevision = sqliteTable("planning_revision", {
  id: integer("id").primaryKey(),
  revision: integer("revision").notNull(),
});
export const planningReceipts = sqliteTable("planning_receipts", {
  createdAt: text("created_at").notNull(),
  digest: text("digest").notNull(),
  id: text("id").primaryKey(),
  result: text("result", { mode: "json" }).$type<unknown>().notNull(),
});

export const people = sqliteTable("people", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
});
export const pluggyProfiles = sqliteTable("pluggy_profiles", {
  clientFingerprint: text("client_fingerprint").unique(),
  credentialRef: text("credential_ref"),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  personId: text("person_id")
    .notNull()
    .references(() => people.id),
});
export const connectionOwners = sqliteTable("connection_owners", {
  connectionId: text("connection_id")
    .primaryKey()
    .references(() => connections.id, { onDelete: "cascade" }),
  personId: text("person_id")
    .notNull()
    .references(() => people.id),
  profileId: text("profile_id")
    .notNull()
    .references(() => pluggyProfiles.id),
});
