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
export interface Checkpoint {
  accountId: string | null;
  cursor: string | null;
  phase:
    | "accounts"
    | "transactions"
    | "investments"
    | "loans"
    | "bills"
    | "classification"
    | "finish";
}
export interface CommitResult {
  checkpoint: Checkpoint;
  done: boolean;
  sequence: number;
}
export interface FinancialSource {
  accounts: (id: string) => Promise<ProviderAccount[]>;
  connection: (id: string) => Promise<ProviderConnection>;
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
