import { z } from "zod/v4";

import { FilterSchema } from "../domain";
import { RulesSchema } from "../domain/rules";
import {
  type LiveBalanceInput,
  type PreviewInput,
  type RuleCommand,
  RuleCommandAction,
  type SubscriptionInput,
} from "./finance.types";

export const RuleCommandSchema = z.object({
  action: z.enum(RuleCommandAction),
  catalog: RulesSchema.pick({ categories: true, groups: true }).optional(),
  document: z.json().optional(),
  revision: z.string().optional(),
}) satisfies z.ZodType<RuleCommand>;

export const PreviewInputSchema = z.object({
  filter: FilterSchema.optional(),
  itemIds: z.array(z.string()).min(1).max(100),
  limit: z.number().int().min(1).max(50).default(20),
  revision: z.string(),
}) satisfies z.ZodType<PreviewInput>;

export const SubscriptionInputSchema = z.object({
  currency: z.string(),
  from: z.string(),
  limit: z.number().int().min(1).max(100).default(20),
  to: z.string(),
}) satisfies z.ZodType<SubscriptionInput>;

export const LiveBalanceInputSchema = z.object({
  accountId: z.string(),
}) satisfies z.ZodType<LiveBalanceInput>;
