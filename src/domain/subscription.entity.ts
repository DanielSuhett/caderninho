import type { TransactionProjection } from "./finance.entity";
import { monthDate } from "./planning.entity";

export const SubscriptionCadence = {
  monthly: "monthly",
  quarterly: "quarterly",
  weekly: "weekly",
  yearly: "yearly",
} as const;
export type SubscriptionCadence =
  (typeof SubscriptionCadence)[keyof typeof SubscriptionCadence];

export interface SubscriptionCandidate {
  accountId: string;
  amountMinor: string;
  cadence: SubscriptionCadence;
  cardNumber: string | null;
  currency: string;
  evidence: { amountMinor: string; date: string; transactionId: string }[];
  firstSeen: string;
  lastSeen: string;
  maxAmountMinor: string;
  minAmountMinor: string;
  name: string;
  nextExpectedDate: string;
  observedTotalMinor: string;
  occurrences: number;
}

const periods = [
  { cadence: SubscriptionCadence.weekly, days: 7, months: 0, tolerance: 2 },
  { cadence: SubscriptionCadence.monthly, days: 0, months: 1, tolerance: 3 },
  { cadence: SubscriptionCadence.quarterly, days: 0, months: 3, tolerance: 7 },
  { cadence: SubscriptionCadence.yearly, days: 0, months: 12, tolerance: 14 },
];
const dayMilliseconds = 86_400_000;
function nextDate(date: string, period: (typeof periods)[number]) {
  if (period.months) {
    return monthDate(date, period.months);
  }
  return new Date(Date.parse(date) + period.days * dayMilliseconds)
    .toISOString()
    .slice(0, 10);
}
function normalizeName(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toUpperCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}
function chargeIdentity(row: TransactionProjection) {
  const merchant = row.identification?.merchant;
  const name = merchant?.name?.trim() || merchant?.businessName?.trim();
  const document = merchant?.cnpj?.replace(/\D/g, "");
  return {
    key:
      document?.length === 14
        ? document
        : normalizeName(name || row.description),
    name: name || row.description,
  };
}
function chargeAmount(row: TransactionProjection) {
  const amount = BigInt(row.amountMinor ?? "0");
  return amount < 0n ? -amount : amount;
}

function groupCharges(transactions: TransactionProjection[]) {
  const groups = new Map<string, TransactionProjection[]>();
  for (const row of transactions) {
    const card = row.identification?.creditCardMetadata;
    const operation =
      row.identification?.operationType ?? row.details?.operationType;
    if (
      row.status !== "POSTED" ||
      row.direction !== "DEBIT" ||
      row.amountMinor === null ||
      chargeAmount(row) === 0n ||
      (card?.totalInstallments ?? row.details?.totalInstallments ?? 0) > 1 ||
      (card?.installmentNumber ?? row.details?.installmentNumber ?? 0) > 1 ||
      operation === "PAGAMENTO_FATURA" ||
      operation === "TRANSFERENCIA_MESMA_INSTITUICAO"
    ) {
      continue;
    }
    const identity = chargeIdentity(row);
    if (!identity.key) {
      continue;
    }
    const key = JSON.stringify([
      row.accountId,
      row.currency,
      card?.cardNumber ?? row.details?.cardNumber ?? null,
      identity.key,
    ]);
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }
  return groups.values();
}

export function detectSubscriptions(input: {
  minOccurrences: number;
  transactions: TransactionProjection[];
}): SubscriptionCandidate[] {
  const candidates: SubscriptionCandidate[] = [];
  for (const group of groupCharges(input.transactions)) {
    if (group.length < input.minOccurrences) {
      continue;
    }
    group.sort(
      (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id),
    );
    const [first] = group;
    const last = group.at(-1);
    if (!(first && last)) {
      continue;
    }
    const amounts = group.map(chargeAmount);
    const minimum = amounts.reduce((a, b) => (a < b ? a : b));
    const maximum = amounts.reduce((a, b) => (a > b ? a : b));
    // Similar amounts support a candidate; arbitrary repeat shopping does not.
    if ((maximum - minimum) * 100n > minimum * 20n) {
      continue;
    }
    const period = periods.find((candidate) =>
      group.every((row, index) => {
        if (!index) {
          return true;
        }
        const previous = group[index - 1];
        return (
          !!previous &&
          row.date > previous.date &&
          Math.abs(
            Date.parse(row.date) -
              Date.parse(nextDate(previous.date, candidate)),
          ) <=
            candidate.tolerance * dayMilliseconds
        );
      }),
    );
    if (!period) {
      continue;
    }
    candidates.push({
      accountId: last.accountId,
      amountMinor: chargeAmount(last).toString(),
      cadence: period.cadence,
      cardNumber:
        last.identification?.creditCardMetadata?.cardNumber ??
        last.details?.cardNumber ??
        null,
      currency: last.currency,
      evidence: group.slice(-3).map((row) => ({
        amountMinor: chargeAmount(row).toString(),
        date: row.date,
        transactionId: row.id,
      })),
      firstSeen: first.date,
      lastSeen: last.date,
      maxAmountMinor: maximum.toString(),
      minAmountMinor: minimum.toString(),
      name: chargeIdentity(last).name,
      nextExpectedDate: nextDate(last.date, period),
      observedTotalMinor: amounts.reduce((a, b) => a + b, 0n).toString(),
      occurrences: group.length,
    });
  }
  return candidates.sort(
    (a, b) =>
      b.lastSeen.localeCompare(a.lastSeen) ||
      a.accountId.localeCompare(b.accountId) ||
      a.name.localeCompare(b.name) ||
      a.currency.localeCompare(b.currency) ||
      (a.cardNumber ?? "").localeCompare(b.cardNumber ?? ""),
  );
}
