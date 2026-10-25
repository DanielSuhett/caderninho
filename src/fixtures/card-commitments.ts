import type { CardCommitments } from "../contracts";
import { monthDate } from "../domain";
import { demoCategories, demoReferenceDay } from "./finance";

type Installment = CardCommitments["installments"][number];

function occurrence(input: Partial<Installment>): Installment {
  const date = input.date ?? "2026-10-10";
  return {
    accountId: "demo-card",
    accountName: "Cartão pessoal",
    amountMinor: "65000",
    cardNumber: "1234",
    categoryId: "home",
    categoryName: "Casa",
    currency: "BRL",
    date,
    description: "Notebook para trabalho",
    direction: "DEBIT",
    id: `demo-installment-${date}`,
    installmentNumber: 3,
    phase: date > demoReferenceDay ? "future" : "spent",
    purchaseDate: "2026-08-10",
    status: date > demoReferenceDay ? "PENDING" : "POSTED",
    totalInstallments: 10,
    ...input,
  };
}

const installments: Installment[] = [
  ...[
    "2026-10-10",
    "2026-11-10",
    "2026-12-10",
    "2027-01-10",
    "2027-02-10",
    "2027-03-10",
    "2027-04-10",
    "2027-05-10",
  ].map((date, index) => occurrence({ date, installmentNumber: index + 3 })),
  ...["2026-10-19", "2026-11-19", "2026-12-19", "2027-01-19", "2027-02-19"].map(
    (date, index) =>
      occurrence({
        amountMinor: "28400",
        date,
        description: "Móveis da sala",
        id: `demo-furniture-${date}`,
        installmentNumber: index + 2,
        purchaseDate: "2026-09-19",
        totalInstallments: 6,
      }),
  ),
  ...["2026-10-28", "2026-11-28", "2026-12-28", "2027-01-28"].map(
    (date, index) =>
      occurrence({
        amountMinor: "21900",
        categoryId: "tools",
        categoryName: "Assinaturas",
        date,
        description: "Curso de fotografia",
        id: `demo-course-${date}`,
        installmentNumber: index + 1,
        purchaseDate: "2026-10-02",
        totalInstallments: 4,
      }),
  ),
  occurrence({
    accountId: "demo-card-extra",
    accountName: "Cartão adicional",
    amountMinor: "53000",
    categoryId: "health",
    categoryName: "Saúde",
    date: "2026-10-22",
    description: "Tratamento odontológico",
    id: "demo-dentist",
    installmentNumber: 1,
    phase: "pending",
    purchaseDate: "2026-10-22",
    status: "PENDING",
    totalInstallments: 3,
  }),
  occurrence({
    accountId: "demo-card-usd",
    accountName: "Cartão internacional",
    amountMinor: "12500",
    categoryId: "tools",
    categoryName: "Assinaturas",
    currency: "USD",
    date: "2026-10-12",
    description: "Ferramenta de trabalho",
    id: "demo-usd-installment",
    installmentNumber: 1,
    purchaseDate: "2026-10-12",
    totalInstallments: 2,
  }),
];

const oneTime = [
  {
    amountMinor: "40600",
    categoryId: "market",
    categoryName: "Mercado",
    currency: "BRL",
    date: "2026-10-11",
    phase: "spent",
  },
  {
    amountMinor: "18300",
    categoryId: "food",
    categoryName: "Restaurantes",
    currency: "BRL",
    date: "2026-10-14",
    phase: "spent",
  },
  {
    amountMinor: "19800",
    categoryId: "transport",
    categoryName: "Transporte",
    currency: "BRL",
    date: "2026-10-17",
    phase: "spent",
  },
] as const;

const entries = [
  ...installments,
  ...oneTime.map((row) => ({ ...row, accountId: "demo-card" })),
];

function totals({
  currency,
  from,
  to,
  month,
  sourceEntries,
}: {
  currency: string;
  from: string;
  to: string;
  month?: string;
  sourceEntries: typeof entries;
}): CardCommitments["totals"][number] {
  const rows = sourceEntries.filter(
    (row) =>
      row.currency === currency &&
      row.date >= from &&
      row.date <= to &&
      (!month || row.date.startsWith(month)),
  );
  const amount = (phase: string) =>
    rows
      .filter((row) => row.phase === phase)
      .reduce((sum, row) => sum + BigInt(row.amountMinor ?? "0"), 0n)
      .toString();
  const spentMinor = amount("spent");
  const pendingMinor = amount("pending");
  const futureMinor = amount("future");
  const observedCommitmentsMinor = (
    BigInt(spentMinor) +
    BigInt(pendingMinor) +
    BigInt(futureMinor)
  ).toString();
  return {
    currency,
    futureMinor,
    knownFutureMinor: futureMinor,
    knownObservedCommitmentsMinor: observedCommitmentsMinor,
    knownPendingMinor: pendingMinor,
    knownSpentMinor: spentMinor,
    knownUnclassifiedMinor: "0",
    observedCommitmentsMinor,
    pendingMinor,
    spentMinor,
    unclassifiedCount: 0,
    unclassifiedUnknownAmountCount: 0,
    unknownAmountCount: 0,
  };
}

const currencies = ["BRL", "USD"];

export function cardCommitmentsFixture(
  input: Partial<CardCommitments> = {},
  selection: {
    personId?: string | undefined;
    accountId?: string | undefined;
  } = {},
): CardCommitments {
  const month = input.month ?? "2026-10";
  const from = `${month}-01`;
  const end = new Date(`${monthDate(from, 12)}T12:00:00Z`);
  end.setUTCDate(0);
  const to = end.toISOString().slice(0, 10);
  const months = Array.from({ length: 12 }, (_, index) =>
    monthDate(from, index).slice(0, 7),
  );
  const selectedAccount = (id: string) =>
    (!selection.accountId || id === selection.accountId) &&
    (!selection.personId ||
      (id === "demo-card-extra" ? "demo-person-2" : "demo-person") ===
        selection.personId);
  const selectedEntries = entries.filter(
    (row) =>
      row.date >= from && row.date <= to && selectedAccount(row.accountId),
  );
  return {
    accounts: (
      [
        {
          allocatedCreditMinor: "1248000",
          availabilitySource: "provider",
          availableCreditMinor: "752000",
          balanceObservedAt: demoReferenceDay,
          creditLimitMinor: "2000000",
          currency: "BRL",
          hidden: false,
          id: "demo-card",
          identity: {
            cardBrand: "MASTERCARD",
            institution: {
              id: "201",
              logoUrl: "https://cdn.pluggy.ai/assets/connector-icons/201.svg",
              name: "Instituição de exemplo",
            },
          },
          limitSource: "provider",
          manual: false,
          name: "Cartão pessoal",
          personId: "demo-person",
          personName: "Ana Silva",
        },
        {
          allocatedCreditMinor: null,
          availabilitySource: "unavailable",
          availableCreditMinor: null,
          balanceObservedAt: demoReferenceDay,
          creditLimitMinor: null,
          currency: "BRL",
          hidden: false,
          id: "demo-card-extra",
          identity: { cardBrand: "VISA", institution: null },
          limitSource: "unavailable",
          manual: false,
          name: "Cartão adicional",
          personId: "demo-person-2",
          personName: "Bruno Costa",
        },
        {
          allocatedCreditMinor: null,
          availabilitySource: "unavailable",
          availableCreditMinor: null,
          balanceObservedAt: demoReferenceDay,
          creditLimitMinor: "500000",
          currency: "USD",
          hidden: false,
          id: "demo-card-usd",
          identity: { cardBrand: "AMEX", institution: null },
          limitSource: "manual",
          manual: true,
          name: "Cartão internacional",
          personId: "demo-person",
          personName: "Ana Silva",
        },
      ] satisfies CardCommitments["accounts"]
    ).filter((account) => selectedAccount(account.id)),
    assumptions: [
      "A demonstração usa somente dados fictícios. O exemplo inclui um cartão sem informações de limite e uma parcela pendente sem as demais ocorrências enviadas.",
    ],
    categories: currencies.flatMap((currency) =>
      [
        ...new Set(
          selectedEntries
            .filter((row) => row.currency === currency)
            .map((row) => row.categoryId),
        ),
      ].map((id) => {
        const rows = selectedEntries.filter(
          (row) => row.currency === currency && row.categoryId === id,
        );
        const amountMinor = rows
          .reduce((sum, row) => sum + BigInt(row.amountMinor ?? "0"), 0n)
          .toString();
        return {
          amountMinor,
          color:
            demoCategories.find((category) => category.id === id)?.color ??
            "#64748b",
          currency,
          id,
          knownAmountMinor: amountMinor,
          name: rows[0]?.categoryName ?? "Sem categoria",
          unknownAmountCount: 0,
        };
      }),
    ),
    categoryBasis: "observed_commitments",
    from,
    installments: installments.filter(
      (row) =>
        row.date >= from && row.date <= to && selectedAccount(row.accountId),
    ),
    month,
    months: months.flatMap((selected) =>
      currencies.map((currency) => ({
        ...totals({
          currency,
          from,
          month: selected,
          sourceEntries: selectedEntries,
          to,
        }),
        month: selected,
      })),
    ),
    referenceDay: demoReferenceDay,
    to,
    totals: currencies.map((currency) =>
      totals({ currency, from, sourceEntries: selectedEntries, to }),
    ),
    ...input,
  };
}
