import type {
  AccountDetails,
  Bill,
  ConnectionOwner,
  Person,
  PlanningAccount,
  PlanningState,
  TransactionDetails,
  TransactionProjection,
} from "../../../domain";
import type { connections } from "../../schema";

export interface PlanningSnapshot {
  accountDetails: AccountDetails[];
  accounts: PlanningAccount[];
  bills: Bill[];
  clefEnabled?: boolean;
  connections: (typeof connections.$inferSelect)[];
  owners: ConnectionOwner[];
  partial: boolean;
  people: Person[];
  revision: number;
  state: PlanningState;
  transactionDetails: TransactionDetails[];
}
export interface TransactionRead {
  accountIds: string[];
  after?: string | undefined;
  excludeIds: string[];
  from?: string | undefined;
  order?: "id" | "date_desc" | undefined;
  pageSize?: number | undefined;
  to?: string | undefined;
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
  read: (tool?: string) => Promise<PlanningSnapshot>;
  receipt: (
    key: string,
  ) => Promise<{ digest: string; result: unknown } | undefined>;
  revision: () => Promise<number>;
  transactions: (
    ids?: string[],
    selection?: TransactionRead,
  ) => AsyncIterable<TransactionProjection[]>;
}
