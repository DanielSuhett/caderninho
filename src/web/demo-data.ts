import type { z } from "zod/v4";

import type {
  FinancialOverview,
  FinancialSummary,
  PortalTransactionListSchema,
} from "../contracts";
import {
  monthPeriod,
  selectedMonth,
  shiftMonth,
} from "./account/dashboard-period";

export const demoReferenceDay = "2026-10-24";
export function selectedDemoMonth(value: string | null) {
  const month = selectedMonth(value, demoReferenceDay);
  return month >= "2026-05" && month <= "2026-10" ? month : "2026-10";
}
export const demoPeople = [{ id: "demo-person", name: "Pessoa de exemplo" }];
export const demoCategories = [
  { id: "salary", kind: "income", name: "Trabalho" },
  { id: "home", kind: "expense", name: "Moradia" },
  { id: "market", kind: "expense", name: "Mercado" },
  { id: "food", kind: "expense", name: "Alimentação" },
  { id: "transport", kind: "expense", name: "Transporte" },
  { id: "health", kind: "expense", name: "Saúde" },
  { id: "tools", kind: "expense", name: "Software" },
  { id: "transfer", kind: "transfer", name: "Transferência entre contas" },
];
export const demoAccounts: FinancialOverview["accounts"] = [
  {
    balanceMinor: "1042586",
    balanceObservedAt: "2026-10-24",
    currency: "BRL",
    hidden: false,
    id: "demo-bank",
    manual: false,
    name: "Conta principal",
    personId: "demo-person",
    type: "BANK",
  },
  {
    balanceMinor: "2500000",
    balanceObservedAt: "2026-10-24",
    currency: "BRL",
    hidden: false,
    id: "demo-reserve",
    manual: false,
    name: "Reserva",
    personId: "demo-person",
    type: "BANK",
  },
  {
    balanceMinor: "-238760",
    balanceObservedAt: "2026-10-24",
    currency: "BRL",
    hidden: false,
    id: "demo-card",
    manual: false,
    name: "Cartão pessoal",
    personId: "demo-person",
    type: "CREDIT",
  },
  {
    balanceMinor: "184050",
    balanceObservedAt: "2026-10-24",
    currency: "USD",
    hidden: false,
    id: "demo-usd",
    manual: false,
    name: "Conta internacional",
    personId: "demo-person",
    type: "BANK",
  },
];
type DemoRecord = z.infer<
  typeof PortalTransactionListSchema
>["data"]["records"][number] & { amountMinor: string };
function transaction({
  month,
  day,
  description,
  amountMinor,
  category,
  accountId = "demo-bank",
  status = "POSTED",
  ignored = false,
}: {
  month: string;
  day: number;
  description: string;
  amountMinor: string;
  category: string | null;
  accountId?: string;
  status?: DemoRecord["status"];
  ignored?: boolean;
}): DemoRecord {
  const date = `${month}-${day.toString().padStart(2, "0")}`;
  return {
    accountId,
    amountMinor,
    anchorDate: date,
    anchorKind: "transaction",
    cardNumber: null,
    category,
    currency: accountId === "demo-usd" ? "USD" : "BRL",
    date,
    description,
    direction: BigInt(amountMinor) < 0n ? "DEBIT" : "CREDIT",
    id: `${month}-${day}-${description}`,
    ignored,
    installmentNumber: null,
    installments: [],
    manual: false,
    personId: "demo-person",
    personName: "Pessoa de exemplo",
    purchaseDate: null,
    status,
    totalInstallments: null,
  };
}
// Synthetic ledger only. Each aggregate is derived from this entire ledger, independently of the visible list.
export const demoLedger = [0, 1, 2, 3, 4, 5].flatMap((index) => {
  const month = shiftMonth("2026-05", index);
  const market = (63980n + BigInt(index) * 1841n).toString();
  return [
    {
      amountMinor: "980000",
      category: "salary",
      day: 2,
      description: "Salário",
    },
    {
      amountMinor: "-245000",
      category: "home",
      day: 3,
      description: "Aluguel",
    },
    {
      amountMinor: `-${market}`,
      category: "market",
      day: 5,
      description: "Mercado da semana",
    },
    {
      amountMinor: "-42800",
      category: "health",
      day: 7,
      description: "Plano de saúde",
    },
    {
      accountId: "demo-card",
      amountMinor: "-7850",
      category: "food",
      day: 9,
      description: "Restaurante do bairro",
    },
    {
      accountId: "demo-card",
      amountMinor: "-2890",
      category: "transport",
      day: 10,
      description: "Transporte por aplicativo",
    },
    {
      accountId: "demo-card",
      amountMinor: "-14900",
      category: "tools",
      day: 12,
      description: "Ferramentas de desenvolvimento",
    },
    {
      amountMinor: "-120000",
      category: "transfer",
      day: 13,
      description: "Reserva mensal",
    },
    {
      accountId: "demo-reserve",
      amountMinor: "120000",
      category: "transfer",
      day: 13,
      description: "Reserva recebida",
    },
    {
      amountMinor: "-32476",
      category: "market",
      day: 16,
      description: "Mercado e feira",
    },
    {
      amountMinor: "1250",
      category: "market",
      day: 18,
      description: "Estorno de mercado",
    },
    {
      accountId: "demo-card",
      amountMinor: "-8640",
      category: "food",
      day: 20,
      description: "Café e almoço",
    },
    {
      accountId: "demo-card",
      amountMinor: "-12890",
      category: "health",
      day: 21,
      description: "Farmácia",
    },
    {
      amountMinor: "18000",
      category: null,
      day: 22,
      description: "Transferência recebida",
    },
    {
      accountId: "demo-usd",
      amountMinor: "-2400",
      category: "tools",
      day: 23,
      description: "Serviço internacional",
    },
    {
      amountMinor: "-4500",
      category: "food",
      day: 19,
      description: "Registro ignorado de exemplo",
      ignored: true,
    },
  ]
    .map((row) => transaction({ ...row, month }))
    .concat([
      transaction({
        accountId: "demo-card",
        amountMinor: "-8990",
        category: "market",
        day: 24,
        description: "Compra em processamento",
        month,
        status: "PENDING",
      }),
      transaction({
        accountId: "demo-card",
        amountMinor: "-15900",
        category: "tools",
        day: 27,
        description: "Parcela prevista",
        month,
        status: "PENDING",
      }),
    ]);
});
function summarize(
  from: string,
  to: string,
  groupBy: "category" | "month",
): FinancialSummary {
  const rows = demoLedger.filter(
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
    let unclassifiedCount = 0;
    for (const row of same) {
      const amount = BigInt(row.amountMinor);
      const kind = demoCategories.find(
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
      if (!kind) {
        unclassifiedCount += 1;
      }
      if (
        demoAccounts.find((account) => account.id === row.accountId)?.type ===
        "BANK"
      ) {
        flow += amount;
      }
    }
    return {
      cashFlowMinor: flow.toString(),
      count: same.length,
      currency,
      expenseMinor: expense.toString(),
      incomeMinor: income.toString(),
      knownCashFlowMinor: flow.toString(),
      knownExpenseMinor: expense.toString(),
      knownIncomeMinor: income.toString(),
      unclassifiedCount,
      unknownAmountCount: 0,
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
export function demoOverview(month: string): FinancialOverview {
  const { from, to } = monthPeriod(month);
  return { ...summarize(from, to, "category"), accounts: demoAccounts };
}
export function demoMonthly(month: string): FinancialSummary {
  return summarize(
    `${shiftMonth(month, -5)}-01`,
    monthPeriod(month).to,
    "month",
  );
}
export function demoTransactions({
  month,
  text = "",
  accountId = "",
  currency = "",
  includeIgnored = false,
}: {
  month: string;
  text?: string;
  accountId?: string;
  currency?: string;
  includeIgnored?: boolean;
}) {
  const { from, to } = monthPeriod(month);
  return demoLedger
    .filter(
      (row) =>
        row.date >= from &&
        row.date <= to &&
        (!text ||
          row.description
            .toLocaleLowerCase("pt-BR")
            .includes(text.toLocaleLowerCase("pt-BR"))) &&
        (!accountId || row.accountId === accountId) &&
        (!currency || row.currency === currency) &&
        (includeIgnored || !row.ignored),
    )
    .toSorted(
      (a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id),
    );
}
