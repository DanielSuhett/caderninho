import { Resource, TransactionStatus } from "#domain/enums.ts";
import { accountingDay, assertMinor } from "#domain/exact.ts";
import type { FinanceRecord } from "#domain/finance.types.ts";
import {
  normalizeResource,
  providerFieldValue,
} from "#domain/finance-model.ts";
import type { ProviderRecord } from "#domain/provider.types.ts";
import providerFields from "#domain/provider-fields.ts";

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
    date !== null &&
    date <= referenceDay &&
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
