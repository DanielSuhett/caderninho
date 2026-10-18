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
  field: string;
  code: string;
};

export interface FinanceRecord {
  [field: string]: JsonValue | undefined;
  id: string;
  accountId?: OptionalText;
  accountName?: OptionalText;
  investmentId?: OptionalText;
  accountType?: OptionalText;
  ownerDocument?: OptionalText;
  date?: OptionalText;
  accountingDate?: OptionalText;
  timestampLocalDate?: OptionalText;
  updatedAt?: OptionalText;
  dueDate?: OptionalText;
  currencyCode?: OptionalText;
  totalAmountCurrencyCode?: OptionalText;
  type?: OptionalText;
  subtype?: OptionalText;
  status?: OptionalText;
  name?: OptionalText;
  description?: OptionalText;
  parentDescription?: OptionalText;
  category?: OptionalText;
  categoryId?: OptionalText;
  billId?: OptionalText;
  paymentMethod?: OptionalText;
  operationType?: OptionalText;
  counterparty?: OptionalText;
  amount?: MoneyInput;
  amountMinor?: OptionalText;
  balanceMinor?: OptionalText;
  totalAmountMinor?: OptionalText;
  contractAmountMinor?: OptionalText;
  absoluteAmountMinor?: OptionalText;
  signedFlowMinor?: OptionalText;
  knownConsumptionMinor?: OptionalText;
  unclassifiedDebitMinor?: OptionalText;
  classification?: Classification | undefined;
  classificationEvidence?: string[] | undefined;
  ownTransferEvidence?: boolean | undefined;
  products?: string[] | null | undefined;
  revokedAt?: OptionalText;
  expiresAt?: OptionalText;
  parentId?: OptionalText;
  monthYear?: OptionalText;
  "merchant.name"?: OptionalText;
  "creditCardMetadata.installmentNumber"?: OptionalScalar;
  "creditCardMetadata.totalInstallments"?: OptionalScalar;
  provenance?: Record<string, Provenance> | undefined;
  precisionWarnings?: PrecisionWarning[] | undefined;
}

export interface ResourceDefinition {
  product: string | null;
  defaults: string[];
  parent?: Resource;
}

export interface MetricDefinition {
  field?: string;
  unit: string;
  temporal: string;
  description: string;
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
  itemId: string;
  resource: Resource;
  parentId: string;
  id: string;
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
    record,
    amountText,
    date,
    eligible,
    currency: record.currencyCode ?? record.totalAmountCurrencyCode ?? null,
    accountType: record.accountType ?? record.type ?? null,
    direction: record.type ?? null,
    status: record.status ?? null,
    category: record.category ?? null,
    description: record.description ?? null,
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
    source,
    parent:
      resource === Resource.transactions
        ? {
            id: parent?.id,
            type: parent?.type,
            name: parent?.name,
            ownerDocument: parent?.ownerDocument,
          }
        : null,
  };
}

function relevantSource(
  resource: Resource,
  raw: ProviderRecord,
  legacyProjection: FinanceRecord | undefined,
) {
  const source: Record<string, unknown> = { ...raw };

  if (resource !== Resource.transactions) {
    delete source.updatedAt;
    delete source.createdAt;

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
