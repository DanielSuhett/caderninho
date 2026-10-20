import { z } from "zod/v4";

import type {
  Credentials,
  ProviderAccount,
  ProviderConnection,
  ProviderTransaction,
} from "./provider.entity";

const money = z.union([z.string(), z.number()]);
const participant = z
  .object({
    documentNumber: z.object({ value: z.string().nullish() }).nullish(),
  })
  .loose();
export const PluggyCredentialsSchema = z.object({
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
}) satisfies z.ZodType<Credentials>;
export const ProviderConnectionSchema = z.object({
  connector: z.object({ id: money, name: z.string().optional() }).optional(),
  id: z.string(),
  status: z.string().optional(),
}) satisfies z.ZodType<ProviderConnection>;
export const ProviderAccountSchema = z
  .object({
    balance: money.nullish(),
    currencyCode: z.string().min(1),
    id: z.string().min(1),
    itemId: z.string().min(1),
    name: z.string(),
    taxNumber: z.string().nullish(),
    type: z.enum(["BANK", "CREDIT"]),
    updatedAt: z.string().nullish(),
  })
  .catchall(z.json()) satisfies z.ZodType<ProviderAccount>;
export const ProviderTransactionSchema = z
  .object({
    accountId: z.string().min(1),
    amount: money.nullable(),
    category: z.string().nullish(),
    currencyCode: z.string().min(1),
    date: z.string().min(10),
    description: z.string(),
    id: z.string().min(1),
    merchant: z.object({ name: z.string().nullish() }).loose().nullish(),
    operationType: z.string().nullish(),
    paymentData: z
      .object({
        payer: participant.nullish(),
        paymentMethod: z.string().nullish(),
        receiver: participant.nullish(),
      })
      .loose()
      .nullish(),
    status: z.enum(["PENDING", "POSTED"]).default("POSTED"),
    type: z.enum(["DEBIT", "CREDIT"]),
    updatedAt: z.string().nullish(),
  })
  .catchall(z.json()) satisfies z.ZodType<ProviderTransaction>;
