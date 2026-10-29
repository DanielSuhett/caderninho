import type {
  PortalCard,
  PortalCardInstallment,
  PortalCards,
  PortalCardsQuery,
} from "../contracts";
import {
  cardChargeStatus,
  cardCredit,
  createCardActivity,
  isCardExpense,
  isCardInstallment,
  matchesFinancialIdentity,
} from "../domain";
import { demoPeople, demoReferenceDay } from "../fixtures/finance";
import type { DemoData } from "./demo-data";

type DemoCardLines = Map<
  string,
  {
    activity: ReturnType<typeof createCardActivity>;
    number: string | null;
  }
>;

export interface DemoCardEdit {
  creditLimitMinor?: string | null;
  hidden?: boolean;
  name?: string;
  personId?: string | null;
}

function demoPersonName(personId: string) {
  return (
    demoPeople.find((person) => person.id === personId)?.name ??
    "Pessoa de exemplo"
  );
}

function demoCardsOf(
  holder: { id: string; personId: string },
  lines: DemoCardLines,
  cardEdits: Map<string, DemoCardEdit>,
): PortalCard[] {
  const accountId = holder.id;
  return [...lines].map(([number, line], index) => {
    const { confirmed, future, pending } = line.activity.result();
    const edit = cardEdits.get(`${accountId}:${number}`);
    const personId = edit?.personId ?? holder.personId;
    return {
      confirmed,
      creditLimitMinor: index === 0 ? null : (edit?.creditLimitMinor ?? null),
      future,
      hidden: edit?.hidden ?? false,
      id: `${accountId}:${number}`,
      identified: !!edit?.name,
      name: edit?.name ?? line.number ?? "Cartão",
      number: line.number,
      pending,
      personId,
      personInherited: !edit?.personId,
      personName: demoPersonName(personId),
      primary: index === 0,
    };
  });
}

export function demoPrimaryCard(accountId: string) {
  return accountId === "demo-card-extra" ? "8080" : "4242";
}

function demoInstallment(
  row: DemoData["records"][number],
): PortalCardInstallment {
  return {
    accountId: row.accountId,
    amountMinor: row.amountMinor,
    cardNumber: row.cardNumber,
    categoryId: row.category,
    date: row.date,
    description: row.description,
    id: row.id,
    installmentNumber: row.installmentNumber ?? 0,
    purchaseDate: row.purchaseDate,
    status: cardChargeStatus(row, demoReferenceDay),
    totalInstallments: row.totalInstallments ?? 0,
  };
}

function demoLineNumber(accountLines: DemoCardLines, number: string) {
  return accountLines.has(number) ? number : accountLines.keys().next().value;
}

// Numbers seen in the ledger become cards, as the sync does for real accounts.
function registerDemoCards(
  records: DemoData["records"],
  lines: Map<string, DemoCardLines>,
  window: { month: string; referenceDay: string },
) {
  for (const row of records) {
    const accountLines = lines.get(row.accountId);
    if (accountLines && row.cardNumber && !accountLines.has(row.cardNumber)) {
      accountLines.set(row.cardNumber, {
        activity: createCardActivity(window),
        number: row.cardNumber,
      });
    }
  }
}

export function demoCards(
  query: PortalCardsQuery,
  data: DemoData,
  limits: Map<string, string> = new Map(),
  cardEdits: Map<string, DemoCardEdit> = new Map(),
): PortalCards {
  const window = { month: query.month, referenceDay: demoReferenceDay };
  const activity = createCardActivity(window);
  const lines = new Map<string, DemoCardLines>();
  const creditAccounts = data.accounts.filter(
    (account) =>
      account.type === "CREDIT" &&
      matchesFinancialIdentity(account.identity, query),
  );
  for (const account of creditAccounts) {
    const primary = demoPrimaryCard(account.id);
    lines.set(
      account.id,
      new Map([
        [primary, { activity: createCardActivity(window), number: primary }],
      ]),
    );
  }
  registerDemoCards(data.records, lines, window);
  const ownerOf = (accountId: string, number: string | undefined) => {
    const account = creditAccounts.find((item) => item.id === accountId);
    return (
      cardEdits.get(`${accountId}:${number}`)?.personId ?? account?.personId
    );
  };
  const accounts = creditAccounts
    .filter(
      (account) =>
        !query.personId ||
        [...(lines.get(account.id)?.keys() ?? [])].some(
          (number) => ownerOf(account.id, number) === query.personId,
        ),
    )
    .map((account) => ({
      ...cardCredit({
        available: account.id === "demo-card-extra" ? "1000000" : "761240",
        limit: "1000000",
        localLimit: limits.get(account.id),
      }),
      allocatedMinor: account.id === "demo-card-extra" ? "0" : "238760",
      balanceObservedAt: account.balanceObservedAt ?? null,
      cardNumber: demoPrimaryCard(account.id),
      closeDate: "2026-10-25",
      currency: account.currency,
      dueDate: "2026-11-02",
      id: account.id,
      identity: account.identity,
      manual: false,
      name: account.name,
      personId: account.personId,
      personName: demoPersonName(account.personId),
    }));
  // An unknown, hidden or foreign card in the query falls back to every card.
  const focus = accounts
    .flatMap((account) =>
      [...(lines.get(account.id)?.keys() ?? [])].map((number) => ({
        id: `${account.id}:${number}`,
        visible:
          !cardEdits.get(`${account.id}:${number}`)?.hidden &&
          (!query.personId || ownerOf(account.id, number) === query.personId),
      })),
    )
    .find((card) => card.id === query.cardId && card.visible)?.id;
  const selected = new Set(
    accounts
      .filter(
        (account) =>
          (!query.accountId || account.id === query.accountId) &&
          (!focus || focus.startsWith(`${account.id}:`)),
      )
      .map((account) => account.id),
  );
  const installments: PortalCardInstallment[] = [];
  for (const row of data.records) {
    if (
      row.ignored ||
      !selected.has(row.accountId) ||
      row.currency !== query.currency ||
      !isCardExpense({
        categoryKind: data.categories.find(
          (category) => category.id === row.category,
        )?.kind,
        direction: row.direction,
        operationType: row.identification?.operationType,
      })
    ) {
      continue;
    }
    const accountLines = lines.get(row.accountId);
    const lineNumber = accountLines
      ? demoLineNumber(accountLines, row.cardNumber ?? "")
      : undefined;
    accountLines?.get(lineNumber ?? "")?.activity.add(row);
    if (
      (focus && `${row.accountId}:${lineNumber}` !== focus) ||
      (query.personId && ownerOf(row.accountId, lineNumber) !== query.personId)
    ) {
      continue;
    }
    activity.add(row);
    if (row.date.slice(0, 7) === query.month && isCardInstallment(row)) {
      installments.push(demoInstallment(row));
    }
  }
  return {
    ...activity.result(),
    accounts: accounts.map((account) => ({
      ...account,
      cards: demoCardsOf(
        account,
        lines.get(account.id) ?? new Map(),
        cardEdits,
      ).filter((card) => !query.personId || card.personId === query.personId),
    })),
    currencies: [...new Set(accounts.map((account) => account.currency))],
    currency: query.currency,
    installments: installments.toSorted((a, b) => b.date.localeCompare(a.date)),
    month: query.month,
    nextCursor: null,
    referenceDay: demoReferenceDay,
  };
}
