import type { TransactionClassification } from "./category.entity";
import type { AccountDetails, TransactionDetails } from "./planning.entity";
import type { TransactionIdentification } from "./transaction.entity";
export interface AccountMetadata {
  balanceMinor: string | null;
  balanceObservedAt: string | null;
  currency: string;
  identity?:
    | import("./financial-identity.entity").FinancialIdentity
    | null
    | undefined;
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
  classification?: TransactionClassification | null | undefined;
  currency: string;
  date: string;
  description: string;
  details?: TransactionDetails;
  direction: "DEBIT" | "CREDIT";
  id: string;
  identification?: TransactionIdentification | null | undefined;
  status: "PENDING" | "POSTED";
}
