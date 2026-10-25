import { desc, sql } from "drizzle-orm";
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
  CategoryGroup,
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
  TransactionClassification,
  TransactionDetails,
  TransactionDirection,
  TransactionEdit,
  TransactionIdentification,
  TransactionStatus,
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
    classification: text("classification", {
      mode: "json",
    }).$type<TransactionClassification>(),
    currency: text("currency").notNull(),
    date: text("date").notNull(),
    description: text("description").notNull(),
    direction: text("direction").$type<TransactionDirection>().notNull(),
    id: text("id").primaryKey(),
    identification: text("identification", {
      mode: "json",
    }).$type<TransactionIdentification>(),
    status: text("status").$type<TransactionStatus>().notNull(),
  },
  (t) => [
    check(
      "transaction_classification_json",
      sql`${t.classification} IS NULL OR json_valid(${t.classification})`,
    ),
    check(
      "transaction_identification_json",
      sql`${t.identification} IS NULL OR json_valid(${t.identification})`,
    ),
    index("transaction_date").on(t.date, t.accountId, t.id),
    index("transaction_account").on(t.accountId, t.date, t.id),
    index("transaction_status").on(t.status, t.date, t.accountId, t.id),
    index("transaction_category").on(t.category, t.date, t.accountId, t.id),
    index("transaction_posted_totals")
      .on(
        t.direction,
        t.currency,
        t.date,
        t.accountId,
        t.amountMinor,
        t.category,
      )
      .where(sql`${t.status}='POSTED'`),
  ],
);

export const planningSpaces = sqliteTable("planning_spaces", {
  data: text("data", { mode: "json" }).$type<Space>().notNull(),
  id: text("id").primaryKey(),
});
export const planningCategoryGroups = sqliteTable("planning_category_groups", {
  data: text("data", { mode: "json" }).$type<CategoryGroup>().notNull(),
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
  result: text("result", { mode: "json" })
    .$type<Record<string, unknown>>()
    .notNull(),
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

export const syncHistory = sqliteTable(
  "sync_history",
  {
    admittedAt: text("admitted_at").notNull(),
    connectionId: text("connection_id").notNull(),
    error: text("error"),
    finishedAt: text("finished_at"),
    id: text("id").primaryKey(),
    legacy: integer("legacy", { mode: "boolean" }).notNull().default(false),
    personId: text("person_id").notNull(),
    phase: text("phase"),
    profileId: text("profile_id").notNull(),
    sequence: integer("sequence").notNull(),
    status: text("status").$type<RunStatus>().notNull(),
  },
  (t) => [
    index("sync_history_order").on(desc(t.admittedAt), desc(t.id)),
    index("sync_history_person").on(t.personId, desc(t.admittedAt), desc(t.id)),
    index("sync_history_status").on(t.status, desc(t.admittedAt), desc(t.id)),
  ],
);

export const mcpAudit = sqliteTable(
  "mcp_audit",
  {
    clientId: text("client_id"),
    durationMs: integer("duration_ms").notNull(),
    id: text("id").primaryKey(),
    inputBytes: integer("input_bytes").notNull(),
    model: text("model"),
    outcome: text("outcome")
      .$type<"success" | "failed" | "cancelled">()
      .notNull(),
    outputBytes: integer("output_bytes").notNull(),
    startedAt: text("started_at").notNull(),
    status: integer("status").notNull(),
    tool: text("tool"),
  },
  (t) => [
    index("mcp_audit_time").on(desc(t.startedAt), desc(t.id)),
    index("mcp_audit_client").on(t.clientId, desc(t.startedAt)),
  ],
);
