import type { AccountInfo } from "../../../contracts";
import type {
  AggregateQuery,
  Cursor,
  TransactionCorrection,
  TransactionProjection,
  TransactionQuery,
} from "../../../domain";

export interface TransactionView extends Omit<TransactionProjection, "source"> {
  categoryOverride: string | null;
  correctedAt: string | null;
  descriptionOverride: string | null;
  effectiveCategory: string | null;
  effectiveDescription: string;
  ignored: boolean;
  ignoredOverride: boolean | null;
  observedAt: string;
  presence: "observed" | "not_observed";
}
export interface Quality {
  accounts: AccountInfo[];
  partial: boolean;
}
export interface QueryResult extends Quality {
  cursor: Cursor | null;
  records: TransactionView[];
  referenceDay: string;
  revision: number;
}
export interface AggregateGroup {
  count: string;
  currency: string;
  group: string | null;
  known: string;
  totalMinor: string | null;
  unclassifiedDebitMinor: string | null;
  unconfirmed: string;
}
export interface AggregateResult extends Quality {
  definition: string;
  groups: AggregateGroup[];
  metric: AggregateQuery["metric"];
  referenceDay: string;
  revision: number;
}
export interface FinancialRepository {
  accounts: (ids?: string[]) => Promise<AccountInfo[]>;
  aggregate: (
    input: AggregateQuery,
    referenceDay: string,
  ) => Promise<AggregateResult>;
  correct: (
    input: TransactionCorrection,
    now: string,
  ) => Promise<TransactionView>;
  query: (
    input: TransactionQuery,
    scope: string,
    referenceDay: string,
  ) => Promise<QueryResult>;
}
