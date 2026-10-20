import type { AccountReference } from "./finance.entity";
export interface TransactionFilter {
  accounts?: AccountReference[] | undefined;
  category?: string | undefined;
  connectionIds?: string[] | undefined;
  currency?: string | undefined;
  description?: string | undefined;
  direction?: "DEBIT" | "CREDIT" | undefined;
  from?: string | undefined;
  maxAmountMinor?: string | undefined;
  minAmountMinor?: string | undefined;
  status?: "PENDING" | "POSTED" | undefined;
  to?: string | undefined;
}
export interface Cursor {
  accountId: string;
  connectionId: string;
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
  groupBy?: "account" | "category" | "month" | undefined;
  metric: Metric;
}

export const MetricDefinition: Record<Metric, string> = {
  cash_flow: "Creditos menos debitos POSTED, maduros, somente de contas BANK.",
  count: "Todos os registros da selecao, inclusive pendentes e futuros.",
  credits: "Magnitude dos creditos POSTED, maduros; nao equivale a renda.",
  debits: "Magnitude dos debitos POSTED, maduros; nao equivale a gasto.",
};
