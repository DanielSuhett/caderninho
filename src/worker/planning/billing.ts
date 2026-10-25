import type { AccountSettings, Recurrence } from "../../domain";
import { monthDate, PlanningError } from "../../domain";

export interface ProjectedPayment {
  accountId: string | null;
  amountMinor: string | null;
  currency: string;
  date: string;
  direction: string;
  id: string;
  kind: string;
}
export function billingDate(date: string, settings: AccountSettings) {
  if (!(settings.closeDay && settings.dueDay)) {
    throw new Error(PlanningError.BILLING_CYCLE_REQUIRED);
  }
  const close = `${date.slice(0, 7)}-${String(settings.closeDay).padStart(2, "0")}`;
  const shift =
    Number(date > monthDate(close, 0)) +
    Number(settings.dueDay <= settings.closeDay);
  return monthDate(
    `${date.slice(0, 7)}-${String(settings.dueDay).padStart(2, "0")}`,
    shift,
  );
}
export function recurrencePayments(
  recurrence: Recurrence,
  from: string,
  to: string,
): ProjectedPayment[] {
  const [fy = 0, fm = 1] = from.split("-").map(Number);
  const [sy = 0, sm = 1] = recurrence.startDate.split("-").map(Number);
  const start = Math.max(0, (fy - sy) * 12 + fm - sm - 1);
  const result: ProjectedPayment[] = [];
  for (let offset = start; offset < start + 1200; offset += 1) {
    const date = monthDate(recurrence.startDate, offset);
    if (date > to || (recurrence.endDate && date > recurrence.endDate)) {
      return result;
    }
    if (date >= from) {
      result.push({
        accountId: recurrence.accountId,
        amountMinor: recurrence.amountMinor,
        currency: recurrence.currency,
        date,
        direction: recurrence.direction,
        id: `${recurrence.id}:${date}`,
        kind: recurrence.installmentId ? "installment" : "recurrence",
      });
    }
  }
  throw new Error(PlanningError.PROJECTION_TOO_LARGE);
}
