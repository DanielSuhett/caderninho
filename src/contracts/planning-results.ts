import { z } from "zod/v4";

import {
  ChartType,
  SpendingGroupBy,
  SubscriptionCadence,
  type SubscriptionCandidate,
  TransactionDirection,
  TransactionStatus,
} from "../domain";
import { CardCommitmentsResponseSchema } from "./card-commitments";
import { FinancialOverviewSchema, FinancialSummarySchema } from "./dashboard";
import { InvestmentListSchema } from "./investments";

const minor = z.string().regex(/^-?\d+$/);
const selection = z.looseObject({
  accountId: z.string().optional(),
  cardNumber: z.string().optional(),
  categoryId: z.string().optional(),
  currency: z.string().optional(),
  direction: z
    .enum([TransactionDirection.DEBIT, TransactionDirection.CREDIT])
    .optional(),
  from: z.iso.date(),
  include_ignored: z.boolean(),
  personId: z.string().optional(),
  spaceId: z.string(),
  status: z
    .enum([TransactionStatus.PENDING, TransactionStatus.POSTED])
    .optional(),
  tagId: z.string().optional(),
  text: z.string().optional(),
  to: z.iso.date(),
});
const summary = FinancialSummarySchema.extend({
  dateBasis: z.literal("transaction"),
  eligibility: z.object({
    status: z.literal(TransactionStatus.POSTED),
    throughDay: z.iso.date(),
  }),
  groups: z.array(
    FinancialSummarySchema.shape.groups.element.extend({
      categoryId: z.string().optional(),
      categoryName: z.string().optional(),
      formattedAmount: z.string(),
      label: z.string(),
      scale: z.number().int().nonnegative().nullable(),
    }),
  ),
  measure: z.literal("classified_expense"),
  selection,
  totals: z.array(
    FinancialSummarySchema.shape.totals.element.extend({
      knownUnclassifiedMinor: minor,
      unclassifiedMinor: minor.nullable(),
      unclassifiedUnknownAmountCount: z.number().int().nonnegative(),
    }),
  ),
  unit: z.literal("minor"),
}).loose();
function envelope<T extends z.ZodType>(data: T) {
  return z.looseObject({
    coverage: z.object({
      connectionIds: z.array(z.string()),
      kind: z.enum(["imported", "local_only", "empty"]),
      oldestLastSuccessAt: z.string().nullable(),
      partial: z.boolean(),
    }),
    data,
    oldestLastSuccessAt: z.string().nullable(),
    partial: z.boolean(),
    revision: z.number().int().nonnegative(),
    scope: z.object({ personId: z.string().optional(), spaceId: z.string() }),
    view: z.literal("effective"),
  });
}

export const SubscriptionsResultSchema = envelope(
  z.object({
    estimated: z.literal(true),
    matchedCount: z.number().int().nonnegative(),
    records: z.array(
      z.object({
        accountId: z.string(),
        amountMinor: minor,
        cadence: z.enum(SubscriptionCadence),
        cardNumber: z.string().nullable(),
        currency: z.string(),
        evidence: z.array(
          z.object({
            amountMinor: minor,
            date: z.iso.date(),
            transactionId: z.string(),
          }),
        ),
        firstSeen: z.iso.date(),
        lastSeen: z.iso.date(),
        maxAmountMinor: minor,
        minAmountMinor: minor,
        name: z.string(),
        nextExpectedDate: z.iso.date(),
        observedTotalMinor: minor,
        occurrences: z.number().int().min(2),
      }) satisfies z.ZodType<SubscriptionCandidate>,
    ),
    referenceDay: z.iso.date(),
    scanLimit: z.number().int().positive(),
    scannedCount: z.number().int().nonnegative(),
    selection,
    truncated: z.boolean(),
  }),
);

export const planningOutputSchemas = new Map<string, z.ZodType>([
  ["get_investments", envelope(InvestmentListSchema.shape.data)],
  ["get_subscriptions", SubscriptionsResultSchema],
  ["get_card_commitments", CardCommitmentsResponseSchema],
  [
    "get_overview",
    envelope(
      summary.extend({
        accounts: FinancialOverviewSchema.shape.accounts,
        investments: z.array(z.record(z.string(), z.unknown())),
        loans: z.array(z.record(z.string(), z.unknown())),
      }),
    ),
  ],
  ["get_spending_by_category", envelope(summary)],
  ["analyze_categories", envelope(summary)],
  [
    "get_spending_comparison",
    envelope(
      z.object({
        comparison: z.enum(["previous_period", "previous_month", "explicit"]),
        current: summary,
        previous: summary,
      }),
    ),
  ],
  [
    "get_spending_pace",
    envelope(
      summary.extend({
        elapsedDays: z.number().nonnegative(),
        estimated: z.literal(true),
        periodDays: z.number().positive(),
        projection: z.array(
          z.object({ amountMinor: minor.nullable(), currency: z.string() }),
        ),
      }),
    ),
  ],
  [
    "generate_chart",
    envelope(
      summary.extend({
        charts: z.array(
          z.object({
            currency: z.string(),
            mimeType: z.literal("image/svg+xml"),
            svg: z.string(),
          }),
        ),
        groupBy: z.enum([SpendingGroupBy.category, SpendingGroupBy.month]),
        type: z.enum([ChartType.bar, ChartType.line, ChartType.doughnut]),
      }),
    ),
  ],
]);
