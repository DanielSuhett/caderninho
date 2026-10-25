import { z } from "zod/v4";

import {
  AccountType,
  TransactionDirection,
  TransactionStatus,
} from "./finance.entity";
import type {
  Credentials,
  ProviderAccount,
  ProviderConnection,
  ProviderTransaction,
} from "./provider.entity";
import {
  TransactionCardSchema,
  TransactionMerchantSchema,
  TransactionPaymentSchema,
} from "./transaction.schema";

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
  type: z.enum([AccountType.BANK, AccountType.CREDIT]),
}) satisfies z.ZodType<ProviderAccount>;
export const ProviderTransactionSchema = z.object({
  accountId: z.string().min(1),
  amount: money.nullable(),
  amountInAccountCurrency: money.nullish(),
  balance: money.nullish(),
  category: z.string().nullish(),
  categoryId: z.string().nullish(),
  createdAt: z.string().nullish(),
  creditCardMetadata: TransactionCardSchema.omit({
    payeeMCC: true,
    totalAmountMinor: true,
  })
    .extend({
      installmentNumber: z.coerce.number().int().min(1).max(600).nullish(),
      payeeMCC: money.transform(String).nullish(),
      totalAmount: money.nullish(),
      totalInstallments: z.coerce.number().int().min(1).max(600).nullish(),
    })
    .nullish(),
  currencyCode: z.string().min(1),
  date: z.string().min(10),
  description: z.string(),
  descriptionRaw: z.string().nullish(),
  id: z.string().min(1),
  merchant: TransactionMerchantSchema.nullish(),
  operationType: z.string().nullish(),
  operationTypeAdditionalInfo: z.string().nullish(),
  order: z.coerce.number().int().nonnegative().nullish(),
  paymentData: TransactionPaymentSchema.omit({ boletoMetadata: true })
    .extend({
      boletoMetadata: z
        .object({
          barcode: z.string().nullish(),
          baseAmount: money.nullish(),
          digitableLine: z.string().nullish(),
          discountAmount: money.nullish(),
          interestAmount: money.nullish(),
          penaltyAmount: money.nullish(),
        })
        .nullish(),
    })
    .nullish(),
  providerCode: z.string().nullish(),
  providerId: z.string().nullish(),
  status: z
    .enum([TransactionStatus.PENDING, TransactionStatus.POSTED])
    .default(TransactionStatus.POSTED),
  type: z.enum([TransactionDirection.DEBIT, TransactionDirection.CREDIT]),
  updatedAt: z.string().nullish(),
}) satisfies z.ZodType<ProviderTransaction>;
