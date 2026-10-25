// Only bounded visual proportions use Number; original monetary strings stay exact.
export function amountProportion(amount: string, total: string) {
  const numerator = BigInt(amount);
  const denominator = BigInt(total);
  if (numerator <= 0n || denominator <= 0n) {
    return 0;
  }
  const bounded = numerator > denominator ? denominator : numerator;
  const basisPoints = (bounded * 10_000n) / denominator;
  return Number.parseInt(basisPoints.toString(), 10) / 100;
}

export function percentageLabel(value: number) {
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

export interface InvestmentCategorySlice {
  amountMinor: string;
  color: string;
  id: string;
  name: string;
}

export function categorySlices(groups: InvestmentCategorySlice[]) {
  if (groups.some((group) => BigInt(group.amountMinor) < 0n)) {
    return null;
  }
  const total = groups.reduce(
    (sum, group) => sum + BigInt(group.amountMinor),
    0n,
  );
  if (total <= 0n) {
    return [];
  }
  return groups
    .filter((group) => BigInt(group.amountMinor) > 0n)
    .map((group) => ({
      ...group,
      proportion: amountProportion(group.amountMinor, total.toString()),
    }));
}
