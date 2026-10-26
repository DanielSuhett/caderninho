import {
  AccountType,
  type Bill,
  monthDate,
  type PlanningState,
  type PlanningTransaction,
  type TransactionDetails,
  TransactionDirection,
} from "../../domain";
import { billingDate, recurrencePayments } from "./billing";
import type { PlanningRepository, PlanningSnapshot } from "./entity";
import { accounts, transactionStream } from "./projection";

export function billPaymentEvidence(bill: Bill, snapshot: PlanningSnapshot) {
  const manuallyPaid =
    snapshot.state.billPayments.find((payment) => payment.id === bill.id)
      ?.paid ?? false;
  const [subsequent] = snapshot.bills
    .filter(
      (next) =>
        next.accountId === bill.accountId &&
        next.currency === bill.currency &&
        next.dueDate > bill.dueDate,
    )
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  return {
    bankPaid: !!subsequent && settledByNextBill(bill, subsequent),
    manuallyPaid,
  };
}

export function transactionBillPayments(snapshot: PlanningSnapshot) {
  const bills = new Map(snapshot.bills.map((bill) => [bill.id, bill]));
  const payments = new Map<string, "bank" | "manual" | null>();
  return (
    row: PlanningTransaction,
    details: TransactionDetails | undefined,
  ) => {
    const bill = details?.billId ? bills.get(details.billId) : undefined;
    if (
      !bill ||
      bill.accountId !== row.accountId ||
      bill.currency !== row.currency
    ) {
      return null;
    }
    if (!payments.has(bill.id)) {
      const evidence = billPaymentEvidence(bill, snapshot);
      let payment: "bank" | "manual" | null = null;
      if (evidence.manuallyPaid) {
        payment = "manual";
      }
      if (evidence.bankPaid) {
        payment = "bank";
      }
      payments.set(bill.id, payment);
    }
    return payments.get(bill.id) ?? null;
  };
}

export async function effectiveBills(context: {
  snapshot: PlanningSnapshot;
  state: PlanningState;
  repository: PlanningRepository;
  referenceDay: string;
  through?: string;
}) {
  const { snapshot, state, repository, referenceDay } = context;
  const through = context.through ?? monthDate(referenceDay, 12);
  const catalog = accounts(snapshot, state);
  const settings = new Map(
    state.accounts
      .filter(
        (a) =>
          a.manual && a.type === AccountType.CREDIT && a.closeDay && a.dueDay,
      )
      .map((a) => [a.id, a]),
  );
  const derived = new Map<string, Bill>();
  const matched = new Set<string>();
  function add(input: {
    accountId: string;
    date: string;
    currency: string;
    amountMinor: string | null;
    direction: string;
  }) {
    const { accountId, date, currency, amountMinor, direction } = input;
    const setting = settings.get(accountId);
    if (!setting) {
      return;
    }
    const dueDate = billingDate(date, setting);
    if (dueDate > through) {
      return;
    }
    const id = `manual-bill:${accountId}:${dueDate}`;
    const bill = derived.get(id) ?? {
      accountId,
      amountMinor: "0",
      charges: [],
      currency,
      dueDate,
      id,
      minimumMinor: null,
      observedAt: referenceDay,
      payments: [],
    };
    if (amountMinor === null || bill.amountMinor === null) {
      bill.amountMinor = null;
    } else {
      const amount = BigInt(amountMinor.replace("-", ""));
      bill.amountMinor = (
        BigInt(bill.amountMinor) +
        (direction === TransactionDirection.DEBIT ? amount : -amount)
      ).toString();
    }
    derived.set(id, bill);
  }
  const stream = transactionStream(repository, snapshot, state);
  async function collect(spaceId: string) {
    for await (const row of stream({ include_ignored: true, spaceId })) {
      if (!(row.manual && settings.has(row.accountId))) {
        continue;
      }
      add(row);
      if (row.recurrenceId) {
        matched.add(`${row.recurrenceId}:${row.date.slice(0, 7)}`);
      }
    }
  }
  // One owner's spaces are independent selections of the same small planning catalog.
  if (settings.size) {
    await Promise.all(state.spaces.map((space) => collect(space.id)));
  }
  for (const recurrence of state.recurrences.filter(
    (r) => r.active && settings.has(r.accountId),
  )) {
    for (const event of recurrencePayments(
      recurrence,
      recurrence.startDate,
      through,
    )) {
      if (!matched.has(`${recurrence.id}:${event.date.slice(0, 7)}`)) {
        add({ ...event, accountId: recurrence.accountId });
      }
    }
  }
  const combined = [...snapshot.bills, ...derived.values()];
  return combined.map((bill) => {
    const { manuallyPaid, bankPaid } = billPaymentEvidence(bill, {
      ...snapshot,
      state,
    });
    return {
      ...bill,
      bankConfirmationPending: manuallyPaid && !bankPaid,
      bankPaid,
      estimated: derived.has(bill.id),
      manuallyPaid,
      paid: manuallyPaid || bankPaid,
      spaceId:
        catalog.find((a) => a.id === bill.accountId)?.spaceId ?? "personal",
    };
  });
}
function settledByNextBill(bill: Bill, next: Bill) {
  if (bill.amountMinor === null || !next.payments.length) {
    return false;
  }
  if (
    [...next.payments, ...next.charges].some(
      (p) => p.currency !== bill.currency || p.amountMinor === null,
    )
  ) {
    return false;
  }
  const charges = next.charges.reduce(
    (sum, c) => sum + BigInt(c.amountMinor ?? "0"),
    0n,
  );
  const payments = next.payments.reduce(
    (sum, p) => sum + BigInt(p.amountMinor ?? "0"),
    0n,
  );
  return BigInt(bill.amountMinor) + charges === payments;
}
