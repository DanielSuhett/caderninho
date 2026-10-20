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
  phase: "accounts" | "transactions" | "finish";
}
export interface CommitResult {
  checkpoint: Checkpoint;
  done: boolean;
  records: number;
  sequence: number;
}
export interface FinancialSource {
  accounts: (id: string) => Promise<ProviderAccount[]>;
  connection: (id: string) => Promise<ProviderConnection>;
  transactions: (
    accountId: string,
    cursor: string | null,
  ) => Promise<TransactionPage>;
}
export const IMPORT_INTERVAL = 86_400_000;
