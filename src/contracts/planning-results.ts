import { z } from "zod/v4";

import { FinancialOverviewSchema, FinancialSummarySchema } from "./dashboard";

const minor = z.string().regex(/^-?\d+$/);
const selection = z.looseObject({
  accountId: z.string().optional(),
  cardNumber: z.string().optional(),
  categoryId: z.string().optional(),
  currency: z.string().optional(),
  direction: z.enum(["DEBIT", "CREDIT"]).optional(),
  from: z.iso.date(),
  include_ignored: z.boolean(),
  personId: z.string().optional(),
  spaceId: z.string(),
  status: z.enum(["PENDING", "POSTED"]).optional(),
  tagId: z.string().optional(),
  text: z.string().optional(),
  to: z.iso.date(),
});
const summary = FinancialSummarySchema.extend({
  dateBasis: z.literal("transaction"),
  eligibility: z.object({
    status: z.literal("POSTED"),
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

export const planningOutputSchemas = new Map<string, z.ZodType>([
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
        groupBy: z.enum(["category", "month"]),
        type: z.enum(["bar", "line", "doughnut"]),
      }),
    ),
  ],
]);
