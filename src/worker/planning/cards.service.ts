import type {
  PortalCardInstallment,
  PortalCards,
  PortalCardsQuery,
} from "../../contracts";
import {
  AccountType,
  allocatedCredit,
  cardChargeStatus,
  createCardActivity,
  isCardExpense,
  isCardInstallment,
  localDay,
  monthDate,
  type PlanningTransaction,
  type TransactionDetails,
} from "../../domain";
import { planningCursor } from "./cursor";
import type { PlanningRepository, PlanningSnapshot } from "./entity";
import { accounts, found, transactionStream } from "./projection";

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

function selectedCards(
  input: PortalCardsQuery,
  snapshot: PlanningSnapshot,
): PortalCards["accounts"] {
  found(snapshot.state.spaces.find((space) => space.id === input.spaceId));
  if (input.personId) {
    found(snapshot.people.find((person) => person.id === input.personId));
  }
  const selected = accounts(snapshot).filter(
    (account) =>
      account.type === AccountType.CREDIT &&
      account.spaceId === input.spaceId &&
      (!input.personId || account.personId === input.personId),
  );
  if (input.accountId) {
    found(selected.find((account) => account.id === input.accountId));
  }
  const details = new Map(snapshot.accountDetails.map((row) => [row.id, row]));
  return selected.map((account) => {
    const extra = details.get(account.id);
    const limit = extra?.creditLimitMinor ?? null;
    const available = extra?.availableCreditMinor ?? null;
    return {
      allocatedMinor: allocatedCredit(limit, available),
      availableCreditMinor: available,
      balanceObservedAt: account.balanceObservedAt,
      cardNumber: extra?.cardNumber ?? null,
      closeDate: extra?.closeDate ?? null,
      creditLimitMinor: limit,
      currency: account.currency,
      dueDate: extra?.dueDate ?? null,
      id: account.id,
      identity: account.identity ?? null,
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
  const activity = createCardActivity({ month: input.month, referenceDay });
  const availableCards = selectedCards(input, snapshot);
  const cardAccounts = availableCards.filter(
    (account) => !input.accountId || account.id === input.accountId,
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
    accounts: availableCards,
    currencies: [...currencies].sort(),
    currency: input.currency,
    installments: records,
    month: input.month,
    nextCursor: installments.length > 50 && last ? encode(key(last)) : null,
    referenceDay,
  };
}
