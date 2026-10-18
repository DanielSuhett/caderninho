import { Availability, Product, Resource } from "#domain/enums.ts";
import {
  DEFINITIONS,
  normalizeValidatedResource,
} from "#domain/finance-model.ts";
import type {
  FinanceRecord,
  ItemInfo,
  ProviderRecord,
} from "#domain/schemas.ts";
import type { JsonValue } from "#shared/json.ts";

export function itemInfo(raw: ProviderRecord): ItemInfo {
  const normalized = normalizeValidatedResource(
    Resource.connections,
    raw,
    undefined,
    { referenceDay: null },
  );

  const statusDetail = Object.fromEntries(
    Object.entries(normalized).filter(
      (entry): entry is [string, JsonValue] =>
        entry[0].startsWith("statusDetail.") && entry[1] !== undefined,
    ),
  );

  return {
    id: raw.id,
    status: raw.status ?? null,
    executionStatus: raw.executionStatus ?? null,
    products: raw.products ?? null,
    resourcesCollectedAt: raw.resourcesCollectedAt ?? null,
    consentExpiresAt: raw.consentExpiresAt ?? null,
    lastUpdatedAt: raw.lastUpdatedAt ?? null,
    statusDetail,
    connector: {
      id: raw.connector?.id ?? null,
      name: raw.connector?.name ?? null,
      isOpenFinance: raw.connector?.isOpenFinance ?? null,
      isSandbox: raw.connector?.isSandbox ?? null,
      products: raw.connector?.products ?? null,
    },
  };
}

export function productState(
  resource: Resource,
  item: ItemInfo,
  consents: FinanceRecord[],
  now: number,
) {
  const product = DEFINITIONS[resource].product;

  if (
    resource === Resource.resources &&
    item.connector.isOpenFinance === false
  ) {
    return Availability.unsupported;
  }

  if (
    product &&
    Array.isArray(item.connector.products) &&
    !item.connector.products.includes(product) &&
    !(
      resource === Resource.accounts &&
      item.connector.products.includes(Product.CREDIT_CARDS)
    )
  ) {
    return Availability.unsupported;
  }

  if (
    product &&
    Array.isArray(item.products) &&
    !item.products.includes(product) &&
    !(
      resource === Resource.accounts &&
      item.products.includes(Product.CREDIT_CARDS)
    )
  ) {
    return Availability.not_enabled;
  }

  if (
    product &&
    item.consentExpiresAt &&
    Date.parse(item.consentExpiresAt) < now
  ) {
    return Availability.not_authorized;
  }

  if (
    product &&
    consents.length &&
    !consents.some(
      (c) =>
        !c.revokedAt &&
        (!c.expiresAt || Date.parse(c.expiresAt) > now) &&
        c.products?.includes(product),
    )
  ) {
    return Availability.not_authorized;
  }

  return null;
}
