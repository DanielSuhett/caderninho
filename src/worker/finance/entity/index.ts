import type {
  AggregateQuery,
  Cursor,
  TransactionProjection,
  TransactionQuery,
} from "../../../domain";

export interface QueryResult {
  cursor: Cursor | null;
  oldestLastSuccessAt: string | null;
  partial: boolean;
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
export interface AggregateResult {
  definition: string;
  groups: AggregateGroup[];
  metric: AggregateQuery["metric"];
  oldestLastSuccessAt: string | null;
  partial: boolean;
  referenceDay: string;
}
export interface FinancialRepository {
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
