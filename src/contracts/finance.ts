import { z } from "zod/v4";

import { FilterSchema } from "#contracts/queries.ts";
import { RulesSchema } from "#domain/rules/rules-schema.ts";

export const RuleCommandSchema = z.object({
  action: z.enum(["validate", "save", "activate", "read"]),
  document: z.json().optional(),
  revision: z.string().optional(),
  catalog: RulesSchema.pick({ groups: true, categories: true }).optional(),
});
export type RuleCommand = z.infer<typeof RuleCommandSchema>;

export const PreviewInputSchema = z.object({
  filter: FilterSchema.optional(),
  itemIds: z.array(z.string()).min(1).max(100),
  revision: z.string(),
  limit: z.number().int().min(1).max(50).default(20),
});
export type PreviewInput = z.infer<typeof PreviewInputSchema>;

export const SubscriptionInputSchema = z.object({
  from: z.string(),
  to: z.string(),
  currency: z.string(),
  limit: z.number().int().min(1).max(100).default(20),
});
export type SubscriptionInput = z.infer<typeof SubscriptionInputSchema>;

export const LiveBalanceInputSchema = z.object({
  itemId: z.string(),
  accountId: z.string(),
});
export type LiveBalanceInput = z.infer<typeof LiveBalanceInputSchema>;
