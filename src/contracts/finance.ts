import { z } from "zod/v4";

import type {
  AggregateQuery,
  TransactionFilter,
  TransactionQuery,
} from "../domain";
import { Metric } from "../domain";

const identifier = z.string().min(1).max(128);
const day = z.iso.date();
const amount = z.string().regex(/^-?(0|[1-9]\d{0,29})$/);
export const TransactionFilterSchema = z
  .object({
    accountIds: z.array(identifier).min(1).max(100).optional(),
    category: z.string().max(2048).optional(),
    connectionIds: z.array(identifier).min(1).max(10).optional(),
    currency: z.string().min(1).max(12).optional(),
    description: z.string().max(2048).optional(),
    direction: z.enum(["DEBIT", "CREDIT"]).optional(),
    from: day.optional(),
    maxAmountMinor: amount.optional(),
    minAmountMinor: amount.optional(),
    status: z.enum(["PENDING", "POSTED"]).optional(),
    to: day.optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (
      (value.minAmountMinor !== undefined ||
        value.maxAmountMinor !== undefined) &&
      !value.currency
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Monetary filters require currency",
      });
    }
    if (value.from && value.to && value.from > value.to) {
      ctx.addIssue({ code: "custom", message: "Invalid date range" });
    }
    if (
      value.minAmountMinor !== undefined &&
      value.maxAmountMinor !== undefined &&
      BigInt(value.minAmountMinor) > BigInt(value.maxAmountMinor)
    ) {
      ctx.addIssue({ code: "custom", message: "Invalid amount range" });
    }
  }) satisfies z.ZodType<TransactionFilter>;
export const TransactionQuerySchema = z
  .object({
    cursor: z
      .object({
        accountId: identifier,
        date: day,
        id: identifier,
        scope: z.string().length(64),
        state: z.string().length(64),
      })
      .strict()
      .optional(),
    filter: TransactionFilterSchema.optional(),
    limit: z.number().int().min(1).max(200).default(50),
  })
  .strict() satisfies z.ZodType<TransactionQuery>;
export const AggregateQuerySchema = z
  .object({
    filter: TransactionFilterSchema.optional(),
    groupBy: z.enum(["account", "category", "month"]).optional(),
    metric: z.enum(Metric).default("count"),
  })
  .strict() satisfies z.ZodType<AggregateQuery>;
export const ConnectionSelectionSchema = z
  .object({ connectionIds: z.array(identifier).min(1).max(10).optional() })
  .strict();
export const StatusInputSchema = ConnectionSelectionSchema;
