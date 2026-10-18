import type {
  Classification,
  ProvenanceOrigin,
  Resource,
} from "#domain/enums.ts";
import type { JsonValue } from "#shared/json.types.ts";

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
