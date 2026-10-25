import type {
  PortalCardInstallment,
  PortalCards,
  PortalCardsQuery,
} from "../contracts";
import {
  cardChargeStatus,
  createCardActivity,
  isCardExpense,
  isCardInstallment,
} from "../domain";
import { demoPeople, demoReferenceDay } from "../fixtures/finance";
import type { DemoData } from "./demo-data";

export function demoCards(
  query: PortalCardsQuery,
  data: DemoData,
): PortalCards {
  const activity = createCardActivity({
    month: query.month,
    referenceDay: demoReferenceDay,
  });
  const accounts = data.accounts
    .filter(
      (account) =>
        account.type === "CREDIT" &&
        (!query.personId || account.personId === query.personId),
    )
    .map((account) => ({
      allocatedMinor: account.id === "demo-card-extra" ? "0" : "238760",
      availableCreditMinor:
        account.id === "demo-card-extra" ? "1000000" : "761240",
      balanceObservedAt: account.balanceObservedAt ?? null,
      cardNumber: account.id === "demo-card-extra" ? "8080" : "4242",
      closeDate: "2026-10-25",
      creditLimitMinor: "1000000",
      currency: account.currency,
      dueDate: "2026-11-02",
      id: account.id,
      identity: account.identity,
      name: account.name,
      personId: account.personId,
      personName:
        demoPeople.find((person) => person.id === account.personId)?.name ??
        "Pessoa de exemplo",
    }));
  const selected = new Set(
    accounts
      .filter((account) => !query.accountId || account.id === query.accountId)
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
    activity.add(row);
    if (row.date.slice(0, 7) === query.month && isCardInstallment(row)) {
      installments.push({
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
      });
    }
  }
  return {
    ...activity.result(),
    accounts,
    currencies: [...new Set(accounts.map((account) => account.currency))],
    currency: query.currency,
    installments: installments.toSorted((a, b) => b.date.localeCompare(a.date)),
    month: query.month,
    nextCursor: null,
    referenceDay: demoReferenceDay,
  };
}
