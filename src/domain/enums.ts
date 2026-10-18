export const Resource = {
  accounts: "accounts",
  bills: "bills",
  categories: "categories",
  connections: "connections",
  connectors: "connectors",
  consents: "consents",
  identity: "identity",
  investment_transactions: "investment_transactions",
  investments: "investments",
  loans: "loans",
  resources: "resources",
  statements: "statements",
  transactions: "transactions",
} as const;

export type Resource = (typeof Resource)[keyof typeof Resource];

export const EntityChange = {
  changed: "changed",
  new: "new",
  unchanged: "unchanged",
} as const;

export const TagOrigin = {
  derived: "derived",
  manual: "manual",
} as const;

export const FaultCode = {
  ACCOUNT_NOT_IN_SNAPSHOT: "ACCOUNT_NOT_IN_SNAPSHOT",
  ACCOUNTS_INCOMPLETE: "ACCOUNTS_INCOMPLETE",
  AUTH_NOT_CONFIGURED: "AUTH_NOT_CONFIGURED",
  BANK_ACCOUNT_REQUIRED: "BANK_ACCOUNT_REQUIRED",
  CONCURRENT_IMPORT: "CONCURRENT_IMPORT",
  CONCURRENT_PUBLICATION: "CONCURRENT_PUBLICATION",
  CONCURRENT_RESUME: "CONCURRENT_RESUME",
  CONNECTION_INCOMPLETE: "CONNECTION_INCOMPLETE",
  CONNECTION_PROCESSING: "CONNECTION_PROCESSING",
  COUNT_OPERATION_REQUIRED: "COUNT_OPERATION_REQUIRED",
  CURRENCY_COMPARISON_MISMATCH: "CURRENCY_COMPARISON_MISMATCH",
  CURRENCY_REQUIRED: "CURRENCY_REQUIRED",
  CURRENCY_SCALE_UNSUPPORTED: "CURRENCY_SCALE_UNSUPPORTED",
  CURSOR_LOOP: "CURSOR_LOOP",
  DECIMAL_RANGE: "DECIMAL_RANGE",
  DETAIL_MISMATCH: "DETAIL_MISMATCH",
  DOCUMENT_HOST_NOT_ALLOWED: "DOCUMENT_HOST_NOT_ALLOWED",
  DOCUMENT_TOO_LARGE: "DOCUMENT_TOO_LARGE",
  DUPLICATE_CHANGED: "DUPLICATE_CHANGED",
  DUPLICATE_ID: "DUPLICATE_ID",
  FIELD_NOT_ALLOWED: "FIELD_NOT_ALLOWED",
  FIELD_TOO_LARGE: "FIELD_TOO_LARGE",
  FILTER_NOT_SUPPORTED: "FILTER_NOT_SUPPORTED",
  GROUP_NOT_ALLOWED: "GROUP_NOT_ALLOWED",
  INCOMPLETE_PAGE: "INCOMPLETE_PAGE",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  INVALID_ACCOUNT: "INVALID_ACCOUNT",
  INVALID_ARGUMENT: "INVALID_ARGUMENT",
  INVALID_CURRENCY: "INVALID_CURRENCY",
  INVALID_CURSOR: "INVALID_CURSOR",
  INVALID_DATE: "INVALID_DATE",
  INVALID_DECIMAL: "INVALID_DECIMAL",
  INVALID_FILTER: "INVALID_FILTER",
  INVALID_ID: "INVALID_ID",
  INVALID_ITEM_ID: "INVALID_ITEM_ID",
  INVALID_MODE: "INVALID_MODE",
  INVALID_MONEY: "INVALID_MONEY",
  INVALID_PAGE: "INVALID_PAGE",
  INVALID_RESPONSE: "INVALID_RESPONSE",
  INVALID_SORT: "INVALID_SORT",
  INVALID_STATUS: "INVALID_STATUS",
  INVALID_TRANSACTION: "INVALID_TRANSACTION",
  INVALID_TYPE: "INVALID_TYPE",
  ITEM_PAGE_LIMIT: "ITEM_PAGE_LIMIT",
  LIVE_BALANCE_ACCOUNT_REQUIRED: "LIVE_BALANCE_ACCOUNT_REQUIRED",
  LIVE_DETAIL_UNSUPPORTED: "LIVE_DETAIL_UNSUPPORTED",
  METRIC_NOT_ALLOWED: "METRIC_NOT_ALLOWED",
  MONEY_PRECISION_UNSUPPORTED: "MONEY_PRECISION_UNSUPPORTED",
  NO_ACCOUNTS: "NO_ACCOUNTS",
  NOT_INITIALIZED: "NOT_INITIALIZED",
  PAGE_LIMIT: "PAGE_LIMIT",
  PAGINATION_UNDOCUMENTED: "PAGINATION_UNDOCUMENTED",
  PARENT_MISMATCH: "PARENT_MISMATCH",
  PARENT_SNAPSHOT_REQUIRED: "PARENT_SNAPSHOT_REQUIRED",
  PERIOD_LIMIT: "PERIOD_LIMIT",
  PERIOD_REQUIRED: "PERIOD_REQUIRED",
  QUERY_CACHED_ONLY: "QUERY_CACHED_ONLY",
  QUERY_LIMIT: "QUERY_LIMIT",
  REAL_CONNECTION_REQUIRED: "REAL_CONNECTION_REQUIRED",
  RESUME_ARGUMENT_CONFLICT: "RESUME_ARGUMENT_CONFLICT",
  RESUME_NOT_FOUND: "RESUME_NOT_FOUND",
  SNAPSHOT_CORRUPT: "SNAPSHOT_CORRUPT",
  SNAPSHOT_LIMIT: "SNAPSHOT_LIMIT",
  SNAPSHOT_NOT_FOUND: "SNAPSHOT_NOT_FOUND",
  SNAPSHOT_REQUIRED: "SNAPSHOT_REQUIRED",
  SORT_NOT_ALLOWED: "SORT_NOT_ALLOWED",
  SOURCE_CHANGED: "SOURCE_CHANGED",
  STATEMENT_UNAVAILABLE: "STATEMENT_UNAVAILABLE",
  STORAGE_NOT_CONFIGURED: "STORAGE_NOT_CONFIGURED",
  SYNC_CHANGED_RETRY: "SYNC_CHANGED_RETRY",
  TOTAL_OVERFLOW: "TOTAL_OVERFLOW",
  TRANSACTIONS_NOT_ENABLED: "TRANSACTIONS_NOT_ENABLED",
  UNKNOWN_TOOL: "UNKNOWN_TOOL",
  UPSTREAM_AUTH: "UPSTREAM_AUTH",
  UPSTREAM_ERROR: "UPSTREAM_ERROR",
  UPSTREAM_FORBIDDEN: "UPSTREAM_FORBIDDEN",
  UPSTREAM_INVALID_REQUEST: "UPSTREAM_INVALID_REQUEST",
  UPSTREAM_NOT_FOUND: "UPSTREAM_NOT_FOUND",
  UPSTREAM_RATE_LIMIT: "UPSTREAM_RATE_LIMIT",
  UPSTREAM_REDIRECT: "UPSTREAM_REDIRECT",
  UPSTREAM_TIMEOUT: "UPSTREAM_TIMEOUT",
  UPSTREAM_TOO_LARGE: "UPSTREAM_TOO_LARGE",
  UPSTREAM_UNAVAILABLE: "UPSTREAM_UNAVAILABLE",
} as const;

export type FaultCode = (typeof FaultCode)[keyof typeof FaultCode];

export const AccountType = {
  BANK: "BANK",
  CREDIT: "CREDIT",
} as const;

export type AccountType = (typeof AccountType)[keyof typeof AccountType];

export const TransactionType = {
  CREDIT: "CREDIT",
  DEBIT: "DEBIT",
} as const;

export type TransactionType =
  (typeof TransactionType)[keyof typeof TransactionType];

export const TransactionStatus = {
  PENDING: "PENDING",
  POSTED: "POSTED",
} as const;

export type TransactionStatus =
  (typeof TransactionStatus)[keyof typeof TransactionStatus];

export const Availability = {
  available: "available",
  empty_verified: "empty_verified",
  error: "error",
  not_authorized: "not_authorized",
  not_enabled: "not_enabled",
  not_synced: "not_synced",
  partial: "partial",
  stale: "stale",
  unsupported: "unsupported",
} as const;

export type Availability = (typeof Availability)[keyof typeof Availability];

export const CoverageStatus = {
  available: "available",
  empty: "empty",
  not_authorized: "not_authorized",
  not_enabled: "not_enabled",
  partial: "partial",
  unavailable: "unavailable",
  unsupported: "unsupported",
} as const;
export type CoverageStatus =
  (typeof CoverageStatus)[keyof typeof CoverageStatus];

export const Classification = {
  bill_payment: "bill_payment",
  bill_payment_category: "bill_payment_category",
  consumption_evidence: "consumption_evidence",
  own_transfer: "own_transfer",
  patrimonial_category: "patrimonial_category",
  refund: "refund",
  transfer_uncertain: "transfer_uncertain",
  unknown: "unknown",
} as const;

export type Classification =
  (typeof Classification)[keyof typeof Classification];

export const RecurrenceClassification = {
  possible_subscription: "possible_subscription",
  recurring_expense: "recurring_expense",
  recurring_payment: "recurring_payment",
} as const;

export type RecurrenceClassification =
  (typeof RecurrenceClassification)[keyof typeof RecurrenceClassification];

export const Periodicity = {
  annual: "annual",
  insufficient_history: "insufficient_history",
  irregular: "irregular",
  monthly: "monthly",
  quarterly: "quarterly",
  weekly: "weekly",
} as const;

export type Periodicity = (typeof Periodicity)[keyof typeof Periodicity];

export const RecurrenceStrength = {
  limited: "limited",
  moderate: "moderate",
  strong: "strong",
} as const;

export type RecurrenceStrength =
  (typeof RecurrenceStrength)[keyof typeof RecurrenceStrength];

export const PaymentMethod = {
  BOLETO: "BOLETO",
  DOC: "DOC",
  PIX: "PIX",
  TED: "TED",
  TEV: "TEV",
} as const;

export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod];

export const ProvenanceOrigin = {
  local_derivation: "local_derivation",
  pluggy_enrichment: "pluggy_enrichment",
  provider_via_pluggy: "provider_via_pluggy",
} as const;

export type ProvenanceOrigin =
  (typeof ProvenanceOrigin)[keyof typeof ProvenanceOrigin];

export const Product = {
  ACCOUNTS: "ACCOUNTS",
  CREDIT_CARDS: "CREDIT_CARDS",
  IDENTITY: "IDENTITY",
  INVESTMENTS: "INVESTMENTS",
  INVESTMENTS_TRANSACTIONS: "INVESTMENTS_TRANSACTIONS",
  LOANS: "LOANS",
  TRANSACTIONS: "TRANSACTIONS",
} as const;

export type Product = (typeof Product)[keyof typeof Product];
