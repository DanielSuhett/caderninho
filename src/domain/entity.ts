import { type Resource, TransactionStatus } from "#domain/enums.ts";
import { accountingDay, assertMinor } from "#domain/exact.ts";
import { normalizeValidatedResource } from "#domain/finance-model.ts";
import providerFields from "#domain/provider-fields.json" with { type: "json" };
import type { FinanceRecord, ProviderRecord } from "#domain/schemas.ts";

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
    normalizeValidatedResource(resource, raw, parent, { referenceDay });

  if (resource === "transactions" && !legacyProjection) {
    record.accountName = parent?.name ?? null;
  }

  for (const [field, value] of Object.entries(record)) {
    if (field.endsWith("Minor") && typeof value === "string") {
      assertMinor(value);
    }
  }

  const amount =
    record.amountMinor ??
    record.balanceMinor ??
    record.totalAmountMinor ??
    record.contractAmountMinor ??
    null;

  const amountText = amount;

  if (amountText !== null) {
    assertMinor(amountText);
  }

  const date = entityDate(record);

  const eligible = Number(
    date !== null &&
      date <= referenceDay &&
      record.status !== TransactionStatus.PENDING,
  );

  return {
    record,
    amountText,
    date,
    eligible,
    ...entityAttributes(record),
  };
}

function entityAttributes(record: FinanceRecord) {
  return {
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
      resource === "transactions"
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

  if (resource !== "transactions") {
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
    const value = providerValue(raw, path);

    if (value !== undefined) {
      relevant[path] = value;
    }
  }

  if (legacyProjection) {
    relevant.legacyProjection = legacyProjection;
  }

  return relevant;
}

function providerValue(raw: ProviderRecord, path: string): unknown {
  let value: unknown = raw;

  for (const segment of path.split(".")) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return undefined;
    }
    value = Object.entries(value).find(([key]) => key === segment)?.[1];
  }

  return value;
}

function entityDate(record: FinanceRecord) {
  if (typeof record.accountingDate === "string") {
    return record.accountingDate;
  }

  if (typeof record.date === "string") {
    return accountingDay(record.date);
  }

  return null;
}
