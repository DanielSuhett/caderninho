export interface Credentials {
  clientId: string;
  clientSecret: string;
}
export type MoneyInput = string | number | null | undefined;
export interface ProviderConnection {
  connector?: { id: string | number } | undefined;
  id: string;
}
export interface ProviderAccount {
  balance?: MoneyInput;
  creditData?:
    | {
        creditLimit?: MoneyInput;
        availableCreditLimit?: MoneyInput;
        balanceCloseDate?: string | null | undefined;
        balanceDueDate?: string | null | undefined;
      }
    | null
    | undefined;
  currencyCode: string;
  id: string;
  itemId: string;
  name: string;
  number?: string | null | undefined;
  type: "BANK" | "CREDIT";
}
export interface ProviderTransaction {
  accountId: string;
  amount: string | number | null;
  category?: string | null | undefined;
  creditCardMetadata?:
    | {
        billId?: string | null | undefined;
        cardNumber?: string | null | undefined;
        installmentNumber?: number | null | undefined;
        totalInstallments?: number | null | undefined;
        purchaseDate?: string | null | undefined;
      }
    | null
    | undefined;
  currencyCode: string;
  date: string;
  description: string;
  id: string;
  operationType?: string | null | undefined;
  status: "PENDING" | "POSTED";
  type: "DEBIT" | "CREDIT";
}
export interface TransactionPage {
  next: string | null;
  records: ProviderTransaction[];
}
