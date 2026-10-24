import type { FinancialOverview, FinancialSummary } from "../contracts";
import {
  type DemoRecord,
  demoAccounts,
  demoCategories,
  demoLedger,
  demoReferenceDay,
} from "../fixtures/finance";
import {
  monthPeriod,
  selectedMonth,
  shiftMonth,
} from "./account/dashboard-period";
export interface DemoData {
  accounts: FinancialOverview["accounts"];
  categories: typeof demoCategories;
  records: DemoRecord[];
}
export const initialDemoData: DemoData = {
  accounts: demoAccounts,
  categories: demoCategories,
  records: demoLedger,
};
export function selectedDemoMonth(value: string | null) {
  const month = selectedMonth(value, demoReferenceDay);
  return month >= "2026-05" && month <= "2026-10" ? month : "2026-10";
}
function hasAmount(
  row: DemoRecord,
): row is DemoRecord & { amountMinor: string } {
  return row.amountMinor !== null;
}
function totalAmount(value: bigint, unknown: number) {
  return unknown ? null : value.toString();
}
function summarize(
  from: string,
  to: string,
  groupBy: "category" | "month",
  data: DemoData,
): FinancialSummary {
  const rows = data.records.filter(
    (row) =>
      row.date >= from &&
      row.date <= to &&
      row.date <= demoReferenceDay &&
      row.status === "POSTED" &&
      !row.ignored,
  );
  const groups = new Map<
    string,
    { amount: bigint; currency: string; group: string }
  >();
  const totals = ["BRL", "USD"].map((currency) => {
    const same = rows.filter((row) => row.currency === currency);
    let income = 0n;
    let expense = 0n;
    let flow = 0n;
    const unclassifiedCount = same.filter(
      (row) =>
        !data.categories.some((category) => category.id === row.category),
    ).length;
    const unknownAmountCount = same.filter(
      (row) => row.amountMinor === null,
    ).length;
    for (const row of same.filter(hasAmount)) {
      const amount = BigInt(row.amountMinor);
      const kind = data.categories.find(
        (category) => category.id === row.category,
      )?.kind;
      if (kind === "income") {
        income += amount;
      }
      if (kind === "expense") {
        expense -= amount;
        const group =
          groupBy === "month" ? row.date.slice(0, 7) : (row.category ?? "");
        const key = `${currency}:${group}`;
        const previous = groups.get(key)?.amount ?? 0n;
        groups.set(key, { amount: previous - amount, currency, group });
      }
      if (
        data.accounts.find((account) => account.id === row.accountId)?.type ===
        "BANK"
      ) {
        flow += amount;
      }
    }
    return {
      cashFlowMinor: totalAmount(flow, unknownAmountCount),
      count: same.length,
      currency,
      expenseMinor: totalAmount(expense, unknownAmountCount),
      incomeMinor: totalAmount(income, unknownAmountCount),
      knownCashFlowMinor: flow.toString(),
      knownExpenseMinor: expense.toString(),
      knownIncomeMinor: income.toString(),
      unclassifiedCount,
      unknownAmountCount,
    };
  });
  return {
    classification:
      "Categorias explícitas; transferências fora de receitas e despesas.",
    from,
    groups: [...groups.values()].map(({ amount, ...group }) => ({
      ...group,
      amountMinor: amount.toString(),
    })),
    partial: false,
    referenceDay: demoReferenceDay,
    to,
    totals,
  };
}
export function demoOverview(
  month: string,
  data: DemoData = initialDemoData,
): FinancialOverview {
  const { from, to } = monthPeriod(month);
  return { ...summarize(from, to, "category", data), accounts: data.accounts };
}
export function demoMonthly(
  month: string,
  data: DemoData = initialDemoData,
): FinancialSummary {
  return summarize(
    `${shiftMonth(month, -5)}-01`,
    monthPeriod(month).to,
    "month",
    data,
  );
}
export function demoTransactions({
  month,
  text = "",
  accountId = "",
  currency = "",
  includeIgnored = false,
  data = initialDemoData,
  direction = "",
}: {
  month: string;
  text?: string;
  accountId?: string;
  currency?: string;
  includeIgnored?: boolean;
  data?: DemoData;
  direction?: string;
}) {
  const { from, to } = monthPeriod(month);
  return data.records
    .filter(
      (row) =>
        row.date >= from &&
        row.date <= to &&
        (!text ||
          row.description
            .toLocaleLowerCase("pt-BR")
            .includes(text.toLocaleLowerCase("pt-BR"))) &&
        (!accountId || row.accountId === accountId) &&
        (!direction || row.direction === direction) &&
        (!currency || row.currency === currency) &&
        (includeIgnored || !row.ignored),
    )
    .toSorted(
      (a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id),
    );
}
