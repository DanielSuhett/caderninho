export const FaultCode = {
  CURRENCY_SCALE_UNSUPPORTED: "CURRENCY_SCALE_UNSUPPORTED",
  DECIMAL_RANGE: "DECIMAL_RANGE",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  INVALID_ARGUMENT: "INVALID_ARGUMENT",
  INVALID_DATE: "INVALID_DATE",
  INVALID_DECIMAL: "INVALID_DECIMAL",
  INVALID_ID: "INVALID_ID",
  INVALID_RESPONSE: "INVALID_RESPONSE",
  MONEY_PRECISION_UNSUPPORTED: "MONEY_PRECISION_UNSUPPORTED",
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
