import type { JsonValue } from "@/shared/json.types";

import { Availability, Product, Resource } from "./enums";
import type {
  FinanceRecord,
  MoneyInput,
  OptionalScalar,
  OptionalText,
} from "./finance.entity";
import { DEFINITIONS, normalizeResource } from "./finance-model";

interface Participant {
  [field: string]: unknown;
  name?: OptionalText;
  documentNumber?: { value?: OptionalText } | null | undefined;
}

interface ConnectorDetails {
  id?: OptionalScalar;
  name?: OptionalText;
  products?: string[] | null | undefined;
  isOpenFinance?: boolean | null | undefined;
  isSandbox?: boolean | null | undefined;
}

export interface ProviderRecord {
  [field: string]: unknown;
  id?: string | number | null | undefined;
  resourceId?: OptionalText;
  itemId?: OptionalText;
  accountId?: OptionalText;
  investmentId?: OptionalText;
  type?: OptionalText;
  status?: OptionalText;
  executionStatus?: OptionalText;
  lastUpdatedAt?: OptionalText;
  consentExpiresAt?: OptionalText;
  products?: string[] | null | undefined;
  resourcesCollectedAt?: JsonValue | undefined;
  connector?: (ConnectorDetails & Record<string, unknown>) | null | undefined;
  name?: OptionalText;
  currencyCode?: OptionalText;
  date?: OptionalText;
  amount?: MoneyInput;
  description?: OptionalText;
  operationType?: OptionalText;
  category?: OptionalText;
  categoryId?: OptionalText;
  taxNumber?: OptionalText;
  url?: OptionalText;
  updatedAt?: OptionalText;
  createdAt?: OptionalText;
  updateDateTime?: OptionalText;
  balance?: MoneyInput;
  availableBalance?: MoneyInput;
  automaticallyInvestedBalance?: MoneyInput;
  merchant?:
    | { [field: string]: unknown; name?: OptionalText }
    | null
    | undefined;
  creditCardMetadata?:
    | { [field: string]: unknown; billId?: OptionalText }
    | null
    | undefined;
  paymentData?:
    | {
        [field: string]: unknown;
        paymentMethod?: OptionalText;
        payer?: Participant | null | undefined;
        receiver?: Participant | null | undefined;
      }
    | null
    | undefined;
}

export interface ProviderField {
  kind: "scalar" | "decimal" | "array" | "array_scalar";
  fields?: Record<string, ProviderField>;
}

export interface ItemInfo {
  id?: OptionalScalar;
  status?: OptionalText;
  executionStatus?: OptionalText;
  products?: string[] | null | undefined;
  resourcesCollectedAt?: JsonValue | undefined;
  consentExpiresAt?: OptionalText;
  lastUpdatedAt?: OptionalText;
  statusDetail?: Record<string, JsonValue> | null | undefined;
  connector: ConnectorDetails;
}

export interface Credentials {
  clientId: string;
  clientSecret: string;
}

export interface SourceContext {
  resource: Resource;
  item: string;
  parent?: string;
  connectorId?: string | undefined;
}

export function itemInfo(raw: ProviderRecord): ItemInfo {
  const normalized = normalizeResource(Resource.connections, raw, undefined, {
    referenceDay: null,
  });

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
    item.connector.products &&
    !supportsProduct({ resource, product, products: item.connector.products })
  ) {
    return Availability.unsupported;
  }

  if (
    product &&
    item.products &&
    !supportsProduct({ resource, product, products: item.products })
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

function supportsProduct({
  resource,
  product,
  products,
}: {
  resource: Resource;
  product: string;
  products: readonly string[];
}) {
  return (
    products.includes(product) ||
    (resource === Resource.accounts && products.includes(Product.CREDIT_CARDS))
  );
}

export function assertSourceIdentity({
  id,
  expected,
}: {
  id: ProviderRecord["id"];
  expected: string | undefined;
}) {
  if (id !== expected) {
    throw new Error("SOURCE_IDENTITY_MISMATCH");
  }
}

export function assertSourceRecords({
  records,
  context,
}: {
  records: readonly ProviderRecord[];
  context: SourceContext;
}) {
  const definition = DEFINITIONS[context.resource];
  for (const record of records) {
    if (context.resource === Resource.connections) {
      assertSourceIdentity({ id: record.id, expected: context.item });
    }
    if (context.resource === Resource.connectors) {
      assertSourceIdentity({
        id: String(record.id),
        expected: context.connectorId,
      });
    }
    if (
      (record.itemId !== undefined && record.itemId !== context.item) ||
      (definition.parent === Resource.accounts &&
        record.accountId !== undefined &&
        record.accountId !== context.parent) ||
      (definition.parent === Resource.investments &&
        record.investmentId !== undefined &&
        record.investmentId !== context.parent)
    ) {
      throw new Error("SOURCE_IDENTITY_MISMATCH");
    }
  }
}

export function assertTransactionSelection({
  records,
  account,
  ids,
}: {
  records: readonly ProviderRecord[];
  account: string;
  ids: readonly string[];
}) {
  const requested = new Set(ids);
  if (
    records.some(
      (record) =>
        record.accountId !== account || !requested.has(String(record.id ?? "")),
    )
  ) {
    throw new Error("SOURCE_SELECTION_MISMATCH");
  }
}
