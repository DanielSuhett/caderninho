import { z } from "zod/v4";

import {
  ClassificationSchema,
  ProvenanceOriginSchema,
} from "#domain/enums.schema.ts";
import type { FinanceRecord } from "#domain/finance.types.ts";
import { JsonValueSchema } from "#shared/json.ts";

const text = z.string().nullish();
const scalar = z.union([z.string(), z.number(), z.boolean()]).nullish();

const ProvenanceSchema = z.object({
  origin: ProvenanceOriginSchema,
  sourceField: z.string(),
});

const PrecisionWarningSchema = z.object({
  field: z.string(),
  code: z.string(),
});

export const FinanceRecordSchema = z
  .object({
    id: z.string(),
    accountId: text,
    accountName: text,
    investmentId: text,
    accountType: text,
    ownerDocument: text,
    date: text,
    accountingDate: text,
    timestampLocalDate: text,
    updatedAt: text,
    dueDate: text,
    currencyCode: text,
    totalAmountCurrencyCode: text,
    type: text,
    subtype: text,
    status: text,
    name: text,
    description: text,
    parentDescription: text,
    category: text,
    categoryId: text,
    billId: text,
    paymentMethod: text,
    operationType: text,
    counterparty: text,
    amount: z.union([z.string(), z.number()]).nullish(),
    amountMinor: text,
    balanceMinor: text,
    totalAmountMinor: text,
    contractAmountMinor: text,
    absoluteAmountMinor: text,
    signedFlowMinor: text,
    knownConsumptionMinor: text,
    unclassifiedDebitMinor: text,
    classification: ClassificationSchema.optional(),
    classificationEvidence: z.array(z.string()).optional(),
    ownTransferEvidence: z.boolean().optional(),
    products: z.array(z.string()).nullish(),
    revokedAt: text,
    expiresAt: text,
    parentId: text,
    monthYear: text,
    "merchant.name": text,
    "creditCardMetadata.installmentNumber": scalar,
    "creditCardMetadata.totalInstallments": scalar,
    provenance: z.record(z.string(), ProvenanceSchema).optional(),
    precisionWarnings: z.array(PrecisionWarningSchema).optional(),
  })
  .catchall(JsonValueSchema.optional()) satisfies z.ZodType<FinanceRecord>;
