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
  documentNumber?: { value?: OptionalText } | null | undefined;
  name?: OptionalText;
  [field: string]: unknown;
}

interface ConnectorDetails {
  id?: OptionalScalar;
  isOpenFinance?: boolean | null | undefined;
  isSandbox?: boolean | null | undefined;
  name?: OptionalText;
  products?: string[] | null | undefined;
}

export interface ProviderRecord {
  accountId?: OptionalText;
  amount?: MoneyInput;
  automaticallyInvestedBalance?: MoneyInput;
  availableBalance?: MoneyInput;
  balance?: MoneyInput;
  category?: OptionalText;
  categoryId?: OptionalText;
  connector?: (ConnectorDetails & Record<string, unknown>) | null | undefined;
  consentExpiresAt?: OptionalText;
  createdAt?: OptionalText;
  creditCardMetadata?:
    | { [field: string]: unknown; billId?: OptionalText }
    | null
    | undefined;
  currencyCode?: OptionalText;
  date?: OptionalText;
  description?: OptionalText;
  executionStatus?: OptionalText;
  id?: string | number | null | undefined;
  investmentId?: OptionalText;
  itemId?: OptionalText;
  lastUpdatedAt?: OptionalText;
  merchant?:
    | { [field: string]: unknown; name?: OptionalText }
    | null
    | undefined;
  name?: OptionalText;
  operationType?: OptionalText;
  paymentData?:
    | {
        [field: string]: unknown;
        paymentMethod?: OptionalText;
        payer?: Participant | null | undefined;
        receiver?: Participant | null | undefined;
      }
    | null
    | undefined;
  products?: string[] | null | undefined;
  resourceId?: OptionalText;
  resourcesCollectedAt?: JsonValue | undefined;
  status?: OptionalText;
  taxNumber?: OptionalText;
  type?: OptionalText;
  updateDateTime?: OptionalText;
  updatedAt?: OptionalText;
  url?: OptionalText;
  [field: string]: unknown;
}

export interface ProviderField {
  fields?: Record<string, ProviderField>;
  kind: "scalar" | "decimal" | "array" | "array_scalar";
}

export interface ItemInfo {
  connector: ConnectorDetails;
  consentExpiresAt?: OptionalText;
  executionStatus?: OptionalText;
  id?: OptionalScalar;
  lastUpdatedAt?: OptionalText;
  products?: string[] | null | undefined;
  resourcesCollectedAt?: JsonValue | undefined;
  status?: OptionalText;
  statusDetail?: Record<string, JsonValue> | null | undefined;
}

export interface Credentials {
  clientId: string;
  clientSecret: string;
}

export interface SourceContext {
  connectorId?: string | undefined;
  item: string;
  parent?: string;
  resource: Resource;
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
    connector: {
      id: raw.connector?.id ?? null,
      isOpenFinance: raw.connector?.isOpenFinance ?? null,
      isSandbox: raw.connector?.isSandbox ?? null,
      name: raw.connector?.name ?? null,
      products: raw.connector?.products ?? null,
    },
    consentExpiresAt: raw.consentExpiresAt ?? null,
    executionStatus: raw.executionStatus ?? null,
    id: raw.id,
    lastUpdatedAt: raw.lastUpdatedAt ?? null,
    products: raw.products ?? null,
    resourcesCollectedAt: raw.resourcesCollectedAt ?? null,
    status: raw.status ?? null,
    statusDetail,
  };
}

export function productState(
  resource: Resource,
  item: ItemInfo,
  consents: FinanceRecord[],
  now: number,
) {
  const { product } = DEFINITIONS[resource];

  if (
    resource === Resource.resources &&
    item.connector.isOpenFinance === false
  ) {
    return Availability.unsupported;
  }

  if (
    product &&
    item.connector.products &&
    !supportsProduct({ product, products: item.connector.products, resource })
  ) {
    return Availability.unsupported;
  }

  if (
    product &&
    item.products &&
    !supportsProduct({ product, products: item.products, resource })
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
      assertSourceIdentity({ expected: context.item, id: record.id });
    }
    if (context.resource === Resource.connectors) {
      assertSourceIdentity({
        expected: context.connectorId,
        id: String(record.id),
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
