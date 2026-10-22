import type { AccountMetadata, TransactionProjection } from "./finance.entity";

export interface Space {
  budgetEnabled: boolean;
  color: string;
  currency: string;
  icon: string;
  id: string;
  monthlyBudgetMinor: string | null;
  monthStartDay: number;
  name: string;
  type: "personal" | "business" | "family";
}
export interface AccountSettings {
  closeDay?: number;
  creditLimitMinor?: string;
  currency?: string;
  dueDay?: number;
  hidden: boolean;
  id: string;
  manual: boolean;
  name?: string;
  openingBalanceMinor?: string;
  personId?: string;
  primaryCard?: string;
  spaceId: string;
  type?: "BANK" | "CREDIT";
}
export interface CardSettings {
  accountId: string;
  deleted: boolean;
  hidden: boolean;
  id: string;
  name: string;
  number: string;
}
export interface TransactionEdit {
  accountId?: string;
  amountMinor?: string;
  category?: string | null;
  currency?: string;
  date?: string;
  deleted?: boolean;
  description?: string;
  direction?: "DEBIT" | "CREDIT";
  goalId?: string | null;
  id: string;
  ignored?: boolean;
  manual: boolean;
  recurrenceId?: string;
  spaceId?: string;
  status?: "PENDING" | "POSTED";
  tagIds?: string[];
}
export interface Category {
  hidden: boolean;
  id: string;
  kind: "income" | "expense" | "transfer";
  limitMinor: string | null;
  name: string;
  spaceId: string;
  system: boolean;
}
export interface Tag {
  color: string;
  id: string;
  name: string;
  spaceId: string;
}
export interface Rule {
  accountId: string | null;
  categoryId: string;
  direction: "DEBIT" | "CREDIT" | null;
  enabled: boolean;
  id: string;
  name: string;
  priority: number;
  spaceId: string;
  text: string;
}
export interface Recurrence {
  accountId: string;
  active: boolean;
  amountMinor: string;
  categoryId: string | null;
  currency: string;
  direction: "DEBIT" | "CREDIT";
  endDate: string | null;
  id: string;
  installmentId: string | null;
  name: string;
  spaceId: string;
  startDate: string;
}
export interface Installment {
  accountId: string;
  amountMinor: string;
  categoryId: string | null;
  completed: boolean;
  currency: string;
  current: number;
  id: string;
  manual: boolean;
  name: string;
  spaceId: string;
  startDate: string;
  total: number;
  transactionIds: string[];
}
export interface Goal {
  accountId: string | null;
  completed: boolean;
  currency: string;
  id: string;
  investmentId: string | null;
  name: string;
  personId?: string;
  spaceId: string;
  targetDate: string | null;
  targetMinor: string;
}
export interface Contribution {
  amountMinor: string;
  date: string;
  goalId: string;
  id: string;
  transactionId: string | null;
}
export interface Investment {
  amountMinor: string | null;
  connectionId: string | null;
  currency: string;
  date: string | null;
  id: string;
  included: boolean;
  manual: boolean;
  name: string;
  personId?: string;
  spaceId: string;
  type: string;
}
export interface Loan {
  amountMinor: string | null;
  connectionId: string | null;
  contractAmountMinor?: string | null;
  currency: string;
  firstPaymentDate: string | null;
  hidden: boolean;
  id: string;
  installmentMinor: string | null;
  manual: boolean;
  name: string;
  observedAt?: string;
  paid: number | null;
  personId?: string;
  spaceId: string;
  total: number | null;
}
export interface ScheduledPayment {
  amountMinor: string;
  createdTransaction: boolean;
  date: string;
  id: string;
  interestMinor: string;
  loanId: string;
  number: number;
  principalMinor: string;
  transactionId: string | null;
}
export interface Bill {
  accountId: string;
  amountMinor: string | null;
  charges: { type: string; amountMinor: string | null; currency: string }[];
  currency: string;
  dueDate: string;
  id: string;
  minimumMinor: string | null;
  observedAt: string;
  payments: { date: string; amountMinor: string | null; currency: string }[];
}
export interface BillPayment {
  id: string;
  paid: boolean;
  updatedAt: string;
}
export interface NotificationPreference {
  channel: "email" | "push";
  enabled: boolean;
  event: string;
  id: string;
  spaceId: string;
}
export interface AccountDetails {
  availableCreditMinor: string | null;
  cardNumber: string | null;
  closeDate: string | null;
  creditLimitMinor: string | null;
  dueDate: string | null;
  id: string;
}
export interface TransactionDetails {
  accountId: string;
  billId: string | null;
  cardNumber: string | null;
  id: string;
  installmentNumber: number | null;
  operationType: string | null;
  purchaseDate: string | null;
  totalInstallments: number | null;
}
export interface PlanningState {
  accounts: AccountSettings[];
  billPayments: BillPayment[];
  cards: CardSettings[];
  categories: Category[];
  contributions: Contribution[];
  edits: TransactionEdit[];
  goals: Goal[];
  installments: Installment[];
  investments: Investment[];
  loans: Loan[];
  notifications: NotificationPreference[];
  recurrences: Recurrence[];
  rules: Rule[];
  schedules: ScheduledPayment[];
  spaces: Space[];
  tags: Tag[];
}
export interface PlanningAccount extends AccountMetadata {
  connectionId: string | null;
  hidden: boolean;
  id: string;
  manual: boolean;
  personId: string;
  personName: string;
  profileId: string | null;
  spaceId: string;
}
export interface PlanningTransaction extends TransactionProjection {
  goalId: string | null;
  ignored: boolean;
  manual: boolean;
  personId: string;
  personName: string;
  profileId: string | null;
  recurrenceId?: string;
  spaceId: string;
  tagIds: string[];
}
export function monthDate(start: string, offset: number) {
  const [year = 0, month = 1, day = 1] = start.split("-").map(Number);
  const base = new Date(Date.UTC(year, month - 1 + offset, 1));
  const last = new Date(
    Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0),
  ).getUTCDate();
  base.setUTCDate(Math.min(day, last));
  return base.toISOString().slice(0, 10);
}
export function sacSchedule(input: {
  loanId: string;
  principalMinor: string;
  monthlyRateBps: number;
  count: number;
  startDate: string;
}): ScheduledPayment[] {
  const principal = BigInt(input.principalMinor);
  const count = BigInt(input.count);
  let remaining = principal;
  return Array.from({ length: input.count }, (_, index) => {
    const amortization =
      principal / count + (BigInt(index) < principal % count ? 1n : 0n);
    const interest =
      (remaining * BigInt(input.monthlyRateBps) + 5000n) / 10000n;
    remaining -= amortization;
    return {
      amountMinor: (amortization + interest).toString(),
      createdTransaction: false,
      date: monthDate(input.startDate, index),
      id: `${input.loanId}:${index + 1}`,
      interestMinor: interest.toString(),
      loanId: input.loanId,
      number: index + 1,
      principalMinor: amortization.toString(),
      transactionId: null,
    };
  });
}

export type ProductKind = "investments" | "loans" | "bills";
export type ProductPage =
  | { kind: "investments"; next: number | null; records: Investment[] }
  | { kind: "loans"; next: number | null; records: Loan[] }
  | { kind: "bills"; next: number | null; records: Bill[] };
