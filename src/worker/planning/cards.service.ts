import type {
  PortalCard,
  PortalCardInstallment,
  PortalCards,
  PortalCardsQuery,
} from "../../contracts";
import {
  AccountType,
  cardChargeStatus,
  cardCredit,
  createCardActivity,
  isCardExpense,
  isCardInstallment,
  localDay,
  matchesFinancialIdentity,
  monthDate,
  type PlanningTransaction,
  type TransactionDetails,
} from "../../domain";
import { planningCursor } from "./cursor";
import type { PlanningRepository, PlanningSnapshot } from "./entity";
import {
  accounts,
  cardCatalog,
  cardOwnership,
  found,
  transactionStream,
} from "./projection";

type CardAccount = Omit<PortalCards["accounts"][number], "cards">;
type CardLines = Map<
  string,
  {
    activity: ReturnType<typeof createCardActivity>;
    entry: ReturnType<typeof cardCatalog>[number];
  }
>;

function installmentRecord(
  row: PlanningTransaction,
  extra: TransactionDetails | undefined,
  referenceDay: string,
): PortalCardInstallment {
  return {
    accountId: row.accountId,
    amountMinor: row.amountMinor,
    cardNumber: extra?.cardNumber ?? null,
    categoryId: row.category,
    date: row.date,
    description: row.description,
    id: row.id,
    installmentNumber: extra?.installmentNumber ?? 0,
    purchaseDate: extra?.purchaseDate ?? null,
    status: cardChargeStatus(row, referenceDay),
    totalInstallments: extra?.totalInstallments ?? 0,
  };
}

// Every card of an account gets its own activity. Charges without a card number
// follow the account's primary card, so the cards always add up to the account.
function accountCardLines(
  accountIds: string[],
  snapshot: PlanningSnapshot,
  activity: Parameters<typeof createCardActivity>[0],
) {
  const result = new Map<string, CardLines>();
  const wanted = new Set(accountIds);
  const catalog = cardCatalog(snapshot, snapshot.state)
    .filter((entry) => wanted.has(entry.accountId) && !entry.deleted)
    .toSorted(
      (a, b) =>
        Number(b.primary) - Number(a.primary) ||
        a.number.localeCompare(b.number),
    );
  for (const entry of catalog) {
    const lines = result.get(entry.accountId) ?? new Map();
    lines.set(entry.number, { activity: createCardActivity(activity), entry });
    result.set(entry.accountId, lines);
  }
  return result;
}

function chargeLine(
  lines: Map<string, CardLines>,
  row: { accountId: string },
  number: string | undefined | null,
) {
  const account = lines.get(row.accountId);
  if (!account) {
    return;
  }
  return (
    (number && account.get(number)) ||
    [...account.values()].find((line) => line.entry.primary)
  );
}

// An unknown, hidden or foreign card in the URL falls back to every card.
function focusedCard(
  lines: Map<string, CardLines>,
  input: Pick<PortalCardsQuery, "cardId" | "personId">,
) {
  if (!input.cardId) {
    return;
  }
  for (const account of lines.values()) {
    for (const { entry } of account.values()) {
      if (
        entry.id === input.cardId &&
        !entry.hidden &&
        (!input.personId || entry.personId === input.personId)
      ) {
        return entry;
      }
    }
  }
}

function portalCardsOf(
  lines: CardLines | undefined,
  personId: string | undefined,
): PortalCard[] {
  return [...(lines?.values() ?? [])]
    .filter(({ entry }) => !personId || entry.personId === personId)
    .map(({ activity, entry }) => {
      const { confirmed, future, pending } = activity.result();
      return {
        confirmed,
        future,
        hidden: entry.hidden,
        id: entry.id,
        identified: entry.identified,
        name: entry.name,
        number: entry.number === "main" ? null : entry.number,
        pending,
        personId: entry.personId,
        personInherited: entry.personInherited,
        personName: entry.personName,
        primary: entry.primary,
      };
    });
}

function selectedCards(
  input: PortalCardsQuery,
  snapshot: PlanningSnapshot,
): CardAccount[] {
  found(snapshot.state.spaces.find((space) => space.id === input.spaceId));
  if (input.personId) {
    found(snapshot.people.find((person) => person.id === input.personId));
  }
  const ownership = cardOwnership(snapshot);
  const selected = accounts(snapshot).filter(
    (account) =>
      account.type === AccountType.CREDIT &&
      account.spaceId === input.spaceId &&
      (!input.personId || ownership.includesPerson(account, input.personId)),
  );
  if (input.accountId) {
    found(selected.find((account) => account.id === input.accountId));
  }
  const details = new Map(snapshot.accountDetails.map((row) => [row.id, row]));
  return selected
    .filter((account) => matchesFinancialIdentity(account.identity, input))
    .map((account) => {
      const extra = details.get(account.id);
      const credit = cardCredit({
        available: extra?.availableCreditMinor ?? null,
        limit: extra?.creditLimitMinor ?? null,
        localLimit: snapshot.state.accounts.find((row) => row.id === account.id)
          ?.creditLimitMinor,
      });
      return {
        allocatedMinor: credit.allocatedCreditMinor,
        availableCreditMinor: credit.availableCreditMinor,
        balanceObservedAt: account.balanceObservedAt,
        cardNumber: extra?.cardNumber ?? null,
        closeDate: extra?.closeDate ?? null,
        creditEstimated: credit.creditEstimated,
        creditLimitMinor: credit.creditLimitMinor,
        currency: account.currency,
        dueDate: extra?.dueDate ?? null,
        id: account.id,
        identity: account.identity ?? null,
        manual: account.manual,
        name: account.name,
        personId: account.personId,
        personName: account.personName,
      };
    });
}

export async function portalCards(
  input: PortalCardsQuery,
  snapshot: PlanningSnapshot,
  repository: PlanningRepository,
  now: Date,
): Promise<PortalCards> {
  const referenceDay = localDay(now);
  const { cursor, ...selection } = input;
  const { after, encode } = await planningCursor({
    cursor,
    filter: { ...selection, referenceDay },
    revision: snapshot.revision,
  });
  const activityWindow = { month: input.month, referenceDay };
  const activity = createCardActivity(activityWindow);
  const availableCards = selectedCards(input, snapshot);
  const cardLines = accountCardLines(
    availableCards.map((account) => account.id),
    snapshot,
    activityWindow,
  );
  const focus = focusedCard(cardLines, input);
  const cardAccounts = availableCards.filter(
    (account) =>
      (!input.accountId || account.id === input.accountId) &&
      (!focus || account.id === focus.accountId),
  );
  const metadata = new Map(
    snapshot.transactionDetails.map((row) => [row.id, row]),
  );
  const categories = new Map(
    snapshot.state.categories.map((row) => [row.id, row]),
  );
  const currencies = new Set(cardAccounts.map((account) => account.currency));
  const installments: PortalCardInstallment[] = [];
  const key = (row: { date: string; id: string }) => `${row.date}:${row.id}`;
  const rows = transactionStream(
    repository,
    snapshot,
  )({
    accountIds: cardAccounts.map((account) => account.id),
    from: `${input.month}-01`,
    personId: input.personId,
    spaceId: input.spaceId,
    to: new Date(
      Date.parse(`${monthDate(`${input.month}-01`, 12)}T00:00:00Z`) -
        86_400_000,
    )
      .toISOString()
      .slice(0, 10),
  });
  for await (const row of rows) {
    const extra = metadata.get(row.id);
    const kind = categories.get(row.category ?? "")?.kind;
    if (
      !isCardExpense({
        categoryKind: kind,
        direction: row.direction,
        operationType: extra?.operationType,
      })
    ) {
      continue;
    }
    currencies.add(row.currency);
    if (row.currency !== input.currency) {
      continue;
    }
    const charge = {
      ...row,
      installmentNumber: extra?.installmentNumber ?? null,
      totalInstallments: extra?.totalInstallments ?? null,
    };
    const line = chargeLine(cardLines, row, extra?.cardNumber);
    line?.activity.add(charge);
    if (focus && line?.entry.id !== focus.id) {
      continue;
    }
    activity.add(charge);
    if (
      row.date.slice(0, 7) !== input.month ||
      !isCardInstallment(charge) ||
      (after && key(row) >= after)
    ) {
      continue;
    }
    installments.push(installmentRecord(row, extra, referenceDay));
    // Keep binary ordering aligned with the cursor comparison above.
    installments.sort((a, b) => {
      const left = key(a);
      const right = key(b);
      if (left === right) {
        return 0;
      }
      return left < right ? 1 : -1;
    });
    if (installments.length > 51) {
      installments.pop();
    }
  }
  const records = installments.slice(0, 50);
  const last = records.at(-1);
  return {
    ...activity.result(),
    accounts: availableCards.map((account) => ({
      ...account,
      cards: portalCardsOf(cardLines.get(account.id), input.personId),
    })),
    currencies: [...currencies].sort(),
    currency: input.currency,
    installments: records,
    month: input.month,
    nextCursor: installments.length > 50 && last ? encode(key(last)) : null,
    referenceDay,
  };
}
