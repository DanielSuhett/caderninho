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
  creditData: z
    .object({
      availableCreditLimit: money.nullish(),
      balanceCloseDate: z.string().nullish(),
      balanceDueDate: z.string().nullish(),
      creditLimit: money.nullish(),
    })
    .nullish(),
  currencyCode: z.string().min(1),
  id: z.string().min(1),
  itemId: z.string().min(1),
  name: z.string(),
  number: z.string().nullish(),
  type: z.enum(["BANK", "CREDIT"]),
}) satisfies z.ZodType<ProviderAccount>;
export const ProviderTransactionSchema = z.object({
  accountId: z.string().min(1),
  amount: money.nullable(),
  category: z.string().nullish(),
  creditCardMetadata: z
    .object({
      billId: z.string().nullish(),
      cardNumber: z.string().nullish(),
      installmentNumber: z.coerce.number().int().min(1).max(600).nullish(),
      purchaseDate: z.string().nullish(),
      totalInstallments: z.coerce.number().int().min(1).max(600).nullish(),
    })
    .nullish(),
  currencyCode: z.string().min(1),
  date: z.string().min(10),
  description: z.string(),
  id: z.string().min(1),
  operationType: z.string().nullish(),
  status: z.enum(["PENDING", "POSTED"]).default("POSTED"),
  type: z.enum(["DEBIT", "CREDIT"]),
}) satisfies z.ZodType<ProviderTransaction>;
