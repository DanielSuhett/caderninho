import type { z } from "zod/v4";

import {
  type FinancialOverview,
  type PortalTransactionListSchema,
  type WorkspaceCatalog,
  WorkspaceCatalogSchema,
} from "../contracts";
import {
  AccountType,
  categoryCatalog,
  monthDate,
  TransactionStatus,
} from "../domain";
export const demoReferenceDay = "2026-10-24";
// Bank logos ship with the deploy (one SVG per COMPE), so the static demo
// shows them without the Worker's logo proxy.
export const itau = { id: "341", logoUrl: "/bancos/341.svg", name: "Itaú" };
export const nubank = {
  id: "260",
  logoUrl: "/bancos/260.svg",
  name: "Nubank",
};
export const demoPeople = [
  { id: "demo-person", name: "Ana Silva", photo: "/demo-people/ana.jpg" },
  { id: "demo-person-2", name: "Bruno Costa", photo: "/demo-people/bruno.jpg" },
];
const demoCategoryIds = new Map([
  ["salario-renda", "salary"],
  ["casa", "home"],
  ["mercado", "market"],
  ["restaurantes", "food"],
  ["corridas", "transport"],
  ["saude-geral", "health"],
  ["assinaturas", "tools"],
  ["transferencias", "transfer"],
]);
const fixedCatalog = categoryCatalog("personal");
export const demoCategories: WorkspaceCatalog["categories"] =
  WorkspaceCatalogSchema.parse({
    ...fixedCatalog,
    categories: fixedCatalog.categories.map((category) => ({
      ...category,
      id:
        demoCategoryIds.get(category.id.split(":").at(-1) ?? "") ??
        (category.id === "personal:transfer" ? "transfer" : category.id),
    })),
    rules: [],
    spaces: [],
    tags: [],
  }).categories;
export const demoAccounts: FinancialOverview["accounts"] = [
  {
    balanceMinor: "1042586",
    balanceObservedAt: "2026-10-24",
    currency: "BRL",
    hidden: false,
    id: "demo-bank",
    identity: { cardBrand: null, institution: itau },
    manual: false,
    name: "Conta corrente",
    personId: "demo-person",
    type: AccountType.BANK,
  },
  {
    balanceMinor: "2500000",
    balanceObservedAt: "2026-10-24",
    currency: "BRL",
    hidden: false,
    id: "demo-reserve",
    identity: { cardBrand: null, institution: nubank },
    manual: false,
    name: "Caixinha reserva",
    personId: "demo-person",
    type: AccountType.BANK,
  },
  {
    balanceMinor: "-238760",
    balanceObservedAt: "2026-10-24",
    currency: "BRL",
    hidden: false,
    id: "demo-card",
    identity: { cardBrand: "MASTERCARD", institution: nubank },
    manual: false,
    name: "Nubank Mastercard",
    personId: "demo-person",
    type: AccountType.CREDIT,
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
    type: AccountType.BANK,
  },
  {
    balanceMinor: "-186430",
    balanceObservedAt: demoReferenceDay,
    currency: "BRL",
    hidden: false,
    id: "demo-card-extra",
    identity: { cardBrand: "VISA", institution: itau },
    manual: false,
    name: "Itaú Visa Platinum",
    personId: "demo-person-2",
    type: AccountType.CREDIT,
  },
  {
    balanceMinor: "652310",
    balanceObservedAt: demoReferenceDay,
    currency: "BRL",
    hidden: false,
    id: "demo-bank-2",
    identity: { cardBrand: null, institution: nubank },
    manual: false,
    name: "Conta Nubank",
    personId: "demo-person-2",
    type: AccountType.BANK,
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
    identification: null,
    ignored: false,
    installmentNumber: null,
    installments: [],
    manual: false,
    personId: "demo-person",
    personName: "Ana Silva",
    purchaseDate: null,
    status: TransactionStatus.POSTED,
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
// A purchase split on a card: one row per month from the first charge, posted
// up to the reference day and pending after it.
function installmentPlan({
  start,
  total,
  ...input
}: Partial<DemoRecord> & {
  start: string;
  total: number;
  day: number;
  description: string;
}) {
  return Array.from({ length: total }, (_, index) => {
    const month = monthDate(`${start}-01`, index).slice(0, 7);
    const row = transaction({
      ...input,
      installmentNumber: index + 1,
      month,
      purchaseDate: `${start}-${String(input.day).padStart(2, "0")}`,
      totalInstallments: total,
    });
    return {
      ...row,
      status:
        row.date > demoReferenceDay
          ? TransactionStatus.PENDING
          : TransactionStatus.POSTED,
    };
  });
}
const bruno = { personId: "demo-person-2", personName: "Bruno Costa" };
// Synthetic ledger only. Each aggregate is derived from this entire ledger, independently of the visible list.
export const demoLedger = [0, 1, 2, 3, 4, 5]
  .flatMap((index) => {
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
        billPayment: index < 3 ? "bank" : null,
        cardNumber: "4242",
        category: "tools",
        day: 12,
        description: "Ferramentas de desenvolvimento",
        installmentNumber: index + 1,
        purchaseDate: "2026-05-12",
        totalInstallments: 12,
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
        identification: {
          descriptionRaw: "COMPRA CARTAO MERCADO EXEMPLO",
          merchant: {
            businessName: "Comércio demonstrativo",
            category: "Supermercado",
            cnae: "4711302",
            cnpj: "00.000.000/0001-91",
            name: "Mercado de exemplo",
          },
          operationType: "CARTAO",
        },
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
        cardNumber: "5151",
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
      {
        accountId: "demo-card",
        amountMinor: "-4990",
        cardNumber: "5151",
        category: "tools",
        day: 6,
        description: "Clube do livro",
      },
      {
        accountId: "demo-card",
        amountMinor: "-2190",
        category: "tools",
        day: 11,
        description: "Música por assinatura",
      },
      {
        ...bruno,
        accountId: "demo-bank-2",
        amountMinor: "720000",
        category: "salary",
        day: 5,
        description: "Salário",
        direction: "CREDIT",
      },
      {
        ...bruno,
        accountId: "demo-bank-2",
        amountMinor: "-38900",
        category: "home",
        day: 10,
        description: "Condomínio",
      },
      {
        ...bruno,
        accountId: "demo-card-extra",
        amountMinor: "-11990",
        category: "tools",
        day: 4,
        description: "Clube do vinho",
      },
      {
        ...bruno,
        accountId: "demo-card-extra",
        amountMinor: "-5590",
        category: "tools",
        day: 8,
        description: "Streaming de filmes",
      },
      {
        ...bruno,
        accountId: "demo-card-extra",
        amountMinor: `-${(19800n + BigInt(index) * 730n).toString()}`,
        category: "transport",
        day: 14,
        description: "Posto de combustível",
      },
      {
        ...bruno,
        accountId: "demo-card-extra",
        amountMinor: "-16450",
        category: "food",
        day: 17,
        description: "Jantar com amigos",
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
          status: TransactionStatus.PENDING,
        }),
        transaction({
          accountId: "demo-card",
          amountMinor: "-15900",
          cardNumber: "4242",
          category: "tools",
          day: 27,
          description: "Curso de especialização",
          installmentNumber: index + 1,
          month,
          purchaseDate: "2026-05-27",
          status: TransactionStatus.PENDING,
          totalInstallments: 12,
        }),
      ]);
  })
  .concat(
    Array.from({ length: 6 }, (_, index) => {
      const month = monthDate("2026-11-01", index).slice(0, 7);
      return [
        transaction({
          accountId: "demo-card",
          amountMinor: "-14900",
          cardNumber: "4242",
          category: "tools",
          day: 12,
          description: "Ferramentas de desenvolvimento",
          installmentNumber: index + 7,
          month,
          purchaseDate: "2026-05-12",
          status: TransactionStatus.PENDING,
          totalInstallments: 12,
        }),
        transaction({
          accountId: "demo-card",
          amountMinor: "-15900",
          cardNumber: "4242",
          category: "tools",
          day: 27,
          description: "Curso de especialização",
          installmentNumber: index + 7,
          month,
          purchaseDate: "2026-05-27",
          status: TransactionStatus.PENDING,
          totalInstallments: 12,
        }),
      ];
    }).flat(),
  )
  .concat(
    installmentPlan({
      accountId: "demo-card",
      amountMinor: "-32990",
      cardNumber: "4242",
      category: "home",
      day: 18,
      description: "Geladeira",
      start: "2026-08",
      total: 10,
    }),
    installmentPlan({
      accountId: "demo-card",
      amountMinor: "-58300",
      cardNumber: "5151",
      category: "transport",
      day: 3,
      description: "Passagem aérea",
      start: "2026-09",
      total: 6,
    }),
    installmentPlan({
      ...bruno,
      accountId: "demo-card-extra",
      amountMinor: "-45990",
      cardNumber: "8080",
      category: "tools",
      day: 15,
      description: "Notebook",
      start: "2026-07",
      total: 10,
    }),
  );
