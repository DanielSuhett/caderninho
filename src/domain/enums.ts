import { z } from "zod/v4";

export const ResourceSchema = z.enum([
  "accounts",
  "transactions",
  "investments",
  "investment_transactions",
  "bills",
  "loans",
  "identity",
  "connections",
  "resources",
  "consents",
  "connectors",
  "categories",
  "statements",
]);

export const Resource = ResourceSchema.enum;

export type Resource = z.infer<typeof ResourceSchema>;

export const FaultCodeSchema = z.enum([
  "ACCOUNTS_INCOMPLETE",
  "ACCOUNT_NOT_IN_SNAPSHOT",
  "AUTH_NOT_CONFIGURED",
  "BANK_ACCOUNT_REQUIRED",
  "CONCURRENT_IMPORT",
  "CONCURRENT_PUBLICATION",
  "CONCURRENT_RESUME",
  "CONNECTION_INCOMPLETE",
  "CONNECTION_PROCESSING",
  "COUNT_OPERATION_REQUIRED",
  "CURRENCY_COMPARISON_MISMATCH",
  "CURRENCY_REQUIRED",
  "CURRENCY_SCALE_UNSUPPORTED",
  "CURSOR_LOOP",
  "DECIMAL_RANGE",
  "DETAIL_MISMATCH",
  "DOCUMENT_HOST_NOT_ALLOWED",
  "DOCUMENT_TOO_LARGE",
  "DUPLICATE_CHANGED",
  "DUPLICATE_ID",
  "FIELD_NOT_ALLOWED",
  "FIELD_TOO_LARGE",
  "FILTER_NOT_SUPPORTED",
  "GROUP_NOT_ALLOWED",
  "INCOMPLETE_PAGE",
  "INTERNAL_ERROR",
  "INVALID_ACCOUNT",
  "INVALID_ARGUMENT",
  "INVALID_CURRENCY",
  "INVALID_CURSOR",
  "INVALID_DATE",
  "INVALID_DECIMAL",
  "INVALID_FILTER",
  "INVALID_ID",
  "INVALID_ITEM_ID",
  "INVALID_MODE",
  "INVALID_MONEY",
  "INVALID_PAGE",
  "INVALID_RESPONSE",
  "INVALID_SORT",
  "INVALID_STATUS",
  "INVALID_TRANSACTION",
  "INVALID_TYPE",
  "ITEM_BINDING_REQUIRED",
  "ITEM_LIST_NOT_ENABLED",
  "ITEM_NOT_AUTHORIZED",
  "ITEM_PAGE_LIMIT",
  "LIVE_BALANCE_ACCOUNT_REQUIRED",
  "LIVE_DETAIL_UNSUPPORTED",
  "METRIC_NOT_ALLOWED",
  "MONEY_PRECISION_UNSUPPORTED",
  "NOT_INITIALIZED",
  "NO_ACCOUNTS",
  "OPERATION_NOT_ALLOWED",
  "PAGE_LIMIT",
  "PAGINATION_UNDOCUMENTED",
  "PARENT_MISMATCH",
  "PARENT_NOT_AUTHORIZED",
  "PARENT_SNAPSHOT_REQUIRED",
  "PERIOD_LIMIT",
  "PERIOD_REQUIRED",
  "QUERY_CACHED_ONLY",
  "QUERY_LIMIT",
  "REAL_CONNECTION_REQUIRED",
  "RECORD_NOT_AUTHORIZED_OR_NOT_IN_SNAPSHOT",
  "RESOURCE_NOT_ALLOWED",
  "RESUME_ARGUMENT_CONFLICT",
  "RESUME_NOT_AUTHORIZED",
  "RESUME_NOT_FOUND",
  "SNAPSHOT_CORRUPT",
  "SNAPSHOT_LIMIT",
  "SNAPSHOT_NOT_AUTHORIZED",
  "SNAPSHOT_NOT_FOUND",
  "SNAPSHOT_REQUIRED",
  "SORT_NOT_ALLOWED",
  "SOURCE_CHANGED",
  "STATEMENT_UNAVAILABLE",
  "STORAGE_NOT_CONFIGURED",
  "SYNC_CHANGED_RETRY",
  "TOTAL_OVERFLOW",
  "TRANSACTIONS_NOT_ENABLED",
  "UNAUTHORIZED",
  "UNKNOWN_TOOL",
  "UPSTREAM_AUTH",
  "UPSTREAM_ERROR",
  "UPSTREAM_FORBIDDEN",
  "UPSTREAM_INVALID_REQUEST",
  "UPSTREAM_NOT_FOUND",
  "UPSTREAM_RATE_LIMIT",
  "UPSTREAM_REDIRECT",
  "UPSTREAM_TIMEOUT",
  "UPSTREAM_TOO_LARGE",
  "UPSTREAM_UNAVAILABLE",
]);

export const FaultCode = FaultCodeSchema.enum;

export type FaultCode = z.infer<typeof FaultCodeSchema>;

export const AccountTypeSchema = z.enum(["BANK", "CREDIT"]);

export const AccountType = AccountTypeSchema.enum;

export type AccountType = z.infer<typeof AccountTypeSchema>;

export const TransactionTypeSchema = z.enum(["DEBIT", "CREDIT"]);

export const TransactionType = TransactionTypeSchema.enum;

export type TransactionType = z.infer<typeof TransactionTypeSchema>;

export const TransactionStatusSchema = z.enum(["POSTED", "PENDING"]);

export const TransactionStatus = TransactionStatusSchema.enum;

export type TransactionStatus = z.infer<typeof TransactionStatusSchema>;

export const AvailabilitySchema = z.enum([
  "available",
  "empty_verified",
  "unsupported",
  "not_authorized",
  "not_enabled",
  "not_synced",
  "partial",
  "stale",
  "error",
]);

export const Availability = AvailabilitySchema.enum;

export type Availability = z.infer<typeof AvailabilitySchema>;

export const ClassificationSchema = z.enum([
  "unknown",
  "own_transfer",
  "bill_payment",
  "bill_payment_category",
  "refund",
  "patrimonial_category",
  "transfer_uncertain",
  "consumption_evidence",
]);

export const Classification = ClassificationSchema.enum;

export type Classification = z.infer<typeof ClassificationSchema>;

export const RecurrenceClassificationSchema = z.enum([
  "possible_subscription",
  "recurring_expense",
  "recurring_payment",
]);

export const RecurrenceClassification = RecurrenceClassificationSchema.enum;

export type RecurrenceClassification = z.infer<
  typeof RecurrenceClassificationSchema
>;

export const PeriodicitySchema = z.enum([
  "weekly",
  "monthly",
  "quarterly",
  "annual",
  "irregular",
  "insufficient_history",
]);

export const Periodicity = PeriodicitySchema.enum;

export type Periodicity = z.infer<typeof PeriodicitySchema>;

export const RecurrenceStrengthSchema = z.enum([
  "limited",
  "moderate",
  "strong",
]);

export const RecurrenceStrength = RecurrenceStrengthSchema.enum;

export type RecurrenceStrength = z.infer<typeof RecurrenceStrengthSchema>;

export const PaymentMethodSchema = z.enum([
  "PIX",
  "TED",
  "DOC",
  "TEV",
  "BOLETO",
]);

export const PaymentMethod = PaymentMethodSchema.enum;

export type PaymentMethod = z.infer<typeof PaymentMethodSchema>;

export const ProvenanceOriginSchema = z.enum([
  "local_derivation",
  "pluggy_enrichment",
  "provider_via_pluggy",
]);

export const ProvenanceOrigin = ProvenanceOriginSchema.enum;

export type ProvenanceOrigin = z.infer<typeof ProvenanceOriginSchema>;

export const ProductSchema = z.enum([
  "ACCOUNTS",
  "TRANSACTIONS",
  "INVESTMENTS",
  "INVESTMENTS_TRANSACTIONS",
  "CREDIT_CARDS",
  "LOANS",
  "IDENTITY",
]);

export const Product = ProductSchema.enum;

export type Product = z.infer<typeof ProductSchema>;
