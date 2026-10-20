import { z } from "zod/v4";

import type {
  Credentials,
  ProviderAccount,
  ProviderConnection,
  ProviderTransaction,
} from "./provider.entity";

const money = z.union([z.string(), z.number()]);
export const PluggyCredentialsSchema = z.object({
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
}) satisfies z.ZodType<Credentials>;
export const ProviderConnectionSchema = z.object({
  connector: z.object({ id: money }).optional(),
  id: z.string(),
}) satisfies z.ZodType<ProviderConnection>;
export const ProviderAccountSchema = z.object({
  balance: money.nullish(),
  currencyCode: z.string().min(1),
  id: z.string().min(1),
  itemId: z.string().min(1),
  name: z.string(),
  type: z.enum(["BANK", "CREDIT"]),
}) satisfies z.ZodType<ProviderAccount>;
export const ProviderTransactionSchema = z.object({
  accountId: z.string().min(1),
  amount: money.nullable(),
  category: z.string().nullish(),
  currencyCode: z.string().min(1),
  date: z.string().min(10),
  description: z.string(),
  id: z.string().min(1),
  status: z.enum(["PENDING", "POSTED"]).default("POSTED"),
  type: z.enum(["DEBIT", "CREDIT"]),
}) satisfies z.ZodType<ProviderTransaction>;
