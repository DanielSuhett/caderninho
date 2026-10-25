import type {
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
  const personId = params.get("person");
  const spaceId = params.get("space") ?? "personal";
  const accounts = data?.accounts ?? [];
  const [firstAccount] = accounts;
  return {
    context: [
      catalog?.spaces.find((space) => space.id === spaceId)?.name ?? spaceId,
      snapshot.people.find((person) => person.id === personId)?.name ??
        (snapshot.people.length > 1 ? "Todas as pessoas" : ""),
      accounts.find((account) => account.id === accountId)?.name ??
        (accounts.length === 1 ? firstAccount?.name : "Todos os cartões"),
      data?.currency,
    ]
      .filter(Boolean)
      .join(" · "),
    hasFilters: !!(
      accountId ||
      personId ||
      spaceId !== "personal" ||
      snapshot.people.length > 1 ||
      accounts.length > 1 ||
      (catalog && catalog.spaces.length > 1)
    ),
  };
}
