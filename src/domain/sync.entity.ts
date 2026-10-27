import type { Institution } from "./financial-identity.entity";
import type { ProductKind, ProductPage } from "./planning.entity";
import type {
  ProviderAccount,
  ProviderConnection,
  TransactionPage,
} from "./provider.entity";
export const RunStatus = {
  failed: "failed",
  pending: "pending",
  running: "running",
  succeeded: "succeeded",
} as const;
export type RunStatus = (typeof RunStatus)[keyof typeof RunStatus];
export const ImportPhase = {
  accounts: "accounts",
  bills: "bills",
  classification: "classification",
  finish: "finish",
  investments: "investments",
  loans: "loans",
  transactions: "transactions",
} as const;
export type ImportPhase = (typeof ImportPhase)[keyof typeof ImportPhase];
export interface Checkpoint {
  accountId: string | null;
  cursor: string | null;
  phase: ImportPhase;
}
export interface CommitResult {
  checkpoint: Checkpoint;
  done: boolean;
  sequence: number;
}
export interface FinancialSource {
  accounts: (id: string) => Promise<ProviderAccount[]>;
  connection: (id: string) => Promise<ProviderConnection>;
  // Official institution catalog visible to the connection's credentials.
  institutionCatalog?: (connectionId: string) => Promise<Institution[]>;
  products?: (input: {
    kind: ProductKind;
    id: string;
    page: number;
    observedAt: string;
  }) => Promise<ProductPage>;
  transactions: (
    accountId: string,
    cursor: string | null,
  ) => Promise<TransactionPage>;
}
export const IMPORT_INTERVAL = 86_400_000;
