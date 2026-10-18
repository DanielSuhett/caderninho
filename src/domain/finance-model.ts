import { z } from "zod/v4";

import {
  Product,
  TransactionType,
  PaymentMethod,
  TransactionStatus,
  AccountType,
  ProvenanceOrigin,
  ResourceSchema,
  FaultCode,
  Resource,
  Classification,
} from "#domain/enums.ts";
import {
  decimal,
  minor,
  accountingDay,
  localDay,
  fail,
  id,
} from "#domain/exact.ts";
import { Fault, parseDomain } from "#domain/fault.ts";
import providerFields from "#domain/provider-fields.json" with { type: "json" };
import {
  ProviderFieldSchema,
  ProviderRecordSchema,
  FinanceRecordSchema,
  type FinanceRecord,
  type ProviderField,
  type ResourceDefinition,
  type MetricDefinition,
} from "#domain/schemas.ts";
import type { JsonValue } from "#shared/json.ts";

const providerMap = parseDomain(
  z.record(ResourceSchema, z.record(z.string(), ProviderFieldSchema)),
  providerFields,
  FaultCode.INVALID_RESPONSE,
);

export const RESOURCES = ResourceSchema.options;

export const FLOW: Resource[] = [
  Resource.transactions,
  Resource.investment_transactions,
];

export const DEFINITIONS: Record<Resource, ResourceDefinition> = {
  connections: {
    product: null,
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
  },
  resources: {
    product: null,
    defaults: ["id", "resourceId", "type", "status"],
  },
  connectors: {
    product: null,
    defaults: ["id", "name", "products", "isOpenFinance", "isSandbox"],
  },
  consents: {
    product: null,
    defaults: [
      "id",
      "products",
      "openFinancePermissionsGranted",
      "expiresAt",
      "revokedAt",
    ],
  },
  accounts: {
    product: Product.ACCOUNTS,
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
  },
  transactions: {
    product: Product.TRANSACTIONS,
    parent: Resource.accounts,
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
  },
  investments: {
    product: Product.INVESTMENTS,
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
  },
  investment_transactions: {
    product: Product.INVESTMENTS_TRANSACTIONS,
    parent: Resource.investments,
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
  },
  bills: {
    product: Product.CREDIT_CARDS,
    parent: Resource.accounts,
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
  },
  loans: {
    product: Product.LOANS,
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
  },
  identity: {
    product: Product.IDENTITY,
    defaults: ["id", "documentType", "investorProfile", "updatedAt"],
  },
  categories: {
    product: null,
    defaults: ["id", "description", "parentId", "parentDescription"],
  },
  statements: {
    parent: Resource.accounts,
    product: Product.ACCOUNTS,
    defaults: ["id", "accountId", "monthYear", "documentAccess"],
  },
};

export const MONEY: Partial<Record<Resource, string[]>> = {
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
  transactions: ["amount", "balance"],
  investments: [
    "balance",
    "amount",
    "amountOriginal",
    "amountProfit",
    "amountWithdrawal",
    "taxes",
    "taxes2",
  ],
  investment_transactions: ["amount", "netAmount"],
  bills: ["totalAmount", "minimumPaymentAmount"],
  loans: ["contractAmount", "payments.contractOutstandingBalance"],
};

const derived: Partial<Record<Resource, string[]>> = {
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
  investment_transactions: ["investmentId", "currencyCode", "accountingDate"],
  bills: ["accountId"],
  statements: ["accountId", "documentAccess"],
  resources: ["id"],
};

const interpretations: Record<string, string> = {
  balance:
    "Reported balance; account BANK available balance, CREDIT credit used. Investment net position, not immediate liquidity.",
  amount:
    "Reported gross amount; transactions retain provider sign. Not economic spending.",
  amountWithdrawal: "Reported withdrawable investment amount, no fallback.",
  amountOriginal: "Originally invested capital; not current balance.",
  amountProfit: "Profit reported by provider; no inferred return.",
  contractAmount: "Originally contracted credit; not current debt.",
  "payments.contractOutstandingBalance": "Reported outstanding debt.",
};

export function metricsFor(
  resource: Resource,
): Record<string, MetricDefinition> {
  return {
    count: {
      unit: "records",
      temporal: "snapshot",
      description:
        "Count filtered records, including pending and unknown status.",
    },
    ...Object.fromEntries(
      (MONEY[resource] ?? []).map((f) => [
        f,
        {
          field:
            resource === Resource.transactions && f === "amount"
              ? "absoluteAmountMinor"
              : f + "Minor",
          unit: "currency_minor",
          temporal: FLOW.includes(resource) ? "flow" : "stock",
          description:
            resource === Resource.transactions && f === "amount"
              ? "Gross movement magnitude of posted transactions, independent of bank/card amount sign. Filter type for CREDIT/DEBIT. Not spending."
              : (interpretations[f] ??
                "Separate provider measure, never added to another measure."),
        },
      ]),
    ),
    ...(resource === Resource.transactions
      ? {
          cashFlow: {
            field: "signedFlowMinor",
            unit: "currency_minor",
            temporal: "flow",
            description:
              "Posted BANK signed CREDIT minus DEBIT, includes patrimonial and own-transfer flows.",
          },
          consumption_v1: {
            field: "knownConsumptionMinor",
            unit: "currency_minor",
            temporal: "flow",
            description:
              "Conservative subtotal of posted debits with purchase/category evidence. Excludes bill payments, own transfers and patrimonial movements; unresolved debits reported separately. Credits/refunds not netted.",
          },
          unclassifiedDebits: {
            field: "unclassifiedDebitMinor",
            unit: "currency_minor",
            temporal: "flow",
            description:
              "Posted debit subtotal without sufficient consumption classification.",
          },
        }
      : {}),
  };
}

function at(obj: unknown, path: string): unknown {
  let value = obj;

  for (const key of path.split(".")) {
    const container = z.record(z.string(), z.unknown()).safeParse(value);

    if (!container.success) return undefined;
    value = container.data[key];
  }

  return value;
}

function project(raw: unknown, spec: Record<string, ProviderField>) {
  const result: Record<string, JsonValue> = {};

  for (const [path, s] of Object.entries(spec)) {
    const v = at(raw, path);

    if (v === undefined) continue;

    if (v === null) {
      result[path] = null;
      continue;
    }

    if (s.kind === "decimal")
      result[path] = decimal(
        parseDomain(
          z.union([z.string(), z.number()]),
          v,
          FaultCode.INVALID_RESPONSE,
        ),
      );
    else if (s.kind === "array") {
      if (!Array.isArray(v) || v.length > 2000)
        fail(FaultCode.INVALID_RESPONSE);
      result[path] = v.map((x) => project(x, s.fields ?? {}));
    } else if (s.kind === "array_scalar") {
      if (
        !Array.isArray(v) ||
        v.length > 2000 ||
        v.some((x) => typeof x !== "string" && typeof x !== "boolean")
      )
        fail(FaultCode.INVALID_RESPONSE);
      result[path] = parseDomain(z.json(), v, FaultCode.INVALID_RESPONSE);
    } else {
      if (!isOneOf(typeof v, ["string", "number", "boolean"]))
        fail(FaultCode.INVALID_RESPONSE);

      if (typeof v === "string" && v.length > 4000)
        fail(FaultCode.FIELD_TOO_LARGE);
      result[path] = parseDomain(z.json(), v, FaultCode.INVALID_RESPONSE);
    }
  }

  return result;
}

export function normalizeResource(
  resource: Resource,
  input: unknown,
  parent: FinanceRecord | null | undefined,
  context: { categories?: FinanceRecord[]; referenceDay: string | null },
) {
  if (resource === Resource.transactions && !context.referenceDay)
    throw new Error("REFERENCE_DAY_REQUIRED");

  const raw = parseDomain(
    ProviderRecordSchema,
    input,
    FaultCode.INVALID_RESPONSE,
  );

  const projected = project(raw, providerMap[resource]);

  const r: FinanceRecord = FinanceRecordSchema.parse({
    ...projected,
    id: id(
      resource === Resource.resources
        ? raw.resourceId
        : resource === Resource.connectors
          ? String(raw.id)
          : projected.id,
    ),
  });

  if (resource === Resource.resources) r.id = id(raw.resourceId);

  if (resource === Resource.connectors) r.id = String(raw.id);
  id(r.id);

  if (parent) {
    if (resource === Resource.investment_transactions) {
      r.investmentId = parent.id;
      r.currencyCode = parent.currencyCode;
    } else r.accountId = parent.id;
  }

  if (resource === Resource.statements)
    r.documentAccess = "authorized_download_requires_fresh_link";
  const currency = r.currencyCode ?? r.totalAmountCurrencyCode;

  for (const field of MONEY[resource] ?? [])
    if (field in r && r[field] !== null) {
      try {
        r[field + "Minor"] = minor(
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
      } catch (e) {
        if (
          e instanceof Fault &&
          isOneOf(e.code, [
            FaultCode.MONEY_PRECISION_UNSUPPORTED,
            FaultCode.CURRENCY_SCALE_UNSUPPORTED,
          ])
        ) {
          r[field + "Minor"] = null;
          r.precisionWarnings ??= [];
          r.precisionWarnings.push({ field, code: e.code });
        } else throw e;
      }
    }

  if (FLOW.includes(resource)) r.accountingDate = accountingDay(r.date);

  if (resource === Resource.transactions) {
    if (raw.accountId !== parent?.id) fail(FaultCode.PARENT_MISMATCH);

    if (!parent) fail(FaultCode.PARENT_MISMATCH);
    r.accountType = parent.type;
    r.timestampLocalDate = Number.isFinite(Date.parse(raw.date ?? ""))
      ? localDay(new Date(raw.date ?? ""))
      : null;
    r.absoluteAmountMinor =
      r.amountMinor == null
        ? null
        : (BigInt(r.amountMinor) < 0n
            ? -BigInt(r.amountMinor)
            : BigInt(r.amountMinor)
          ).toString();
    r.billId = raw.creditCardMetadata?.billId ?? null;
    r.paymentMethod = raw.paymentData?.paymentMethod ?? null;
    r.counterparty =
      raw.type === TransactionType.DEBIT
        ? (raw.paymentData?.receiver?.name ?? raw.merchant?.name ?? null)
        : (raw.paymentData?.payer?.name ?? null);

    const doc = (x: unknown) =>
      typeof x === "string" &&
      /^[\d./-]+$/.test(x) &&
      isOneOf(x.replace(/\D/g, "").length, [11, 14])
        ? x.replace(/\D/g, "")
        : null;

    const payer = doc(raw.paymentData?.payer?.documentNumber?.value),
      receiver = doc(raw.paymentData?.receiver?.documentNumber?.value),
      owner = parent.ownerDocument;

    r.ownTransferEvidence = !!(owner && payer === owner && receiver === owner);

    let cls: Classification = Classification.unknown,
      evidence: string[] = [];

    if (r.ownTransferEvidence) {
      cls = Classification.own_transfer;
      evidence = [
        "paymentData participant documents equal authenticated account holder document",
      ];
    } else if (raw.operationType === "PAGAMENTO_FATURA") {
      cls = Classification.bill_payment;
      evidence = [
        "operationType=PAGAMENTO_FATURA (institution or Pluggy synthesized bill payment)",
      ];
    } else if (isOneOf(raw.operationType ?? "", ["ESTORNO", "CASHBACK"])) {
      cls = Classification.refund;
      evidence = ["operationType=" + raw.operationType];
    } else {
      const category = context.categories?.find((c) => c.id === raw.categoryId);

      const names = [
        raw.category,
        category?.description,
        category?.parentDescription,
      ];

      if (names.includes("Credit card payment")) {
        cls = Classification.bill_payment_category;
        evidence = [
          "Pluggy category: Credit card payment; classification may be corrected",
        ];
      } else if (
        names.some((x) =>
          isOneOf(x ?? "", [
            "Same person transfer",
            "Investments",
            "Automatic investment",
            "Fixed income",
            "Fixed Income Investment",
            "Mutual funds",
            "Variable income",
            "Pension",
          ]),
        )
      ) {
        cls = Classification.patrimonial_category;
        evidence = [
          "Pluggy category hierarchy; not independently proven economic purpose",
        ];
      } else if (
        names.some((x) =>
          isOneOf(x ?? "", [
            "Transfers",
            "Transfer - PIX",
            "Transfer - TED",
            "Transfer - DOC",
            "Cash withdrawal",
          ]),
        ) ||
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
        cls = Classification.transfer_uncertain;
        evidence = [
          "Payment method or transfer category; ownership/economic purpose unknown",
        ];
      } else if (
        raw.type === TransactionType.DEBIT &&
        (parent.type === TransactionType.CREDIT ||
          raw.merchant?.name ||
          (category?.parentDescription &&
            !isOneOf(category.parentDescription, [
              "Income",
              "Other",
              "Others",
              "Transfers",
              "Investments",
              "Same person transfer",
            ])))
      ) {
        cls = Classification.consumption_evidence;
        evidence = [
          parent.type === TransactionType.CREDIT
            ? "credit account DEBIT"
            : "Pluggy merchant/category evidence",
        ];
      }
    }

    r.classification = cls;
    r.classificationEvidence = evidence;

    const valid =
      raw.status === TransactionStatus.POSTED &&
      r.accountingDate &&
      context.referenceDay !== null &&
      r.accountingDate <= context.referenceDay &&
      isOneOf(raw.type ?? "", [
        TransactionType.CREDIT,
        TransactionType.DEBIT,
      ]) &&
      r.amountMinor != null;

    const abs =
      r.amountMinor == null
        ? null
        : BigInt(r.amountMinor) < 0n
          ? -BigInt(r.amountMinor)
          : BigInt(r.amountMinor);

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
      isOneOf(cls, ["unknown", Classification.transfer_uncertain])
        ? (abs ?? 0n).toString()
        : null;
  }

  r.provenance = Object.fromEntries(
    Object.keys(r)
      .filter((k) => k !== "provenance")
      .map((k) => [
        k,
        {
          origin:
            (derived[resource] ?? []).includes(k) || k.endsWith("Minor")
              ? ProvenanceOrigin.local_derivation
              : isOneOf(k, [
                    "description",
                    "category",
                    "categoryId",
                    "merchant.name",
                    "merchant.businessName",
                    "merchant.cnae",
                    "merchant.category",
                  ])
                ? ProvenanceOrigin.pluggy_enrichment
                : ProvenanceOrigin.provider_via_pluggy,
          sourceField: k.endsWith("Minor") ? k.slice(0, -5) : k,
        },
      ]),
  );

  return r;
}

function isOneOf<const T>(value: unknown, values: readonly T[]): value is T {
  return values.some((candidate) => candidate === value);
}
