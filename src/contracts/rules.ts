import { z } from "zod/v4";

const value = z.string().trim().min(1).max(160);
const comparison = z.enum(["equals", "gte", "lte"]);
export const RuleConditionSchema = z.discriminatedUnion("field", [
  z
    .object({
      field: z.literal("description"),
      operator: z.enum(["contains", "not_contains", "equals", "starts_with"]),
      value,
    })
    .strict(),
  z
    .object({
      field: z.literal("direction"),
      operator: z.literal("equals"),
      value: z.enum(["DEBIT", "CREDIT"]),
    })
    .strict(),
  z
    .object({
      field: z.literal("status"),
      operator: z.literal("equals"),
      value: z.enum(["POSTED", "PENDING"]),
    })
    .strict(),
  z
    .object({
      field: z.literal("accountId"),
      operator: z.literal("equals"),
      value,
    })
    .strict(),
  z
    .object({
      field: z.literal("personId"),
      operator: z.literal("equals"),
      value,
    })
    .strict(),
  z
    .object({
      field: z.literal("date"),
      operator: comparison,
      value: z.iso.date(),
    })
    .strict(),
  z
    .object({
      field: z.literal("amount"),
      operator: comparison,
      value: z.string().regex(/^(0|[1-9]\d{0,29})$/),
    })
    .strict(),
]);
export const RuleFilterSchema = z
  .object({
    alternatives: z
      .array(
        z
          .object({ conditions: z.array(RuleConditionSchema).min(1).max(8) })
          .strict(),
      )
      .min(1)
      .max(4),
    currency: z
      .string()
      .regex(/^[A-Z]{3}$/)
      .nullable()
      .default(null),
  })
  .strict()
  .superRefine((filter, ctx) => {
    if (
      !filter.currency &&
      filter.alternatives.some((a) =>
        a.conditions.some((c) => c.field === "amount"),
      )
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Escolha uma moeda para comparar valores.",
      });
    }
  });
export const RulePreviewQuerySchema = z
  .object({
    accountId: value.nullable().default(null),
    direction: z.enum(["DEBIT", "CREDIT"]).nullable().default(null),
    filter: RuleFilterSchema.nullable().default(null),
    spaceId: value,
    text: z.string().max(240).default(""),
  })
  .strict()
  .refine(
    (input) => !!(input.text.trim() || input.filter),
    "Adicione ao menos uma condição.",
  );
export type RulePreviewQuery = z.infer<typeof RulePreviewQuerySchema>;
export const RulePreviewSchema = RulePreviewQuerySchema.safeExtend({
  csrf: z.string(),
});
export type RulePreviewInput = z.infer<typeof RulePreviewSchema>;
export const RulePreviewResultSchema = z.object({
  count: z.number().int().nonnegative(),
  examined: z.number().int().nonnegative(),
  partial: z.boolean(),
  revision: z.number(),
  samples: z.array(
    z.object({
      accountId: z.string(),
      amountMinor: z.string().nullable(),
      currency: z.string(),
      date: z.string(),
      description: z.string(),
      id: z.string(),
      personName: z.string(),
    }),
  ),
  truncated: z.boolean(),
});
export type RulePreviewResult = z.infer<typeof RulePreviewResultSchema>;
