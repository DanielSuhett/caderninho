import type { FinancialOverview, FinancialSummary } from "../contracts";
import {
  AccountType,
  CategoryKind,
  type FinancialIdentityFilter,
  matchesFinancialIdentity,
  SpendingGroupBy,
  TransactionStatus,
  transactionMatchesText,
} from "../domain";
import {
  type DemoRecord,
  demoAccounts,
  demoCategories,
  demoLedger,
  demoReferenceDay,
} from "../fixtures/finance";
import { monthPeriod, shiftMonth } from "./account/dashboard-period";
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
export function scopedDemoData(
  data: DemoData,
  filter: FinancialIdentityFilter & { personId?: string | undefined },
): DemoData {
  const accounts = data.accounts.filter(
    (account) =>
      (!filter.personId || account.personId === filter.personId) &&
      matchesFinancialIdentity(account.identity, filter),
  );
  const accountIds = new Set(accounts.map((account) => account.id));
  const byIdentity = !!(filter.institutionId || filter.cardBrand);
  return {
    ...data,
    accounts,
    records: data.records.filter(
      (row) =>
        (!filter.personId || row.personId === filter.personId) &&
        (!byIdentity || accountIds.has(row.accountId)),
    ),
  };
}
function hasAmount(
  row: DemoRecord,
): row is DemoRecord & { amountMinor: string } {
  return row.amountMinor !== null;
}
function totalAmount(value: bigint, unknown: number) {
  return unknown ? null : value.toString();
}
export function demoSummary(
  from: string,
  to: string,
  groupBy: SpendingGroupBy,
  data: DemoData,
): FinancialSummary {
  const rows = data.records.filter(
    (row) =>
      row.date >= from &&
      row.date <= to &&
      row.date <= demoReferenceDay &&
      row.status === TransactionStatus.POSTED &&
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
      if (kind === CategoryKind.income) {
        income += amount;
      }
      if (kind === CategoryKind.expense) {
        expense -= amount;
        const group =
          groupBy === SpendingGroupBy.month
            ? row.date.slice(0, 7)
            : (row.category ?? "");
        const key = `${currency}:${group}`;
        const previous = groups.get(key)?.amount ?? 0n;
        groups.set(key, { amount: previous - amount, currency, group });
      }
      if (
        data.accounts.find((account) => account.id === row.accountId)?.type ===
        AccountType.BANK
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
  return {
    ...demoSummary(from, to, "category", data),
    accounts: data.accounts,
  };
}
export function demoMonthly(
  month: string,
  data: DemoData = initialDemoData,
): FinancialSummary {
  return demoSummary(
    `${shiftMonth(month, -23)}-01`,
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
        (!text || transactionMatchesText(row, text)) &&
        (!accountId || row.accountId === accountId) &&
        (!direction || row.direction === direction) &&
        (!currency || row.currency === currency) &&
        (includeIgnored || !row.ignored),
    )
    .toSorted(
      (a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id),
    );
}
