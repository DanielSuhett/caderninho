export interface EmergencyReserve {
  accountIds: string[];
  id: string;
  investmentIds: string[];
  months: number;
  personId: string;
  spaceId: string;
}

export const reserveDefaults = {
  maxMonths: 24,
  months: 6,
  // Closed months averaged to estimate the fixed monthly cost.
  window: 3,
} as const;

export function reserveId(spaceId: string, personId: string) {
  return `${spaceId}:reserve:${personId}`;
}

// The last `count` whole calendar months before `day`, oldest first.
export function closedMonths(day: string, count: number) {
  const [year = 0, month = 1] = day.split("-").map(Number);
  return Array.from({ length: count }, (_, index) => {
    const offset = count - index;
    const start = new Date(Date.UTC(year, month - 1 - offset, 1));
    const end = new Date(Date.UTC(year, month - offset, 0));
    return {
      from: start.toISOString().slice(0, 10),
      month: start.toISOString().slice(0, 7),
      to: end.toISOString().slice(0, 10),
    };
  });
}

export const ReserveHealth = {
  full: "full",
  low: "low",
  partial: "partial",
} as const;
export type ReserveHealth = (typeof ReserveHealth)[keyof typeof ReserveHealth];

// Below half of the target is low; from half until the target, partial.
function reserveHealth(saved: bigint, target: bigint): ReserveHealth {
  if (saved >= target) {
    return ReserveHealth.full;
  }
  if (saved * 2n < target) {
    return ReserveHealth.low;
  }
  return ReserveHealth.partial;
}

/**
 * Average per fixed-cost category over the closed months, largest first. A
 * category paid in every month could return to its lowest month; the gap is
 * its reduction opportunity. Sporadic charges (annual taxes) have none.
 */
export function fixedCostBreakdown(months: Map<string, bigint>[]) {
  const span = BigInt(Math.max(months.length, 1));
  const ids = new Set(months.flatMap((month) => [...month.keys()]));
  const rows = [...ids].map((id) => {
    const values = months.map((month) => month.get(id) ?? 0n);
    const average = values.reduce((sum, value) => sum + value, 0n) / span;
    const lowest = values.reduce((low, value) => (value < low ? value : low));
    const recurring = lowest > 0n;
    return {
      average,
      id,
      lowest: recurring ? lowest : null,
      reduction: recurring && average > lowest ? average - lowest : 0n,
    };
  });
  rows.sort(
    (a, b) => Number(b.average > a.average) - Number(b.average < a.average),
  );
  return {
    categories: rows.map((row) => ({
      averageMinor: row.average.toString(),
      id: row.id,
      lowestMinor: row.lowest === null ? null : row.lowest.toString(),
      reductionMinor: row.reduction.toString(),
    })),
    reductionMinor: rows
      .reduce((sum, row) => sum + row.reduction, 0n)
      .toString(),
  };
}

/**
 * Target = months × average fixed cost of the closed window, rounded up to the
 * minor unit. Linked balances only count when every one of them is known.
 */
export function emergencyReservePlan({
  months,
  monthlyMinor,
  balancesMinor,
}: {
  months: number;
  monthlyMinor: bigint[];
  balancesMinor: (bigint | null)[];
}) {
  const total = monthlyMinor.reduce((sum, value) => sum + value, 0n);
  const span = BigInt(Math.max(monthlyMinor.length, 1));
  const average = (total + span - 1n) / span;
  const target = average * BigInt(months);
  const known = balancesMinor.every((value) => value !== null);
  const saved = known
    ? balancesMinor.reduce<bigint>((sum, value) => sum + (value ?? 0n), 0n)
    : null;
  return {
    averageMinor: average.toString(),
    coveredMonths:
      saved === null || average === 0n
        ? null
        : Number.parseInt(((saved * 10n) / average).toString(), 10) / 10,
    // Health needs something linked; an empty reserve has no reading yet.
    health:
      saved === null || target === 0n || balancesMinor.length === 0
        ? null
        : reserveHealth(saved, target),
    remainingMinor:
      saved === null ? null : (target > saved ? target - saved : 0n).toString(),
    savedMinor: saved === null ? null : saved.toString(),
    surplusMinor:
      saved === null || saved <= target ? null : (saved - target).toString(),
    targetMinor: target.toString(),
  };
}
