import type {
  AccountDetails,
  Bill,
  ConnectionOwner,
  Person,
  PlanningAccount,
  PlanningState,
  TransactionDetails,
  TransactionOrder,
  TransactionProjection,
} from "../../../domain";
import type { connections } from "../../schema";

export interface PlanningSnapshot {
  accountDetails: AccountDetails[];
  accounts: PlanningAccount[];
  bills: Bill[];
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
  order?: TransactionOrder | undefined;
  pageSize?: number | undefined;
  to?: string | undefined;
}
export type PlanningRead =
  | "tags"
  | "rules"
  | "categories"
  | "categoryGroups"
  | "spaces"
  | "notifications";
export type PlanningResult = Record<string, unknown>;
export interface PlanningRepository {
  commit: (input: {
    before: PlanningSnapshot;
    state: PlanningState;
    key: string;
    digest: string;
    result: PlanningResult;
    now: string;
  }) => Promise<void>;
  read: (resource?: PlanningRead) => Promise<PlanningSnapshot>;
  receipt: (
    key: string,
  ) => Promise<{ digest: string; result: PlanningResult } | undefined>;
  revision: () => Promise<number>;
  transactions: (
    ids?: string[],
    selection?: TransactionRead,
  ) => AsyncIterable<TransactionProjection[]>;
}
