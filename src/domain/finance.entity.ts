import type { FinancialIdentity } from "./financial-identity.entity";
import type { AccountDetails, TransactionDetails } from "./planning.entity";
import type { TransactionIdentification } from "./transaction.entity";

export const AccountType = { BANK: "BANK", CREDIT: "CREDIT" } as const;
export type AccountType = (typeof AccountType)[keyof typeof AccountType];

export const TransactionDirection = {
  CREDIT: "CREDIT",
  DEBIT: "DEBIT",
} as const;
export type TransactionDirection =
  (typeof TransactionDirection)[keyof typeof TransactionDirection];

export const TransactionStatus = {
  PENDING: "PENDING",
  POSTED: "POSTED",
} as const;
export type TransactionStatus =
  (typeof TransactionStatus)[keyof typeof TransactionStatus];

export interface AccountMetadata {
  balanceMinor: string | null;
  balanceObservedAt: string | null;
  currency: string;
  // Hash of "COMPE/agência/conta"; lets a second item of the same account be
  // recognized. Never leaves the server.
  holderKey?: string | undefined;
  identity?: FinancialIdentity | null | undefined;
  name: string;
  type: AccountType;
}
export type AccountMap = Record<string, AccountMetadata>;
export interface AccountProjection
  extends Omit<AccountMetadata, "balanceObservedAt"> {
  details?: AccountDetails;
  id: string;
}
export interface TransactionProjection {
  accountId: string;
  amountMinor: string | null;
  category: string | null;
  currency: string;
  date: string;
  description: string;
  details?: TransactionDetails;
  direction: TransactionDirection;
  id: string;
  identification?: TransactionIdentification | null | undefined;
  status: TransactionStatus;
}
