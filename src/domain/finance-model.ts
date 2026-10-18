import { z } from "zod/v4";

import type { JsonValue } from "@/shared/json.types";

import {
  AccountType,
  Classification,
  FaultCode,
  PaymentMethod,
  Product,
  ProvenanceOrigin,
  Resource,
  TransactionStatus,
  TransactionType,
} from "./enums";
import {
  accountingDay,
  assertMinor,
  decimal,
  fail,
  id,
  isMatureDate,
  localDay,
  minor,
} from "./exact";
import { Fault } from "./fault.entity";
import type {
  FinanceRecord,
  MetricDefinition,
  ResourceDefinition,
} from "./finance.entity";
import type { ProviderField, ProviderRecord } from "./provider.entity";
import providerFields from "./provider-fields";
import { parseDomain } from "./validation";

const documentNumberPattern = /^[\d./-]+$/;
const nonDigitPattern = /\D/g;

const providerMap: Record<
  Resource,
  Record<string, ProviderField>
> = providerFields;

const FLOW: Resource[] = [
  Resource.transactions,
  Resource.investment_transactions,
];

export const DEFINITIONS: Record<Resource, ResourceDefinition> = {
  accounts: {
    defaults: [
      "id",
      "name",
      "type",
      "subtype",
      "currencyCode",
      "balance",
      "bankData.automaticallyInvestedBalance",
      "updatedAt",
    ],
    product: Product.ACCOUNTS,
  },
  bills: {
    defaults: [
      "id",
      "accountId",
      "dueDate",
      "billClosingDate",
      "totalAmount",
      "totalAmountCurrencyCode",
      "minimumPaymentAmount",
      "allowsInstallments",
    ],
    parent: Resource.accounts,
    product: Product.CREDIT_CARDS,
  },
  categories: {
    defaults: ["id", "description", "parentId", "parentDescription"],
    product: null,
  },
  connections: {
    defaults: [
      "id",
      "status",
      "executionStatus",
      "lastUpdatedAt",
      "connector.name",
      "connector.isOpenFinance",
      "connector.isSandbox",
      "products",
      "resourcesCollectedAt",
      "consentExpiresAt",
    ],
    product: null,
  },
  connectors: {
    defaults: ["id", "name", "products", "isOpenFinance", "isSandbox"],
    product: null,
  },
  consents: {
    defaults: [
      "id",
      "products",
      "openFinancePermissionsGranted",
      "expiresAt",
      "revokedAt",
    ],
    product: null,
  },
  identity: {
    defaults: ["id", "documentType", "investorProfile", "updatedAt"],
    product: Product.IDENTITY,
  },
  investment_transactions: {
    defaults: [
      "id",
      "investmentId",
      "date",
      "tradeDate",
      "type",
      "movementType",
      "currencyCode",
      "amount",
      "netAmount",
      "quantity",
      "value",
    ],
    parent: Resource.investments,
    product: Product.INVESTMENTS_TRANSACTIONS,
  },
  investments: {
    defaults: [
      "id",
      "name",
      "type",
      "subtype",
      "currencyCode",
      "balance",
      "amount",
      "amountWithdrawal",
      "amountOriginal",
      "amountProfit",
      "date",
      "dueDate",
      "status",
      "institution.name",
    ],
    product: Product.INVESTMENTS,
  },
  loans: {
    defaults: [
      "id",
      "productName",
      "kind",
      "type",
      "currencyCode",
      "date",
      "contractAmount",
      "payments.contractOutstandingBalance",
      "dueDate",
    ],
    product: Product.LOANS,
  },
  resources: {
    defaults: ["id", "resourceId", "type", "status"],
    product: null,
  },
  statements: {
    defaults: ["id", "accountId", "monthYear", "documentAccess"],
    parent: Resource.accounts,
    product: Product.ACCOUNTS,
  },
  transactions: {
    defaults: [
      "id",
      "accountId",
      "accountType",
      "date",
      "accountingDate",
      "description",
      "currencyCode",
      "amount",
      "type",
      "status",
      "category",
      "operationType",
      "classification",
    ],
    parent: Resource.accounts,
    product: Product.TRANSACTIONS,
  },
};

const MONEY: Partial<Record<Resource, string[]>> = {
  accounts: [
    "balance",
    "bankData.closingBalance",
    "bankData.automaticallyInvestedBalance",
    "bankData.overdraftContractedLimit",
    "bankData.overdraftUsedLimit",
    "bankData.unarrangedOverdraftAmount",
    "creditData.availableCreditLimit",
    "creditData.creditLimit",
    "creditData.minimumPayment",
    "creditData.balanceForeignCurrency",
  ],
  bills: ["totalAmount", "minimumPaymentAmount"],
  investment_transactions: ["amount", "netAmount"],
  investments: [
    "balance",
    "amount",
    "amountOriginal",
    "amountProfit",
    "amountWithdrawal",
    "taxes",
    "taxes2",
  ],
  loans: ["contractAmount", "payments.contractOutstandingBalance"],
  transactions: ["amount", "balance"],
};

const derived: Partial<Record<Resource, string[]>> = {
  bills: ["accountId"],
  investment_transactions: ["investmentId", "currencyCode", "accountingDate"],
  resources: ["id"],
  statements: ["accountId", "documentAccess"],
  transactions: [
    "accountType",
    "accountingDate",
    "timestampLocalDate",
    "absoluteAmountMinor",
    "counterparty",
    "classification",
    "classificationEvidence",
    "signedFlowMinor",
    "knownConsumptionMinor",
    "unclassifiedDebitMinor",
    "ownTransferEvidence",
    "billId",
    "paymentMethod",
  ],
};

const interpretations: Record<string, string> = {
  amount:
    "Reported gross amount; transactions retain provider sign. Not economic spending.",
  amountOriginal: "Originally invested capital; not current balance.",
  amountProfit: "Profit reported by provider; no inferred return.",
  amountWithdrawal: "Reported withdrawable investment amount, no fallback.",
  balance:
    "Reported balance; account BANK available balance, CREDIT credit used. Investment net position, not immediate liquidity.",
  contractAmount: "Originally contracted credit; not current debt.",
  "payments.contractOutstandingBalance": "Reported outstanding debt.",
};

export function metricsFor(
  resource: Resource,
): Record<string, MetricDefinition> {
  return {
    count: {
      description:
        "Count filtered records, including pending and unknown status.",
      temporal: "snapshot",
      unit: "records",
    },
    ...Object.fromEntries(
      (MONEY[resource] ?? []).map((f) => [
        f,
        {
          description:
            resource === Resource.transactions && f === "amount"
              ? "Gross movement magnitude of posted transactions, independent of bank/card amount sign. Filter type for CREDIT/DEBIT. Not spending."
              : (interpretations[f] ??
                "Separate provider measure, never added to another measure."),
          field:
            resource === Resource.transactions && f === "amount"
              ? "absoluteAmountMinor"
              : `${f}Minor`,
          temporal: FLOW.includes(resource) ? "flow" : "stock",
          unit: "currency_minor",
        },
      ]),
    ),
    ...(resource === Resource.transactions && {
      cashFlow: {
        description:
          "Posted BANK signed CREDIT minus DEBIT, includes patrimonial and own-transfer flows.",
        field: "signedFlowMinor",
        temporal: "flow",
        unit: "currency_minor",
      },
      consumption_v1: {
        description:
          "Conservative subtotal of posted debits with purchase/category evidence. Excludes bill payments, own transfers and patrimonial movements; unresolved debits reported separately. Credits/refunds not netted.",
        field: "knownConsumptionMinor",
        temporal: "flow",
        unit: "currency_minor",
      },
      unclassifiedDebits: {
        description:
          "Posted debit subtotal without sufficient consumption classification.",
        field: "unclassifiedDebitMinor",
        temporal: "flow",
        unit: "currency_minor",
      },
    }),
  };
}

export function metricFor({
  resource,
  metric,
}: {
  resource: Resource;
  metric: string | undefined;
}) {
  if (!metric) {
    return;
  }
  const definition = new Map(Object.entries(metricsFor(resource))).get(metric);
  if (!definition) {
    throw new Error("UNKNOWN_METRIC");
  }
  return definition;
}

export function providerFieldValue(obj: unknown, path: string): unknown {
  let value = obj;

  for (const key of path.split(".")) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return undefined;
    }
    value = Reflect.get(value, key);
  }

  return value;
}

function project(raw: unknown, spec: Record<string, ProviderField>) {
  const result: Record<string, JsonValue> = {};

  for (const [path, s] of Object.entries(spec)) {
    const v = providerFieldValue(raw, path);

    if (v === undefined) {
      continue;
    }

    result[path] = projectValue(v, s);
  }

  return result;
}

const decimalInput = z.union([z.string(), z.number()]);

const fieldProjectors: Record<
  ProviderField["kind"],
  (value: unknown, spec: ProviderField) => JsonValue
> = {
  array(value, spec) {
    if (!Array.isArray(value) || value.length > 2000) {
      fail(FaultCode.INVALID_RESPONSE);
    }
    return value.map((entry: unknown) => project(entry, spec.fields ?? {}));
  },
  array_scalar(value) {
    if (
      !Array.isArray(value) ||
      value.length > 2000 ||
      !value.every(
        (entry: unknown): entry is string | boolean =>
          typeof entry === "string" || typeof entry === "boolean",
      )
    ) {
      fail(FaultCode.INVALID_RESPONSE);
    }
    return [...value];
  },
  decimal(value) {
    return decimal(
      parseDomain(decimalInput, value, FaultCode.INVALID_RESPONSE),
    );
  },
  scalar(value) {
    if (
      typeof value !== "string" &&
      typeof value !== "number" &&
      typeof value !== "boolean"
    ) {
      fail(FaultCode.INVALID_RESPONSE);
    }
    if (typeof value === "number" && !Number.isFinite(value)) {
      fail(FaultCode.INVALID_RESPONSE);
    }
    if (typeof value === "string" && value.length > 4000) {
      fail(FaultCode.FIELD_TOO_LARGE);
    }
    return value;
  },
};

function projectValue(value: unknown, spec: ProviderField): JsonValue {
  if (value === null) {
    return null;
  }
  return fieldProjectors[spec.kind](value, spec);
}

export function normalizeResource(
  resource: Resource,
  raw: ProviderRecord,
  parent: FinanceRecord | undefined,
  context: { referenceDay: string | null },
) {
  if (resource === Resource.transactions && !context.referenceDay) {
    throw new Error("REFERENCE_DAY_REQUIRED");
  }

  const projected = project(raw, providerMap[resource]);

  const r: FinanceRecord = {
    ...projected,
    id: normalizedId(resource, raw, projected),
  };

  if (parent) {
    if (resource === Resource.investment_transactions) {
      r.investmentId = parent.id;
      r.currencyCode = parent.currencyCode;
    } else {
      r.accountId = parent.id;
    }
  }

  if (resource === Resource.statements) {
    r.documentAccess = "authorized_download_requires_fresh_link";
  }
  normalizeMoney(resource, r);

  if (FLOW.includes(resource)) {
    r.accountingDate = accountingDay(r.date);
  }

  if (resource === Resource.transactions) {
    normalizeTransaction(r, raw, parent, context);
  }

  r.provenance = Object.fromEntries(
    Object.keys(r)
      .filter((k) => k !== "provenance")
      .map((k) => [
        k,
        {
          origin: provenanceOrigin(resource, k),
          sourceField: k.endsWith("Minor") ? k.slice(0, -5) : k,
        },
      ]),
  );

  return r;
}

function isOneOf<const T>(value: unknown, values: readonly T[]): value is T {
  return values.some((candidate) => candidate === value);
}

function normalizedId(
  resource: Resource,
  raw: ProviderRecord,
  projected: Record<string, JsonValue>,
) {
  if (resource === Resource.resources) {
    return id(raw.resourceId);
  }

  if (resource === Resource.connectors) {
    return id(String(raw.id));
  }

  return id(projected.id);
}

function normalizeMoney(resource: Resource, r: FinanceRecord) {
  const currency = r.currencyCode ?? r.totalAmountCurrencyCode;

  for (const field of MONEY[resource] ?? []) {
    if (!(field in r) || r[field] === null) {
      continue;
    }
    try {
      const amountMinor = minor(
        parseDomain(
          z.union([z.string(), z.number()]),
          r[field],
          FaultCode.INVALID_RESPONSE,
        ),
        field === "creditData.balanceForeignCurrency"
          ? "USD"
          : parseDomain(
              z.string(),
              currency,
              FaultCode.CURRENCY_SCALE_UNSUPPORTED,
            ),
      );
      if (amountMinor !== null) {
        assertMinor(amountMinor);
      }
      r[`${field}Minor`] = amountMinor;
    } catch (e) {
      if (
        e instanceof Fault &&
        isOneOf(e.code, [
          FaultCode.MONEY_PRECISION_UNSUPPORTED,
          FaultCode.CURRENCY_SCALE_UNSUPPORTED,
        ])
      ) {
        r[`${field}Minor`] = null;
        r.precisionWarnings ??= [];
        r.precisionWarnings.push({ code: e.code, field });
      } else {
        throw e;
      }
    }
  }
}

function absoluteMinor(value: string | null | undefined) {
  if (value === null || value === undefined) {
    return null;
  }
  const amount = BigInt(value);

  return amount < 0n ? -amount : amount;
}

function normalizeTransaction(
  r: FinanceRecord,
  raw: ProviderRecord,
  parent: FinanceRecord | undefined,
  context: { referenceDay: string | null },
) {
  if (!parent || raw.accountId !== parent.id) {
    fail(FaultCode.PARENT_MISMATCH);
  }
  r.accountType = parent.type;
  r.timestampLocalDate = Number.isFinite(Date.parse(raw.date ?? ""))
    ? localDay(new Date(raw.date ?? ""))
    : null;
  r.absoluteAmountMinor = absoluteMinor(r.amountMinor)?.toString() ?? null;
  r.billId = raw.creditCardMetadata?.billId ?? null;
  r.paymentMethod = raw.paymentData?.paymentMethod ?? null;
  r.counterparty = transactionCounterparty(raw);

  classifyTransaction(r, raw, parent);
  applyTransactionAmounts(r, raw, parent, context.referenceDay);
}

const operationClassifications = new Map<
  string,
  { classification: Classification; evidence: string }
>([
  [
    "PAGAMENTO_FATURA",
    {
      classification: Classification.bill_payment,
      evidence:
        "operationType=PAGAMENTO_FATURA (institution or Pluggy synthesized bill payment)",
    },
  ],
  [
    "ESTORNO",
    {
      classification: Classification.refund,
      evidence: "operationType=ESTORNO",
    },
  ],
  [
    "CASHBACK",
    {
      classification: Classification.refund,
      evidence: "operationType=CASHBACK",
    },
  ],
]);

const categoryClassifications = [
  {
    categories: new Set(["Credit card payment"]),
    classification: Classification.bill_payment_category,
    evidence:
      "Pluggy category: Credit card payment; classification may be corrected",
  },
  {
    categories: new Set([
      "Same person transfer",
      "Investments",
      "Automatic investment",
      "Fixed income",
      "Fixed Income Investment",
      "Mutual funds",
      "Variable income",
      "Pension",
    ]),
    classification: Classification.patrimonial_category,
    evidence:
      "Pluggy category hierarchy; not independently proven economic purpose",
  },
  {
    categories: new Set([
      "Transfers",
      "Transfer - PIX",
      "Transfer - TED",
      "Transfer - DOC",
      "Cash withdrawal",
    ]),
    classification: Classification.transfer_uncertain,
    evidence:
      "Payment method or transfer category; ownership/economic purpose unknown",
  },
];

function classifyTransaction(
  r: FinanceRecord,
  raw: ProviderRecord,
  parent: FinanceRecord,
) {
  const doc = (x: unknown) =>
    typeof x === "string" &&
    documentNumberPattern.test(x) &&
    isOneOf(x.replace(nonDigitPattern, "").length, [11, 14])
      ? x.replace(nonDigitPattern, "")
      : null;

  const payer = doc(raw.paymentData?.payer?.documentNumber?.value),
    receiver = doc(raw.paymentData?.receiver?.documentNumber?.value),
    { ownerDocument: owner } = parent;

  r.ownTransferEvidence = !!(owner && payer === owner && receiver === owner);

  const { classification, evidence } = transactionClassification(
    raw,
    parent,
    r,
  );
  r.classification = classification;
  r.classificationEvidence = evidence;
}

function transactionClassification(
  raw: ProviderRecord,
  parent: FinanceRecord,
  r: FinanceRecord,
) {
  // Holder documents take precedence over explicit operations, categories and merchant evidence.
  if (r.ownTransferEvidence) {
    return {
      classification: Classification.own_transfer,
      evidence: [
        "paymentData participant documents equal authenticated account holder document",
      ],
    };
  }
  const operation = operationClassifications.get(raw.operationType ?? "");
  if (operation) {
    return {
      classification: operation.classification,
      evidence: [operation.evidence],
    };
  }
  return classifyCategory(raw, parent, r);
}

function classifyCategory(
  raw: ProviderRecord,
  parent: FinanceRecord,
  r: FinanceRecord,
) {
  const category = categoryClassifications.find(({ categories }) =>
    categories.has(raw.category ?? ""),
  );
  if (category) {
    return {
      classification: category.classification,
      evidence: [category.evidence],
    };
  }
  if (
    isOneOf(r.paymentMethod ?? "", [
      PaymentMethod.PIX,
      PaymentMethod.TED,
      PaymentMethod.DOC,
      PaymentMethod.TEV,
      PaymentMethod.BOLETO,
    ]) ||
    isOneOf(raw.operationType ?? "", [
      PaymentMethod.PIX,
      PaymentMethod.TED,
      PaymentMethod.DOC,
      PaymentMethod.TEV,
    ])
  ) {
    return {
      classification: Classification.transfer_uncertain,
      evidence: [
        "Payment method or transfer category; ownership/economic purpose unknown",
      ],
    };
  }
  if (
    raw.type === TransactionType.DEBIT &&
    (parent.type === TransactionType.CREDIT || raw.merchant?.name)
  ) {
    return {
      classification: Classification.consumption_evidence,
      evidence: [
        parent.type === TransactionType.CREDIT
          ? "credit account DEBIT"
          : "Pluggy merchant/category evidence",
      ],
    };
  }

  return { classification: Classification.unknown, evidence: [] };
}

function applyTransactionAmounts(
  r: FinanceRecord,
  raw: ProviderRecord,
  parent: FinanceRecord,
  referenceDay: string | null,
) {
  const valid =
    raw.status === TransactionStatus.POSTED &&
    r.accountingDate &&
    isMatureDate({ date: r.accountingDate, referenceDay }) &&
    isOneOf(raw.type ?? "", [TransactionType.CREDIT, TransactionType.DEBIT]) &&
    r.amountMinor !== null &&
    r.amountMinor !== undefined;

  const abs = absoluteMinor(r.amountMinor);
  const { classification: cls } = r;

  r.signedFlowMinor =
    valid && parent.type === AccountType.BANK
      ? (raw.type === TransactionType.CREDIT
          ? (abs ?? 0n)
          : -(abs ?? 0n)
        ).toString()
      : null;
  r.knownConsumptionMinor =
    valid &&
    raw.type === TransactionType.DEBIT &&
    cls === Classification.consumption_evidence
      ? (abs ?? 0n).toString()
      : null;
  r.unclassifiedDebitMinor =
    valid &&
    raw.type === TransactionType.DEBIT &&
    isOneOf(cls, [Classification.unknown, Classification.transfer_uncertain])
      ? (abs ?? 0n).toString()
      : null;
}

function provenanceOrigin(resource: Resource, field: string) {
  if ((derived[resource] ?? []).includes(field) || field.endsWith("Minor")) {
    return ProvenanceOrigin.local_derivation;
  }

  if (
    isOneOf(field, [
      "description",
      "category",
      "categoryId",
      "merchant.name",
      "merchant.businessName",
      "merchant.cnae",
      "merchant.category",
    ])
  ) {
    return ProvenanceOrigin.pluggy_enrichment;
  }

  return ProvenanceOrigin.provider_via_pluggy;
}

function transactionCounterparty(raw: ProviderRecord) {
  if (raw.type === TransactionType.DEBIT) {
    return raw.paymentData?.receiver?.name ?? raw.merchant?.name ?? null;
  }

  return raw.paymentData?.payer?.name ?? null;
}
