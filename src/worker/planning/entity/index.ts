import type {
  AccountDetails,
  Bill,
  PlanningAccount,
  PlanningState,
  TransactionDetails,
  TransactionProjection,
} from "../../../domain";

export interface PlanningSnapshot {
  accountDetails: AccountDetails[];
  accounts: PlanningAccount[];
  bills: Bill[];
  partial: boolean;
  revision: number;
  state: PlanningState;
  transactionDetails: TransactionDetails[];
}
export interface PlanningRepository {
  commit: (input: {
    before: PlanningSnapshot;
    state: PlanningState;
    key: string;
    digest: string;
    result: unknown;
    now: string;
  }) => Promise<void>;
  read: () => Promise<PlanningSnapshot>;
  receipt: (
    key: string,
  ) => Promise<{ digest: string; result: unknown } | undefined>;
  revision: () => Promise<number>;
  transactions: (ids?: string[]) => AsyncIterable<TransactionProjection[]>;
}
