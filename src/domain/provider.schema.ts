import { z } from "zod/v4";

import type { Credentials, ProviderRecord } from "./provider.entity";

const MoneyInputSchema = z.union([z.string(), z.number()]).nullish();

const text = z.string().nullish();
const scalar = z.union([z.string(), z.number(), z.boolean()]).nullish();
// Provider payloads enter here before any field is trusted. Unknown keys are
// retained for the allowlisted provider-field projection, never cast to a model.
const participant = z
  .object({ documentNumber: z.object({ value: text }).nullish(), name: text })
  .loose();

export const ProviderRecordSchema = z
  .object({
    accountId: text,
    amount: MoneyInputSchema,
    automaticallyInvestedBalance: MoneyInputSchema,
    availableBalance: MoneyInputSchema,
    balance: MoneyInputSchema,
    category: text,
    categoryId: text,
    connector: z
      .object({
        id: scalar,
        isOpenFinance: z.boolean().nullish(),
        isSandbox: z.boolean().nullish(),
        name: text,
        products: z.array(z.string()).nullish(),
      })
      .loose()
      .nullish(),
    consentExpiresAt: text,
    createdAt: text,
    creditCardMetadata: z.object({ billId: text }).loose().nullish(),
    currencyCode: text,
    date: text,
    description: text,
    executionStatus: text,
    id: z.union([z.string(), z.number()]).nullish(),
    investmentId: text,
    itemId: text,
    lastUpdatedAt: text,
    merchant: z.object({ name: text }).loose().nullish(),
    name: text,
    operationType: text,
    paymentData: z
      .object({
        payer: participant.nullish(),
        paymentMethod: text,
        receiver: participant.nullish(),
      })
      .loose()
      .nullish(),
    products: z.array(z.string()).nullish(),
    resourceId: text,
    resourcesCollectedAt: z.json().nullish(),
    status: text,
    taxNumber: text,
    type: text,
    updateDateTime: text,
    updatedAt: text,
    url: text,
  })
  .loose() satisfies z.ZodType<ProviderRecord>;

export const PluggyCredentialsSchema = z
  .object({
    clientId: z.string().trim().min(1).max(256),
    clientSecret: z.string().min(1).max(1024),
  })
  .strict() satisfies z.ZodType<Credentials>;
