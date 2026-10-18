import type { JsonValue } from "@/shared/json.types";

import {
  type Classification,
  EntityChange,
  type ProvenanceOrigin,
  Resource,
  TransactionStatus,
} from "./enums";
import { accountingDay, assertMinor, isMatureDate } from "./exact";
import { normalizeResource, providerFieldValue } from "./finance-model";
import type { ProviderRecord } from "./provider.entity";
import providerFields from "./provider-fields";

export type MoneyInput = string | number | null | undefined;
export type OptionalText = string | null | undefined;
export type OptionalScalar = string | number | boolean | null | undefined;

export type Provenance = {
  origin: ProvenanceOrigin;
  sourceField: string;
};

export type PrecisionWarning = {
  code: string;
  field: string;
};

export interface FinanceRecord {
  absoluteAmountMinor?: OptionalText;
  accountId?: OptionalText;
  accountingDate?: OptionalText;
  accountName?: OptionalText;
  accountType?: OptionalText;
  amount?: MoneyInput;
  amountMinor?: OptionalText;
  balanceMinor?: OptionalText;
  billId?: OptionalText;
  category?: OptionalText;
  categoryId?: OptionalText;
  classification?: Classification | undefined;
  classificationEvidence?: string[] | undefined;
  contractAmountMinor?: OptionalText;
  counterparty?: OptionalText;
  "creditCardMetadata.installmentNumber"?: OptionalScalar;
  "creditCardMetadata.totalInstallments"?: OptionalScalar;
  currencyCode?: OptionalText;
  date?: OptionalText;
  description?: OptionalText;
  dueDate?: OptionalText;
  expiresAt?: OptionalText;
  id: string;
  investmentId?: OptionalText;
  knownConsumptionMinor?: OptionalText;
  "merchant.name"?: OptionalText;
  monthYear?: OptionalText;
  name?: OptionalText;
  operationType?: OptionalText;
  ownerDocument?: OptionalText;
  ownTransferEvidence?: boolean | undefined;
  parentDescription?: OptionalText;
  parentId?: OptionalText;
  paymentMethod?: OptionalText;
  precisionWarnings?: PrecisionWarning[] | undefined;
  products?: string[] | null | undefined;
  provenance?: Record<string, Provenance> | undefined;
  revokedAt?: OptionalText;
  signedFlowMinor?: OptionalText;
  status?: OptionalText;
  subtype?: OptionalText;
  timestampLocalDate?: OptionalText;
  totalAmountCurrencyCode?: OptionalText;
  totalAmountMinor?: OptionalText;
  type?: OptionalText;
  unclassifiedDebitMinor?: OptionalText;
  updatedAt?: OptionalText;
  [field: string]: JsonValue | undefined;
}

export interface ResourceDefinition {
  defaults: string[];
  parent?: Resource;
  product: string | null;
}

export interface MetricDefinition {
  description: string;
  field?: string;
  temporal: string;
  unit: string;
}

export const CorrectionField = {
  category: "category",
  description: "description",
  ignored: "ignored",
  tag: "tag",
} as const;
export type CorrectionField =
  (typeof CorrectionField)[keyof typeof CorrectionField];

export interface RecordReference {
  id: string;
  itemId: string;
  parentId: string;
  resource: Resource;
}

export interface CorrectionInput extends RecordReference {
  field: CorrectionField;
  key?: string | undefined;
  value: string | null;
}

export type RecordChange =
  | { field: typeof CorrectionField.tag; key: string; value: string | null }
  | {
      field: Exclude<CorrectionField, typeof CorrectionField.tag>;
      value: string | null;
    };

export function assertEntityIdentity({
  source,
  expectedId,
}: {
  source: ProviderRecord;
  expectedId: string;
}) {
  if (String(source.id ?? source.resourceId) !== expectedId) {
    throw new Error("SOURCE_ID_MISMATCH");
  }
}

export function entityChange({
  previous,
  digest,
  renormalize,
}: {
  previous: { relevantHash: string; deleted: boolean } | undefined;
  digest: string;
  renormalize: boolean;
}) {
  if (!renormalize && previous?.relevantHash === digest && !previous.deleted) {
    return EntityChange.unchanged;
  }
  return previous ? EntityChange.changed : EntityChange.new;
}

export function projectEntity({
  resource,
  raw,
  parent,
  referenceDay,
  legacyProjection,
}: {
  resource: Resource;
  raw: ProviderRecord;
  parent: FinanceRecord | undefined;
  referenceDay: string;
  legacyProjection?: FinanceRecord;
}) {
  const record =
    legacyProjection ??
    normalizeResource(resource, raw, parent, { referenceDay });

  if (resource === Resource.transactions && !legacyProjection) {
    record.accountName = parent?.name ?? null;
  }

  // Legacy records bypass normalization; their monetary guarantees start here.
  if (legacyProjection) {
    for (const [field, value] of Object.entries(legacyProjection)) {
      if (field.endsWith("Minor") && typeof value === "string") {
        assertMinor(value);
      }
    }
  }

  const amountText =
    record.amountMinor ??
    record.balanceMinor ??
    record.totalAmountMinor ??
    record.contractAmountMinor ??
    null;

  const date = record.accountingDate ?? accountingDay(record.date);

  const eligible =
    isMatureDate({ date, referenceDay }) &&
    record.status !== TransactionStatus.PENDING;

  return {
    accountType: record.accountType ?? record.type ?? null,
    amountText,
    category: record.category ?? null,
    currency: record.currencyCode ?? record.totalAmountCurrencyCode ?? null,
    date,
    description: record.description ?? null,
    direction: record.type ?? null,
    eligible,
    record,
    status: record.status ?? null,
  };
}

export const NORMALIZER = "finance-v3.1";

// Only fields consumed by normalization and rules affect derived identity.
// Timestamps and running balance may change without changing financial meaning.
export function entityFingerprint({
  resource,
  raw,
  parent,
  legacyProjection,
}: {
  resource: Resource;
  raw: ProviderRecord;
  parent: FinanceRecord | undefined;
  legacyProjection: FinanceRecord | undefined;
}) {
  const source = relevantSource(resource, raw, legacyProjection);

  return {
    parent:
      resource === Resource.transactions
        ? {
            id: parent?.id,
            name: parent?.name,
            ownerDocument: parent?.ownerDocument,
            type: parent?.type,
          }
        : null,
    source,
  };
}

function relevantSource(
  resource: Resource,
  raw: ProviderRecord,
  legacyProjection: FinanceRecord | undefined,
) {
  if (resource !== Resource.transactions) {
    const { updatedAt: _updatedAt, createdAt: _createdAt, ...source } = raw;
    return source;
  }

  const relevant: Record<string, unknown> = {};

  for (const path of [
    ...Object.keys(providerFields.transactions),
    "operationType",
    "paymentData.receiver.documentNumber.value",
    "paymentData.payer.documentNumber.value",
  ]) {
    if (["updatedAt", "createdAt", "balance"].includes(path)) {
      continue;
    }
    const value = providerFieldValue(raw, path);

    if (value !== undefined) {
      relevant[path] = value;
    }
  }

  if (legacyProjection) {
    relevant.legacyProjection = legacyProjection;
  }

  return relevant;
}

export function recordChange(input: CorrectionInput): RecordChange {
  if (input.field === CorrectionField.tag) {
    if (input.key === undefined) {
      throw new Error("TAG_KEY_REQUIRED");
    }
    return {
      field: CorrectionField.tag,
      key: input.key,
      value: input.value,
    };
  }

  if (
    input.field === CorrectionField.ignored &&
    input.value !== null &&
    !["0", "1"].includes(input.value)
  ) {
    throw new Error("ignored requires 0 or 1");
  }

  return { field: input.field, value: input.value };
}
