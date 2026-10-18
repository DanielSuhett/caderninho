import type {
  MoneyInput,
  OptionalScalar,
  OptionalText,
} from "#domain/finance.types.ts";
import type { JsonValue } from "#shared/json.types.ts";

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
