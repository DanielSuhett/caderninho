import { z } from "zod/v4";

import { type Resource, TransactionStatus } from "#domain/enums.ts";
import { accountingDay, assertMinor } from "#domain/exact.ts";
import { normalizeResource } from "#domain/finance-model.ts";
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
    normalizeResource(resource, raw, parent, { referenceDay });

  if (resource === "transactions" && !legacyProjection) {
    record.accountName = parent?.name ?? null;
  }

  for (const [field, value] of Object.entries(record))
    if (field.endsWith("Minor") && typeof value === "string")
      assertMinor(value);

  const amount =
    record.amountMinor ??
    record.balanceMinor ??
    record.totalAmountMinor ??
    record.contractAmountMinor ??
    null;

  const amountText = amount === null ? null : z.string().parse(amount);

  if (amountText !== null) assertMinor(amountText);

  const date =
    typeof record.accountingDate === "string"
      ? record.accountingDate
      : typeof record.date === "string"
        ? accountingDay(record.date)
        : null;

  const eligible = Number(
    date !== null &&
      date <= referenceDay &&
      record.status !== TransactionStatus.PENDING,
  );

  const text = (k: string) =>
    typeof record[k] === "string" ? record[k] : null;

  return {
    record,
    amountText,
    date,
    eligible,
    currency: text("currencyCode") ?? text("totalAmountCurrencyCode"),
    accountType: text("accountType") ?? text("type"),
    direction: text("type"),
    status: text("status"),
    category: text("category"),
    description: text("description"),
  };
}

export const NORMALIZER = "finance-v3.1";
