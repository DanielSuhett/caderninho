import { z } from "zod/v4";

const minor = z.string().regex(/^-?\d+$/);
const nullableMinor = minor.nullable();

export const FinancialSummarySchema = z.object({
  classification: z.string(),
  from: z.iso.date(),
  groups: z.array(
    z.object({ amountMinor: minor, currency: z.string(), group: z.string() }),
  ),
  partial: z.boolean(),
  referenceDay: z.iso.date(),
  to: z.iso.date(),
  totals: z.array(
    z.object({
      cashFlowMinor: nullableMinor,
      count: z.number().int().nonnegative(),
      currency: z.string(),
      expenseMinor: nullableMinor,
      incomeMinor: nullableMinor,
      knownCashFlowMinor: minor,
      knownExpenseMinor: minor,
      knownIncomeMinor: minor,
      unclassifiedCount: z.number().int().nonnegative(),
      unknownAmountCount: z.number().int().nonnegative(),
    }),
  ),
});
export const FinancialOverviewSchema = FinancialSummarySchema.extend({
  accounts: z.array(
    z.object({
      balanceMinor: nullableMinor,
      balanceObservedAt: z.string().nullable().optional(),
      currency: z.string(),
      hidden: z.boolean(),
      id: z.string(),
      manual: z.boolean(),
      name: z.string(),
      personId: z.string(),
      type: z.enum(["BANK", "CREDIT"]),
    }),
  ),
});
export const MonthlySpendingSchema = FinancialSummarySchema.extend({
  groupBy: z.literal("month"),
});
export type FinancialSummary = z.infer<typeof FinancialSummarySchema>;
export type FinancialOverview = z.infer<typeof FinancialOverviewSchema>;

export const FinancialOverviewResponseSchema = z.object({
  data: FinancialOverviewSchema,
});
export const MonthlySpendingResponseSchema = z.object({
  data: MonthlySpendingSchema,
});
