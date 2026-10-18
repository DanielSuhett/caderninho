import { z } from "zod/v4";

import { FilterSchema } from "@/domain/filter.schema";
import { RulesSchema } from "@/domain/rules";

import {
  type LiveBalanceInput,
  type PreviewInput,
  type RuleCommand,
  RuleCommandAction,
  type SubscriptionInput,
} from "./finance.types";

export const RuleCommandSchema = z.object({
  action: z.enum(RuleCommandAction),
  document: z.json().optional(),
  revision: z.string().optional(),
  catalog: RulesSchema.pick({ groups: true, categories: true }).optional(),
}) satisfies z.ZodType<RuleCommand>;

export const PreviewInputSchema = z.object({
  filter: FilterSchema.optional(),
  itemIds: z.array(z.string()).min(1).max(100),
  revision: z.string(),
  limit: z.number().int().min(1).max(50).default(20),
}) satisfies z.ZodType<PreviewInput>;

export const SubscriptionInputSchema = z.object({
  from: z.string(),
  to: z.string(),
  currency: z.string(),
  limit: z.number().int().min(1).max(100).default(20),
}) satisfies z.ZodType<SubscriptionInput>;

export const LiveBalanceInputSchema = z.object({
  accountId: z.string(),
}) satisfies z.ZodType<LiveBalanceInput>;
