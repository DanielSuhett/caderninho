export interface Credentials {
  clientId: string;
  clientSecret: string;
}
export type MoneyInput = string | number | null | undefined;
export interface ProviderConnection {
  connector?: { id: string | number; name?: string | undefined } | undefined;
  id: string;
  status?: string | undefined;
}
export interface ProviderAccount {
  balance?: MoneyInput;
  currencyCode: string;
  id: string;
  itemId: string;
  name: string;
  type: "BANK" | "CREDIT";
  updatedAt?: string | null | undefined;
}
export interface ProviderTransaction {
  accountId: string;
  amount: string | number | null;
  category?: string | null | undefined;
  currencyCode: string;
  date: string;
  description: string;
  id: string;
  status: "PENDING" | "POSTED";
  type: "DEBIT" | "CREDIT";
}
export interface TransactionPage {
  next: string | null;
  records: ProviderTransaction[];
}
