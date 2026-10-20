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
  taxNumber?: string | null | undefined;
  type: "BANK" | "CREDIT";
  updatedAt?: string | null | undefined;
  [field: string]: unknown;
}
export interface ProviderTransaction {
  accountId: string;
  amount: string | number | null;
  category?: string | null | undefined;
  currencyCode: string;
  date: string;
  description: string;
  id: string;
  merchant?: { name?: string | null | undefined } | null | undefined;
  operationType?: string | null | undefined;
  paymentData?:
    | {
        paymentMethod?: string | null | undefined;
        payer?:
          | {
              documentNumber?:
                | { value?: string | null | undefined }
                | null
                | undefined;
            }
          | null
          | undefined;
        receiver?:
          | {
              documentNumber?:
                | { value?: string | null | undefined }
                | null
                | undefined;
            }
          | null
          | undefined;
      }
    | null
    | undefined;
  status: "PENDING" | "POSTED";
  type: "DEBIT" | "CREDIT";
  updatedAt?: string | null | undefined;
  [field: string]: unknown;
}
export interface TransactionPage {
  next: string | null;
  records: ProviderTransaction[];
}
