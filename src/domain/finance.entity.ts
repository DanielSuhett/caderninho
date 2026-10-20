import type { Classification } from "./enums";
import type { ProviderAccount, ProviderTransaction } from "./provider.entity";

export type { MoneyInput } from "./provider.entity";
export interface AccountReference {
  accountId: string;
  connectionId: string;
}
export interface TransactionReference extends AccountReference {
  id: string;
}
export interface AccountProjection {
  balanceMinor: string | null;
  connectionId: string;
  currency: string;
  id: string;
  name: string;
  source: ProviderAccount;
  sourceUpdatedAt: string | null;
  type: "BANK" | "CREDIT";
}
export interface TransactionProjection extends TransactionReference {
  amountMinor: string | null;
  category: string | null;
  classification: Classification;
  currency: string;
  date: string;
  description: string;
  direction: "DEBIT" | "CREDIT";
  evidence: string[];
  source: ProviderTransaction;
  sourceUpdatedAt: string | null;
  status: "PENDING" | "POSTED";
}
export const CollectionStatus = {
  collecting: "collecting",
  complete: "complete",
  never: "never",
  partial: "partial",
  unavailable: "unavailable",
} as const;
export type CollectionStatus =
  (typeof CollectionStatus)[keyof typeof CollectionStatus];
export interface TransactionCorrection extends TransactionReference {
  patch: {
    category?: string | null | undefined;
    description?: string | null | undefined;
    ignored?: boolean | null | undefined;
  };
}
