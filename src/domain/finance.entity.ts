export type { MoneyInput } from "./provider.entity";
export interface TransactionReference {
  accountId: string;
  id: string;
}
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
  id: string;
}
export interface TransactionProjection extends TransactionReference {
  amountMinor: string | null;
  category: string | null;
  currency: string;
  date: string;
  description: string;
  direction: "DEBIT" | "CREDIT";
  status: "PENDING" | "POSTED";
}
