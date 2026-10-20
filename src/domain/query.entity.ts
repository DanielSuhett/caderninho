import type { AccountReference } from "./finance.entity";
export interface TransactionFilter {
  accounts?: AccountReference[] | undefined;
  category?: string | undefined;
  connectionIds?: string[] | undefined;
  currency?: string | undefined;
  description?: string | undefined;
  direction?: "DEBIT" | "CREDIT" | undefined;
  from?: string | undefined;
  ignored?: boolean | undefined;
  maxAmountMinor?: string | undefined;
  minAmountMinor?: string | undefined;
  presence?: "observed" | "not_observed" | undefined;
  status?: "PENDING" | "POSTED" | undefined;
  to?: string | undefined;
}
export interface Cursor {
  accountId: string;
  connectionId: string;
  date: string;
  id: string;
  revision: number;
  scope: string;
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
  known_spending: "known_spending",
} as const;
export type Metric = (typeof Metric)[keyof typeof Metric];
export interface AggregateQuery {
  filter?: TransactionFilter | undefined;
  groupBy?: "account" | "category" | "month" | undefined;
  metric: Metric;
}

export const MetricDefinition: Record<Metric, string> = {
  cash_flow:
    "Creditos menos debitos POSTED, maduros e nao ignorados, somente de contas BANK.",
  count:
    "Registros da selecao; contagens confirmadas e nao confirmadas separadas.",
  credits:
    "Magnitude dos creditos POSTED, maduros e nao ignorados; nao equivale a renda.",
  debits:
    "Magnitude dos debitos POSTED, maduros e nao ignorados; nao equivale a gasto.",
  known_spending:
    "Consumo com evidencia deterministica; debitos incertos informados separadamente.",
};
