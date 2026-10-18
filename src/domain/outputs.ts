import { z } from "zod/v4";

import {
  Periodicity,
  PeriodicitySchema,
  RecurrenceClassificationSchema,
  RecurrenceStrengthSchema,
} from "#domain/enums.ts";

const moneyString = z.string().regex(/^\d+$/);

const monthlyMoney = z.record(z.string().regex(/^\d{4}-\d{2}$/), moneyString);

const classificationMoney = z.object({
  possible_subscription: moneyString,
  recurring_expense: moneyString,
  recurring_payment: moneyString,
});

const classificationMonthlyMoney = z.object({
  possible_subscription: monthlyMoney,
  recurring_expense: monthlyMoney,
  recurring_payment: monthlyMoney,
});

export const RecurrenceResultSchema = z.looseObject({
  recordCount: z.number(),
  candidates: z
    .array(
      z
        .object({
          anchorRecordId: z.string(),
          accountId: z.string(),
          payee: z.object({
            name: z.string(),
            normalizedName: z.string(),
            source: z.string(),
          }),
          observedPattern: PeriodicitySchema,
          reasons: z.array(z.string()),
          warnings: z.array(z.string()),
          categories: z.array(z.string()),
          categoriesTruncated: z.boolean(),
          firstChargeDate: z.string(),
          lastChargeDate: z.string(),
          cadence: z.object({
            missingCycles: z.number(),
            intervalDays: z.array(z.number()),
            intervalsTruncated: z.boolean(),
          }),
          currency: z.string(),
          classification: RecurrenceClassificationSchema,
          confirmed: z.literal(false),
          periodicity: PeriodicitySchema,
          recurrenceEvidenceStrength: RecurrenceStrengthSchema,
          occurrenceCount: z.number().int().min(2),
          amounts: z.object({
            unit: z.literal("currency_minor"),
            observedTotalMinor: moneyString,
            lastChargeMinor: moneyString,
            minimumMinor: moneyString,
            maximumMinor: moneyString,
            averageMinor: z.object({
              numerator: moneyString,
              denominator: z.string().regex(/^[1-9]\d*$/),
            }),
            pattern: z.enum(["constant", "variable"]),
            byMonth: monthlyMoney,
          }),
          evidence: z.object({
            recordIds: z.array(z.string()).max(12),
            referencesTruncated: z.boolean(),
            charges: z
              .array(
                z
                  .object({
                    id: z.string(),
                    date: z.string(),
                    amountMinor: moneyString,
                  })
                  .passthrough(),
              )
              .max(12),
          }),
        })
        .passthrough(),
    )
    .max(100),
  candidateCount: z.number().int().nonnegative(),
  analysis: z.object({
    algorithm: z.literal("recurrence_candidates_v1"),
    asOfDay: z.string(),
    historyDays: z.number().int().positive(),
    historyAssessment: z.enum(["short_window", "multi_month_window"]),
    outcome: z.enum([
      "candidates_found",
      Periodicity.insufficient_history,
      "no_candidates_in_snapshot",
      "unavailable",
    ]),
    scannedAllFilteredRecords: z.literal(true),
    groupCount: z.number().int().nonnegative(),
  }),
  totals: z.object({
    unit: z.literal("currency_minor"),
    kind: z.literal(
      "observed_candidate_debits_not_confirmed_subscription_spending",
    ),
    allCandidatesMinor: moneyString.nullable(),
    byClassification: classificationMoney.nullable(),
    byMonth: monthlyMoney.nullable(),
    byClassificationMonth: classificationMonthlyMoney.nullable(),
    scope: z.literal("all candidates before pagination"),
    refundsNetted: z.literal(false),
    currentMonthlyEstimateMinor: z.null(),
  }),
  pagination: z.object({
    limit: z.number().int(),
    offset: z.number().int(),
    nextOffset: z.number().int().nullable(),
  }),
  exclusions: z.array(
    z
      .object({
        reason: z.string(),
        count: z.number().int(),
        recordIds: z.array(z.string()).max(25),
        referencesTruncated: z.boolean(),
      })
      .passthrough(),
  ),
});

export type SubscriptionCandidate = z.infer<
  typeof RecurrenceResultSchema
>["candidates"][number];

export type RecurrenceResult = z.infer<typeof RecurrenceResultSchema>;
