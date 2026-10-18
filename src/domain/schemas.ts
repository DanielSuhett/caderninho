import { z } from "zod/v4";

import {
  AvailabilitySchema,
  ClassificationSchema,
  PeriodicitySchema,
  ProvenanceOriginSchema,
  ResourceSchema,
} from "#domain/enums.ts";
import { JsonValueSchema } from "#shared/json.ts";

export const MoneyInputSchema = z.union([z.string(), z.number()]).nullish();

export type MoneyInput = z.infer<typeof MoneyInputSchema>;

const text = z.string().nullish();

const scalar = z.union([z.string(), z.number(), z.boolean()]).nullish();

export const RecurrenceOptionsSchema = z
  .object({
    from: z.string(),
    to: z.string(),
    currency: z.string(),
    limit: z.number().optional(),
    offset: z.number().optional(),
    asOfDay: z.string(),
  })
  .strict();

export type RecurrenceOptions = z.infer<typeof RecurrenceOptionsSchema>;

export const ImportArgsSchema = z
  .object({
    resource: ResourceSchema.optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    accountId: z.string().optional(),
    investmentId: z.string().optional(),
    resumeToken: z.string().optional(),
    refresh: z.boolean().optional(),
  })
  .strict();

export const ProvenanceSchema = z.object({
  origin: ProvenanceOriginSchema,
  sourceField: z.string(),
});

export const PrecisionWarningSchema = z.object({
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
    amount: MoneyInputSchema,
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
  .catchall(JsonValueSchema.optional());

export type FinanceRecord = z.infer<typeof FinanceRecordSchema>;

export const EligibleRecurrenceRecordSchema = FinanceRecordSchema.extend({
  accountingDate: z.string(),
  absoluteAmountMinor: z.string(),
  accountId: z.string(),
  currencyCode: z.string(),
});

export type EligibleRecurrenceRecord = z.infer<
  typeof EligibleRecurrenceRecordSchema
>;

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
  .loose();

export type ProviderRecord = z.infer<typeof ProviderRecordSchema>;

export const ProviderFieldSchema = z.object({
  kind: z.enum(["scalar", "decimal", "array", "array_scalar"]),
  get fields() {
    return z.record(z.string(), ProviderFieldSchema).optional();
  },
});

export type ProviderField = z.infer<typeof ProviderFieldSchema>;

export const ResourceDefinitionSchema = z.object({
  product: z.string().nullable(),
  defaults: z.array(z.string()),
  parent: ResourceSchema.optional(),
});

export type ResourceDefinition = z.infer<typeof ResourceDefinitionSchema>;

export const MetricDefinitionSchema = z.object({
  field: z.string().optional(),
  unit: z.string(),
  temporal: z.string(),
  description: z.string(),
});

export type MetricDefinition = z.infer<typeof MetricDefinitionSchema>;

export const ItemInfoSchema = z.object({
  id: scalar,
  status: text,
  executionStatus: text,
  products: z.array(z.string()).nullish(),
  resourcesCollectedAt: z.json().nullish(),
  consentExpiresAt: text,
  lastUpdatedAt: text,
  statusDetail: z.record(z.string(), z.json()).nullish(),
  connector: z.object({
    id: scalar,
    name: text,
    isOpenFinance: z.boolean().nullish(),
    isSandbox: z.boolean().nullish(),
    products: z.array(z.string()).nullish(),
  }),
});

export type ItemInfo = z.infer<typeof ItemInfoSchema>;

export const CoverageSchema = z
  .object({
    apiPaginationComplete: z.boolean(),
    bankHistoryComplete: z.boolean().nullable(),
    sourceCollectionVerified: z.boolean().optional(),
    reason: z.string().nullable().optional(),
  })
  .loose();

export const CollectionSchema = z
  .object({
    resource: ResourceSchema,
    scope: ImportArgsSchema.extend({ currency: z.string().optional() }),
    status: AvailabilitySchema,
    readAt: z.string(),
    dataKey: z.string().optional(),
    recordCount: z.number(),
    importJobId: z.string().optional(),
    coverage: CoverageSchema,
    sourceReferenceAt: text,
    sourceItemUpdatedAt: text,
    recordReferenceDates: z.array(z.string()).optional(),
    lastAttempt: z.json().optional(),
  })
  .loose();

export const SnapshotSchema = z
  .object({
    snapshotId: z.string(),
    owner: z.string(),
    itemId: z.string(),
    item: ItemInfoSchema,
    collections: z.record(z.string(), CollectionSchema),
  })
  .loose();

export type Snapshot = z.infer<typeof SnapshotSchema>;

export const ExclusionSchema = z.object({
  reason: z.string(),
  count: z.number(),
  recordIds: z.array(z.string()),
  knownAmountMinor: z.string().optional(),
});

export type Exclusion = z.infer<typeof ExclusionSchema>;

export const CadenceSchema = z.object({
  periodicity: PeriodicitySchema,
  observedPattern: PeriodicitySchema,
  missingCycles: z.number(),
  multipleChargesPerMonth: z.boolean(),
  intervalDays: z.array(z.number()),
});

export type Cadence = z.infer<typeof CadenceSchema>;

export const PayeeSchema = z.object({
  source: z.string(),
  value: z.string(),
  normalized: z.string(),
});

export const RecurrenceGroupSchema = z.object({
  name: PayeeSchema,
  rows: z.array(EligibleRecurrenceRecordSchema),
});

export type RecurrenceGroup = z.infer<typeof RecurrenceGroupSchema>;
