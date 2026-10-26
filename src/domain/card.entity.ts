import { monthDate } from "./planning.entity";

export interface CardAmount {
  count: number;
  knownMinor: string;
  totalMinor: string | null;
  unknownCount: number;
}
export interface CardActivityRow {
  amountMinor: string | null;
  category: string | null;
  date: string;
  direction: "DEBIT" | "CREDIT";
  installmentNumber: number | null;
  status: "POSTED" | "PENDING";
  totalInstallments: number | null;
}
export const CardChargeStatus = {
  confirmed: "confirmed",
  future: "future",
  pending: "pending",
} as const;
export function cardChargeStatus(
  row: Pick<CardActivityRow, "date" | "status">,
  referenceDay: string,
) {
  if (row.date > referenceDay) {
    return CardChargeStatus.future;
  }
  return row.status === "PENDING"
    ? CardChargeStatus.pending
    : CardChargeStatus.confirmed;
}
export function isCardInstallment(row: CardActivityRow) {
  return (
    row.direction === "DEBIT" &&
    row.installmentNumber !== null &&
    row.totalInstallments !== null &&
    row.totalInstallments > 1 &&
    row.installmentNumber > 0 &&
    row.installmentNumber <= row.totalInstallments
  );
}
const emptyAmount = (): CardAmount => ({
  count: 0,
  knownMinor: "0",
  totalMinor: "0",
  unknownCount: 0,
});
function addAmount(total: CardAmount, value: string | null, sign = 1n) {
  total.count += 1;
  if (value === null) {
    total.unknownCount += 1;
  } else {
    const amount = BigInt(value);
    total.knownMinor = (
      BigInt(total.knownMinor) +
      (amount < 0n ? -amount : amount) * sign
    ).toString();
  }
  total.totalMinor = total.unknownCount ? null : total.knownMinor;
}

// Incremental aggregation keeps the complete totals independent of detail pagination.
// Callers select CREDIT accounts and exclude transfers, invoice payments and ignored rows.
export function createCardActivity({
  month,
  referenceDay,
}: {
  month: string;
  referenceDay: string;
}) {
  const confirmed = emptyAmount();
  const purchases = emptyAmount();
  const refunds = emptyAmount();
  const pending = emptyAmount();
  const future = emptyAmount();
  const categories = new Map<string | null, CardAmount>();
  const months = Array.from({ length: 12 }, (_, index) => ({
    confirmed: emptyAmount(),
    future: emptyAmount(),
    month: monthDate(`${month}-01`, index).slice(0, 7),
    pending: emptyAmount(),
  }));
  const monthly = new Map(months.map((row) => [row.month, row]));
  return {
    add(row: CardActivityRow) {
      const rowMonth = row.date.slice(0, 7);
      const state = cardChargeStatus(row, referenceDay);
      const period = monthly.get(rowMonth);
      if (period && isCardInstallment(row)) {
        addAmount(period[state], row.amountMinor);
      }
      if (rowMonth !== month) {
        return;
      }
      if (row.direction === "CREDIT") {
        if (state === CardChargeStatus.confirmed) {
          addAmount(refunds, row.amountMinor);
          addAmount(confirmed, row.amountMinor, -1n);
        }
        return;
      }
      if (state !== CardChargeStatus.confirmed) {
        addAmount(
          state === CardChargeStatus.future ? future : pending,
          row.amountMinor,
        );
        return;
      }
      addAmount(confirmed, row.amountMinor);
      addAmount(purchases, row.amountMinor);
      const category = categories.get(row.category) ?? emptyAmount();
      addAmount(category, row.amountMinor);
      categories.set(row.category, category);
    },
    result() {
      return {
        categories: [...categories].map(([categoryId, amount]) => ({
          ...amount,
          categoryId,
        })),
        confirmed,
        future,
        months,
        pending,
        purchases,
        refunds,
      };
    },
  };
}

export function allocatedCredit(
  limit: string | null,
  available: string | null,
) {
  return limit === null || available === null
    ? null
    : (BigInt(limit) - BigInt(available)).toString();
}

// Keep observed occupancy; a local limit changes only the estimated availability.
export function cardCredit({
  limit,
  available,
  localLimit,
}: {
  limit: string | null;
  available: string | null;
  localLimit?: string | null | undefined;
}) {
  const allocated = allocatedCredit(limit, available);
  const edited = localLimit !== null && localLimit !== undefined;
  let resolvedAvailable = available;
  if (edited) {
    resolvedAvailable =
      allocated === null
        ? null
        : (BigInt(localLimit) - BigInt(allocated)).toString();
  }
  return {
    allocatedCreditMinor: allocated,
    availableCreditMinor: resolvedAvailable,
    creditEstimated: edited,
    creditLimitMinor: localLimit ?? limit,
  };
}

export function isCardExpense({
  direction,
  categoryKind,
  operationType,
}: {
  direction: "DEBIT" | "CREDIT";
  categoryKind: string | undefined;
  operationType: string | null | undefined;
}) {
  if (
    operationType === "PAGAMENTO_FATURA" ||
    categoryKind === "transfer" ||
    categoryKind === "income"
  ) {
    return false;
  }
  return direction === "DEBIT" || categoryKind === "expense";
}
