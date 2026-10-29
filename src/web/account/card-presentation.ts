import type {
  PortalCard,
  PortalCards,
  PortalResponse,
  WorkspaceCatalog,
} from "../../contracts";

export function cardPercentage(amount: string | null, total: string | null) {
  if (amount === null || total === null || BigInt(total) <= 0n) {
    return null;
  }
  const tenths = (BigInt(amount) * 1000n) / BigInt(total);
  const bounded = tenths < 0n ? 0n : tenths;
  return {
    label: `${bounded / 10n},${bounded % 10n}%`,
    meter: Number(bounded > 1000n ? 1000n : bounded) / 10,
  };
}

// Month spend of one card: confirmed net of refunds plus charges still pending.
export function cardMonthSpend(
  card: Pick<PortalCard, "confirmed" | "pending">,
) {
  if (card.confirmed.totalMinor === null || card.pending.totalMinor === null) {
    return null;
  }
  return (
    BigInt(card.confirmed.totalMinor) + BigInt(card.pending.totalMinor)
  ).toString();
}

// Inside Cartões the avatar already shows bank and brand, so only the digits
// (and a name the owner chose) remain.
export function cardDigitsLabel(
  card: Pick<PortalCard, "identified" | "name" | "number">,
) {
  if (!card.number) {
    return card.identified ? card.name : "Principal";
  }
  return card.identified
    ? `${card.name} · ${card.number}`
    : `•••• ${card.number}`;
}

// The last digits are an observed identifier, so they stay visible even when the
// owner named the card; an unnamed card shows only the digits.
export function cardLabel(
  card: Pick<PortalCard, "identified" | "name" | "number">,
) {
  if (!card.number) {
    return card.identified ? card.name : "Cartão principal";
  }
  if (!card.identified) {
    return `Cartão final ${card.number}`;
  }
  return `${card.name} · final ${card.number}`;
}

export function installmentCardLabel(
  account: PortalCards["accounts"][number] | undefined,
  number: string | null,
) {
  const card = account?.cards.find((item) =>
    number ? item.number === number : item.primary,
  );
  return card ? cardLabel(card) : null;
}

export function scopeParameters(input: {
  accountId: string;
  cardId: string;
  cursor: string | null;
  personId: string;
}) {
  return {
    ...(input.personId && { personId: input.personId }),
    ...(input.accountId && { accountId: input.accountId }),
    ...(input.cardId && { cardId: input.cardId }),
    ...(input.cursor && { cursor: input.cursor }),
  };
}

export function activeCardFilters(input: {
  accountId: string;
  cardId: string;
  personId: string;
  spaceId: string;
}) {
  return [
    input.accountId || input.cardId,
    input.personId,
    input.spaceId !== "personal",
  ].filter(Boolean).length;
}

export function cardChoices(accounts: PortalCards["accounts"]) {
  return accounts.flatMap((account) =>
    account.cards
      .filter((card) => !card.hidden)
      .map((card) => ({ account, card })),
  );
}

// Old links may carry only the account; a card in the URL narrows to its account.
export function focusedAccountId(
  accounts: PortalCards["accounts"],
  accountId: string,
  cardId: string,
) {
  return (
    accountId ||
    accounts.find((account) => account.cards.some((card) => card.id === cardId))
      ?.id ||
    ""
  );
}

export function cardScope({
  data,
  catalog,
  snapshot,
  params,
}: {
  data: PortalCards | undefined;
  catalog: WorkspaceCatalog | undefined;
  snapshot: PortalResponse;
  params: URLSearchParams;
}) {
  const accountId = params.get("accountId");
  const cardId = params.get("cardId");
  const choice = cardChoices(data?.accounts ?? []).find(
    ({ card }) => card.id === cardId,
  );
  const personId = params.get("person");
  const spaceId = params.get("space") ?? "personal";
  const accounts = data?.accounts ?? [];
  const [firstAccount] = accounts;
  return {
    context: [
      catalog?.spaces.find((space) => space.id === spaceId)?.name ?? spaceId,
      snapshot.people.find((person) => person.id === personId)?.name ??
        (snapshot.people.length > 1 ? "Todas as pessoas" : ""),
      (choice && `${choice.account.name} · ${cardLabel(choice.card)}`) ||
        (accounts.find((account) => account.id === accountId)?.name ??
          (accounts.length === 1 ? firstAccount?.name : "Todos os cartões")),
      data?.currency,
    ]
      .filter(Boolean)
      .join(" · "),
    hasFilters: !!(
      personId ||
      spaceId !== "personal" ||
      snapshot.people.length > 1 ||
      (catalog && catalog.spaces.length > 1)
    ),
  };
}
