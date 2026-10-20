import type { AccountInfo } from "../../../contracts";
import type {
  AggregateQuery,
  Cursor,
  TransactionProjection,
  TransactionQuery,
} from "../../../domain";

export interface Quality {
  accounts: AccountInfo[];
  partial: boolean;
}
export interface QueryResult extends Quality {
  cursor: Cursor | null;
  records: TransactionProjection[];
  referenceDay: string;
}
export interface AggregateGroup {
  count: string;
  currency: string;
  group: string | null;
  totalMinor: string | null;
  unknownAmountCount: string;
}
export interface AggregateResult extends Quality {
  definition: string;
  groups: AggregateGroup[];
  metric: AggregateQuery["metric"];
  referenceDay: string;
}
export interface FinancialRepository {
  accounts: (ids?: string[]) => Promise<AccountInfo[]>;
  aggregate: (
    input: AggregateQuery,
    referenceDay: string,
  ) => Promise<AggregateResult>;
  query: (
    input: TransactionQuery,
    scope: string,
    referenceDay: string,
  ) => Promise<QueryResult>;
}
