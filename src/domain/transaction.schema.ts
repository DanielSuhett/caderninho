import { z } from "zod/v4";

import type {
  TransactionIdentification,
  TransactionMerchant,
  TransactionParticipant,
} from "./transaction.entity";

const text = z.string().nullish();
const minor = z
  .string()
  .regex(/^-?\d+$/)
  .nullish();
export const TransactionMerchantSchema = z.object({
  businessName: text,
  category: text,
  cnae: text,
  cnpj: text,
  name: text,
}) satisfies z.ZodType<TransactionMerchant>;
export const TransactionParticipantSchema = z.object({
  accountNumber: text,
  branchNumber: text,
  documentNumber: z.object({ type: text, value: text }).nullish(),
  name: text,
  routingNumber: text,
  routingNumberISPB: text,
}) satisfies z.ZodType<TransactionParticipant>;
export const TransactionCardSchema = z.object({
  billForecastDate: text,
  billId: text,
  billPostDate: text,
  cardNumber: text,
  feeType: text,
  feeTypeAdditionalInfo: text,
  installmentNumber: z.number().int().nullish(),
  otherCreditsAdditionalInfo: text,
  otherCreditsType: text,
  payeeMCC: text,
  paymentType: text,
  purchaseDate: text,
  totalAmountMinor: minor,
  totalInstallments: z.number().int().nullish(),
  transactionDateTime: text,
});
export const TransactionPaymentSchema = z.object({
  authenticationCode: text,
  boletoMetadata: z
    .object({
      barcode: text,
      baseAmountMinor: minor,
      digitableLine: text,
      discountAmountMinor: minor,
      interestAmountMinor: minor,
      penaltyAmountMinor: minor,
    })
    .nullish(),
  payer: TransactionParticipantSchema.nullish(),
  paymentMethod: text,
  reason: text,
  receiver: TransactionParticipantSchema.nullish(),
  receiverReferenceId: text,
  referenceNumber: text,
});
export const TransactionIdentificationSchema = z.object({
  amountInAccountCurrency: z
    .string()
    .regex(/^-?\d+(?:\.\d+)?$/)
    .nullish(),
  balance: z
    .string()
    .regex(/^-?\d+(?:\.\d+)?$/)
    .nullish(),
  category: text,
  categoryId: text,
  createdAt: text,
  creditCardMetadata: TransactionCardSchema.nullish(),
  date: text,
  descriptionRaw: text,
  merchant: TransactionMerchantSchema.nullish(),
  operationType: text,
  operationTypeAdditionalInfo: text,
  order: z.number().int().nullish(),
  paymentData: TransactionPaymentSchema.nullish(),
  providerCode: text,
  providerId: text,
  updatedAt: text,
}) satisfies z.ZodType<TransactionIdentification>;
