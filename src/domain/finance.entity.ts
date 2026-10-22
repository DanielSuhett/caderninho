import type { AccountDetails, TransactionDetails } from "./planning.entity";
export interface AccountMetadata {
  balanceMinor: string | null;
  balanceObservedAt: string | null;
  currency: string;
  name: string;
  type: "BANK" | "CREDIT";
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
  direction: "DEBIT" | "CREDIT";
  id: string;
  status: "PENDING" | "POSTED";
}
