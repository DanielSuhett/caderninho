import { z } from "zod/v4";

import { JsonValueSchema } from "@/shared/json";

import {
  ClassificationSchema,
  ProvenanceOriginSchema,
  ResourceSchema,
} from "./enums.schema";
import {
  CorrectionField,
  type CorrectionInput,
  type FinanceRecord,
  type RecordReference,
} from "./finance.entity";

const text = z.string().nullish();
const scalar = z.union([z.string(), z.number(), z.boolean()]).nullish();

const ProvenanceSchema = z.object({
  origin: ProvenanceOriginSchema,
  sourceField: z.string(),
});

const PrecisionWarningSchema = z.object({
  code: z.string(),
  field: z.string(),
});

export const FinanceRecordSchema = z
  .object({
    absoluteAmountMinor: text,
    accountId: text,
    accountingDate: text,
    accountName: text,
    accountType: text,
    amount: z.union([z.string(), z.number()]).nullish(),
    amountMinor: text,
    balanceMinor: text,
    billId: text,
    category: text,
    categoryId: text,
    classification: ClassificationSchema.optional(),
    classificationEvidence: z.array(z.string()).optional(),
    contractAmountMinor: text,
    counterparty: text,
    "creditCardMetadata.installmentNumber": scalar,
    "creditCardMetadata.totalInstallments": scalar,
    currencyCode: text,
    date: text,
    description: text,
    dueDate: text,
    expiresAt: text,
    id: z.string(),
    investmentId: text,
    knownConsumptionMinor: text,
    "merchant.name": text,
    monthYear: text,
    name: text,
    operationType: text,
    ownerDocument: text,
    ownTransferEvidence: z.boolean().optional(),
    parentDescription: text,
    parentId: text,
    paymentMethod: text,
    precisionWarnings: z.array(PrecisionWarningSchema).optional(),
    products: z.array(z.string()).nullish(),
    provenance: z.record(z.string(), ProvenanceSchema).optional(),
    revokedAt: text,
    signedFlowMinor: text,
    status: text,
    subtype: text,
    timestampLocalDate: text,
    totalAmountCurrencyCode: text,
    totalAmountMinor: text,
    type: text,
    unclassifiedDebitMinor: text,
    updatedAt: text,
  })
  .catchall(JsonValueSchema.optional()) satisfies z.ZodType<FinanceRecord>;

export const RecordReferenceSchema = z.object({
  id: z.string().min(1),
  itemId: z.string().min(1),
  parentId: z.string().default(""),
  resource: ResourceSchema,
}) satisfies z.ZodType<RecordReference>;

export const CorrectionInputSchema = RecordReferenceSchema.extend({
  field: z.enum(CorrectionField),
  key: z.string().min(1).max(80).optional(),
  value: z.string().max(2048).nullable(),
}) satisfies z.ZodType<CorrectionInput>;
