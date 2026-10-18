import { z } from "zod/v4";

import type { Credentials, ProviderRecord } from "./provider.entity";

const MoneyInputSchema = z.union([z.string(), z.number()]).nullish();

const text = z.string().nullish();
const scalar = z.union([z.string(), z.number(), z.boolean()]).nullish();
// Provider payloads enter here before any field is trusted. Unknown keys are
// retained for the allowlisted provider-field projection, never cast to a model.
const participant = z
  .object({ name: text, documentNumber: z.object({ value: text }).nullish() })
  .loose();

export const ProviderRecordSchema = z
  .object({
    id: z.union([z.string(), z.number()]).nullish(),
    resourceId: text,
    itemId: text,
    accountId: text,
    investmentId: text,
    type: text,
    status: text,
    executionStatus: text,
    lastUpdatedAt: text,
    consentExpiresAt: text,
    products: z.array(z.string()).nullish(),
    resourcesCollectedAt: z.json().nullish(),
    connector: z
      .object({
        id: scalar,
        name: text,
        products: z.array(z.string()).nullish(),
        isOpenFinance: z.boolean().nullish(),
        isSandbox: z.boolean().nullish(),
      })
      .loose()
      .nullish(),
    name: text,
    currencyCode: text,
    date: text,
    amount: MoneyInputSchema,
    description: text,
    operationType: text,
    category: text,
    categoryId: text,
    taxNumber: text,
    url: text,
    updatedAt: text,
    createdAt: text,
    updateDateTime: text,
    balance: MoneyInputSchema,
    availableBalance: MoneyInputSchema,
    automaticallyInvestedBalance: MoneyInputSchema,
    merchant: z.object({ name: text }).loose().nullish(),
    creditCardMetadata: z.object({ billId: text }).loose().nullish(),
    paymentData: z
      .object({
        paymentMethod: text,
        payer: participant.nullish(),
        receiver: participant.nullish(),
      })
      .loose()
      .nullish(),
  })
  .loose() satisfies z.ZodType<ProviderRecord>;

export const PluggyCredentialsSchema = z
  .object({
    clientId: z.string().trim().min(1).max(256),
    clientSecret: z.string().min(1).max(1024),
  })
  .strict() satisfies z.ZodType<Credentials>;
