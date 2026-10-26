import type { CategoryIcon } from "./category.entity";
import type {
  AccountMetadata,
  AccountType,
  TransactionDirection,
  TransactionProjection,
  TransactionStatus,
} from "./finance.entity";
import type { FinancialIdentity } from "./financial-identity.entity";
import type { InvestmentDetails } from "./investment.entity";
import type { RuleFilter } from "./rules.entity";

export const SpaceType = {
  business: "business",
  family: "family",
  personal: "personal",
} as const;
export type SpaceType = (typeof SpaceType)[keyof typeof SpaceType];

export const CategoryKind = {
  expense: "expense",
  income: "income",
  transfer: "transfer",
} as const;
export type CategoryKind = (typeof CategoryKind)[keyof typeof CategoryKind];

export const NotificationChannel = { email: "email", push: "push" } as const;
export type NotificationChannel =
  (typeof NotificationChannel)[keyof typeof NotificationChannel];

export interface Space {
  budgetEnabled: boolean;
  color: string;
  currency: string;
  icon: string;
  id: string;
  monthlyBudgetMinor: string | null;
  monthStartDay: number;
  name: string;
  type: SpaceType;
}
export interface AccountSettings {
  closeDay?: number;
  creditLimitMinor?: string | null;
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
  type?: AccountType;
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
  direction?: TransactionDirection;
  goalId?: string | null;
  id: string;
  ignored?: boolean;
  manual: boolean;
  recurrenceId?: string;
  spaceId?: string;
  status?: TransactionStatus;
  tagIds?: string[];
}
export interface Category {
  color?: string;
  groupId?: string | null;
  hidden: boolean;
  icon?: CategoryIcon;
  id: string;
  kind: CategoryKind;
  limitMinor: string | null;
  name: string;
  spaceId: string;
  system: boolean;
}
export interface CategoryGroup {
  color: string;
  icon: CategoryIcon;
  id: string;
  name: string;
  spaceId: string;
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
  direction: TransactionDirection | null;
  enabled: boolean;
  filter?: RuleFilter | null;
  id: string;
  name: string;
  pack?: { id: string; key: string; version: number };
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
  direction: TransactionDirection;
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
  details?: InvestmentDetails | null | undefined;
  id: string;
  identity?: FinancialIdentity | null | undefined;
  included: boolean;
  manual: boolean;
  name: string;
  personId?: string | undefined;
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
  channel: NotificationChannel;
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
  categoryGroups: CategoryGroup[];
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

export const ProductKind = {
  bills: "bills",
  investments: "investments",
  loans: "loans",
} as const;
export type ProductKind = (typeof ProductKind)[keyof typeof ProductKind];
export type ProductPage =
  | {
      kind: typeof ProductKind.investments;
      next: number | null;
      records: Investment[];
    }
  | { kind: typeof ProductKind.loans; next: number | null; records: Loan[] }
  | { kind: typeof ProductKind.bills; next: number | null; records: Bill[] };
