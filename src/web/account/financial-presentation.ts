import type { FinancialOverview, FinancialSummary } from "../../contracts";

export function summaryCurrency(summary: FinancialOverview, currency: string) {
  const total = summary.totals.find((item) => item.currency === currency);
  const accounts = summary.accounts.filter(
    (account) => account.currency === currency && !account.hidden,
  );
  const banks = accounts.filter((account) => account.type === "BANK");
  const unknownBalances = banks.some(
    (account) => account.balanceMinor === null,
  );
  const bankBalance =
    unknownBalances || !banks.length
      ? null
      : banks
          .reduce(
            (sum, account) => sum + BigInt(account.balanceMinor ?? "0"),
            0n,
          )
          .toString();
  return { accounts, bankBalance, total };
}
export function categoryVolumes(summary: FinancialSummary, currency: string) {
  const groups = summary.groups
    .filter((item) => item.currency === currency)
    .toSorted((a, b) => {
      const difference = BigInt(b.amountMinor) - BigInt(a.amountMinor);
      if (difference === 0n) {
        return a.group.localeCompare(b.group);
      }
      return difference < 0n ? -1 : 1;
    });
  const absolute = (value: string) => {
    const number = BigInt(value);
    return number < 0n ? -number : number;
  };
  const max = groups.reduce(
    (value, group) =>
      absolute(group.amountMinor) > value ? absolute(group.amountMinor) : value,
    0n,
  );
  return groups.map((group) => {
    const basisPoints =
      max > 0n ? (absolute(group.amountMinor) * 10_000n) / max : 0n;
    return { ...group, volume: Number(basisPoints) / 100 };
  });
}
// Only the bounded plotting scale is numeric; displayed amounts remain original integer strings.
export function safeChartValues(groups: FinancialSummary["groups"]) {
  const limit = BigInt(Number.MAX_SAFE_INTEGER);
  if (
    groups.some(
      (group) =>
        BigInt(group.amountMinor) > limit || BigInt(group.amountMinor) < -limit,
    )
  ) {
    return null;
  }
  return groups.map((group) => Number(group.amountMinor));
}

export function displayCurrency(
  requested: string | null,
  available: string[],
  preferred: string,
) {
  if (requested && available.includes(requested)) {
    return requested;
  }
  if (available.includes(preferred)) {
    return preferred;
  }
  return available[0] ?? preferred;
}
