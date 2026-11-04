import { localDay } from "./exact";
import {
  TransactionDirection,
  type TransactionProjection,
} from "./finance.entity";
import { documentDigits, transactionCounterparty } from "./transaction.entity";

export const TripVerdict = {
  review: "review",
  routine: "routine",
  trip: "trip",
} as const;
export type TripVerdict = (typeof TripVerdict)[keyof typeof TripVerdict];

export const TripReason = {
  automaticDebit: "automatic_debit",
  billPayment: "bill_payment",
  digitalMerchant: "digital_merchant",
  earlierInstallment: "earlier_installment",
  knownCounterparty: "known_counterparty",
  newCounterparty: "new_counterparty",
  ownTransfer: "own_transfer",
  paymentGateway: "payment_gateway",
  purchasedOutsidePeriod: "purchased_outside_period",
  recurringCharge: "recurring_charge",
  travelMerchant: "travel_merchant",
  unidentifiedCounterparty: "unidentified_counterparty",
} as const;
export type TripReason = (typeof TripReason)[keyof typeof TripReason];

export interface TripCandidate {
  accountId: string;
  amountMinor: string | null;
  counterparty: string | null;
  currency: string;
  date: string;
  description: string;
  id: string;
  mcc: string | null;
  purchaseDay: string;
  reasons: TripReason[];
  verdict: TripVerdict;
}

// Merchant category codes are grouped by ISO 18245 ranges, so a code missing
// from a hand-picked list still lands in its group. Unknown or absent codes
// never decide a verdict: digital ranges mark routine, travel ranges only
// reinforce a trip already decided by a new counterparty.
const MerchantCodeGroup = {
  digital: "digital",
  travel: "travel",
} as const;
type MerchantCodeGroup =
  (typeof MerchantCodeGroup)[keyof typeof MerchantCodeGroup];
const merchantCodeRanges: Record<
  MerchantCodeGroup,
  readonly (readonly [number, number])[]
> = {
  // Network services, cable/streaming, software, digital goods, direct
  // marketing and continuity billing are paid from anywhere.
  digital: [
    [4816, 4816],
    [4899, 4899],
    [5734, 5735],
    [5815, 5818],
    [5960, 5969],
    [7372, 7372],
  ],
  // Airlines, car rental, lodging, passenger transport, travel agencies,
  // food stores, fuel, eating places, pharmacies, souvenirs, camps and
  // recreation.
  travel: [
    [3000, 3999],
    [4011, 4131],
    [4411, 4411],
    [4722, 4722],
    [5411, 5499],
    [5541, 5542],
    [5811, 5814],
    [5912, 5912],
    [5947, 5947],
    [7011, 7033],
    [7512, 7519],
    [7991, 7999],
  ],
};
const merchantCodeDigits = /^\d+$/;
function merchantCodeGroup(row: TransactionProjection) {
  const value = row.identification?.creditCardMetadata?.payeeMCC?.trim();
  if (!(value && merchantCodeDigits.test(value))) {
    return null;
  }
  const code = Number(value);
  const group = Object.values(MerchantCodeGroup).find((name) =>
    merchantCodeRanges[name].some(([low, high]) => code >= low && code <= high),
  );
  return group ?? null;
}
const billOperations: ReadonlySet<string> = new Set([
  "BOLETO",
  "CONVENIO_ARRECADACAO",
  "PAGAMENTO_FATURA",
]);
const automaticDebit = /d[eé]bito autom[aá]tico/i;
// Gateways that sell both through card readers and online checkouts.
const paymentGateway = /^(MP|PAYPAL)\s*\*/i;
// Descriptions that name only the payment rail, never who was paid.
const railNames: ReadonlySet<string> = new Set([
  "",
  "DOC",
  "PIX",
  "TED",
  "TRANSFERENCIA",
]);

function normalizedName(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toUpperCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}
// Itaú prefixes card and Pix descriptions with the operation, as in
// "Compra no débito|LOJA"; the counterparty is the last segment.
function describedCounterparty(description: string) {
  return description.split("|").at(-1) ?? description;
}
function counterpartyKey(row: TransactionProjection) {
  const counterparty = transactionCounterparty(row.identification);
  if (counterparty.document) {
    return `document:${counterparty.document}`;
  }
  const name = normalizedName(
    counterparty.name ?? describedCounterparty(row.description),
  );
  if (railNames.has(name)) {
    return null;
  }
  return `name:${name}`;
}
function purchaseDay(row: TransactionProjection) {
  const card = row.identification?.creditCardMetadata;
  if (card?.transactionDateTime) {
    return localDay(new Date(card.transactionDateTime));
  }
  return card?.purchaseDate?.slice(0, 10) ?? row.date;
}
function isOwnTransfer(row: TransactionProjection) {
  const payment = row.identification?.paymentData;
  const payer = payment?.payer?.documentNumber?.value;
  const receiver = payment?.receiver?.documentNumber?.value;
  if (!(payer && receiver)) {
    return false;
  }
  const digits = documentDigits(payer);
  return !!digits && digits === documentDigits(receiver);
}

interface TripContext {
  from: string;
  knownCounterparties: ReadonlySet<string>;
  recurringIds: ReadonlySet<string>;
  to: string;
}
// Routine checks run in priority order and the first match decides.
const routineChecks: readonly {
  matches: (
    row: TransactionProjection,
    day: string,
    ctx: TripContext,
  ) => boolean;
  reason: TripReason;
}[] = [
  { matches: isOwnTransfer, reason: TripReason.ownTransfer },
  {
    matches: (row) =>
      automaticDebit.test(
        row.identification?.operationTypeAdditionalInfo ?? row.description,
      ),
    reason: TripReason.automaticDebit,
  },
  {
    matches: (row) => {
      const operation =
        row.identification?.operationType ?? row.details?.operationType;
      return (
        (!!operation && billOperations.has(operation)) ||
        !!row.identification?.paymentData?.boletoMetadata
      );
    },
    reason: TripReason.billPayment,
  },
  {
    matches: (row, _day, ctx) => ctx.recurringIds.has(row.id),
    reason: TripReason.recurringCharge,
  },
  {
    matches: (row) =>
      (row.identification?.creditCardMetadata?.installmentNumber ??
        row.details?.installmentNumber ??
        0) > 1,
    reason: TripReason.earlierInstallment,
  },
  {
    matches: (_row, day, ctx) => day < ctx.from || day > ctx.to,
    reason: TripReason.purchasedOutsidePeriod,
  },
  {
    matches: (row) => merchantCodeGroup(row) === MerchantCodeGroup.digital,
    reason: TripReason.digitalMerchant,
  },
];

function classify(
  row: TransactionProjection,
  ctx: TripContext,
): Pick<TripCandidate, "reasons" | "verdict"> {
  const day = purchaseDay(row);
  const routine = routineChecks.find((check) => check.matches(row, day, ctx));
  if (routine) {
    return { reasons: [routine.reason], verdict: TripVerdict.routine };
  }
  const key = counterpartyKey(row);
  const review: TripReason[] = [];
  if (!key) {
    review.push(TripReason.unidentifiedCounterparty);
  }
  if (paymentGateway.test(describedCounterparty(row.description))) {
    review.push(TripReason.paymentGateway);
  }
  if (key && ctx.knownCounterparties.has(key)) {
    review.push(TripReason.knownCounterparty);
  }
  if (review.length) {
    return { reasons: review, verdict: TripVerdict.review };
  }
  const reasons: TripReason[] = [TripReason.newCounterparty];
  if (merchantCodeGroup(row) === MerchantCodeGroup.travel) {
    reasons.push(TripReason.travelMerchant);
  }
  return { reasons, verdict: TripVerdict.trip };
}

// Splits the outflows of a trip period into trip, routine and review, each
// with the reasons behind it. A purchase is trip only when nothing marks it as
// routine and its counterparty is new against the baseline history; anything
// the signals cannot settle goes to the owner.
export function classifyTrip(input: {
  from: string;
  history: Iterable<TransactionProjection>;
  recurringIds: ReadonlySet<string>;
  to: string;
  transactions: Iterable<TransactionProjection>;
}): TripCandidate[] {
  const knownCounterparties = new Set<string>();
  for (const row of input.history) {
    const key =
      row.direction === TransactionDirection.DEBIT && counterpartyKey(row);
    if (key) {
      knownCounterparties.add(key);
    }
  }
  const ctx = {
    from: input.from,
    knownCounterparties,
    recurringIds: input.recurringIds,
    to: input.to,
  };
  const candidates: TripCandidate[] = [];
  for (const row of input.transactions) {
    if (row.direction !== TransactionDirection.DEBIT) {
      continue;
    }
    const day = purchaseDay(row);
    // Card purchases may post after the trip; keep only what happened in it
    // or what was posted in it.
    const posted = row.date >= input.from && row.date <= input.to;
    const purchased = day >= input.from && day <= input.to;
    if (!(posted || purchased)) {
      continue;
    }
    const counterparty = transactionCounterparty(row.identification);
    candidates.push({
      accountId: row.accountId,
      amountMinor: row.amountMinor,
      counterparty:
        counterparty.name ?? describedCounterparty(row.description).trim(),
      currency: row.currency,
      date: row.date,
      description: row.description,
      id: row.id,
      mcc: row.identification?.creditCardMetadata?.payeeMCC ?? null,
      purchaseDay: day,
      ...classify(row, ctx),
    });
  }
  return candidates.sort(
    (a, b) =>
      a.purchaseDay.localeCompare(b.purchaseDay) || a.id.localeCompare(b.id),
  );
}
