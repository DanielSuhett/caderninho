import type { z } from "zod/v4";

import type {
  FinancialOverview,
  PortalTransactionListSchema,
  WorkspaceCatalog,
} from "../contracts";
import { monthDate } from "../domain";
export const demoReferenceDay = "2026-10-24";
export const demoPeople = [{ id: "demo-person", name: "Pessoa de exemplo" }];
const categories: Pick<
  WorkspaceCatalog["categories"][number],
  "id" | "kind" | "name"
>[] = [
  { id: "salary", kind: "income", name: "Trabalho" },
  { id: "home", kind: "expense", name: "Moradia" },
  { id: "market", kind: "expense", name: "Mercado" },
  { id: "food", kind: "expense", name: "Alimentação" },
  { id: "transport", kind: "expense", name: "Transporte" },
  { id: "health", kind: "expense", name: "Saúde" },
  { id: "tools", kind: "expense", name: "Software" },
  { id: "transfer", kind: "transfer", name: "Transferência entre contas" },
];
export const demoCategories: WorkspaceCatalog["categories"] = categories.map(
  (category) => ({ ...category, hidden: false, limitMinor: null }),
);
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
export type DemoRecord = z.infer<
  typeof PortalTransactionListSchema
>["data"]["records"][number];
export function transactionFixture(
  input: Partial<DemoRecord> = {},
): DemoRecord {
  const date = input.date ?? "2026-10-10";
  return {
    accountId: "demo-bank",
    amountMinor: "-1000",
    anchorDate: date,
    anchorKind: "transaction",
    cardNumber: null,
    category: null,
    currency: "BRL",
    date,
    description: "Compra de exemplo",
    direction: "DEBIT",
    id: "synthetic-transaction",
    ignored: false,
    installmentNumber: null,
    installments: [],
    manual: false,
    personId: "demo-person",
    personName: "Pessoa de exemplo",
    purchaseDate: null,
    status: "POSTED",
    totalInstallments: null,
    ...input,
  };
}
function transaction({
  month,
  day,
  ...input
}: Partial<DemoRecord> & { month: string; day: number }) {
  const date = `${month}-${String(day).padStart(2, "0")}`;
  return transactionFixture({
    ...input,
    anchorDate: date,
    date,
    id: `${date}-${input.description}`,
  });
}
// Synthetic ledger only. Each aggregate is derived from this entire ledger, independently of the visible list.
export const demoLedger = [0, 1, 2, 3, 4, 5].flatMap((index) => {
  const month = monthDate("2026-05-01", index).slice(0, 7);
  const market = (63980n + BigInt(index) * 1841n).toString();
  const rows: (Partial<DemoRecord> & { day: number })[] = [
    {
      amountMinor: "980000",
      category: "salary",
      day: 2,
      description: "Salário",
      direction: "CREDIT",
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
      direction: "CREDIT",
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
      direction: "CREDIT",
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
      direction: "CREDIT",
    },
    {
      accountId: "demo-usd",
      amountMinor: "-2400",
      category: "tools",
      currency: "USD",
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
  ];
  return rows
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
