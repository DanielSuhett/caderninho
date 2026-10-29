import type { TransactionDirection, TransactionStatus } from "./finance.entity";

export const TransactionOrder = { date_desc: "date_desc", id: "id" } as const;
export type TransactionOrder =
  (typeof TransactionOrder)[keyof typeof TransactionOrder];

export const SpendingGroupBy = {
  category: "category",
  month: "month",
} as const;
export type SpendingGroupBy =
  (typeof SpendingGroupBy)[keyof typeof SpendingGroupBy];

export const AggregateGroupBy = {
  account: "account",
  ...SpendingGroupBy,
} as const;
export type AggregateGroupBy =
  (typeof AggregateGroupBy)[keyof typeof AggregateGroupBy];

/** Monthly totals per currency, with bigint minor amounts as strings. */
export interface MonthlyRollupTotals {
  cashFlow: string;
  count: number;
  expense: string;
  income: string;
  unclassified: number;
  unclassifiedAmount: string;
  unclassifiedUnknown: number;
  unknown: number;
}
export interface MonthlyRollupData {
  expenses: Record<string, string>;
  totals: Record<string, MonthlyRollupTotals>;
}

export interface TransactionFilter {
  accountIds?: string[] | undefined;
  category?: string | undefined;
  connectionIds?: string[] | undefined;
  currency?: string | undefined;
  description?: string | undefined;
  direction?: TransactionDirection | undefined;
  from?: string | undefined;
  maxAmountMinor?: string | undefined;
  minAmountMinor?: string | undefined;
  personId?: string | undefined;
  profileId?: string | undefined;
  status?: TransactionStatus | undefined;
  to?: string | undefined;
}
export interface Cursor {
  accountId: string;
  date: string;
  id: string;
  scope: string;
  state: string;
}
export interface TransactionQuery {
  cursor?: Cursor | undefined;
  filter?: TransactionFilter | undefined;
  limit: number;
}
export const Metric = {
  cash_flow: "cash_flow",
  count: "count",
  credits: "credits",
  debits: "debits",
} as const;
export type Metric = (typeof Metric)[keyof typeof Metric];
export interface AggregateQuery {
  filter?: TransactionFilter | undefined;
  groupBy?: AggregateGroupBy | undefined;
  metric: Metric;
}

export const MetricDefinition: Record<Metric, string> = {
  cash_flow: "Creditos menos debitos POSTED, maduros, somente de contas BANK.",
  count: "Todos os registros da selecao, inclusive pendentes e futuros.",
  credits: "Magnitude dos creditos POSTED, maduros; nao equivale a renda.",
  debits: "Magnitude dos debitos POSTED, maduros; nao equivale a gasto.",
};
