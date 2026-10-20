import { Classification, PaymentMethod, TransactionType } from "./enums";
import { accountingDay, assertMinor, minor } from "./exact";
import { Fault } from "./fault.entity";
import type {
  AccountProjection,
  TransactionProjection,
} from "./finance.entity";
import type {
  MoneyInput,
  ProviderAccount,
  ProviderTransaction,
} from "./provider.entity";

const documentNumberPattern = /^[\d./-]+$/;
const nonDigitPattern = /\D/g;
interface ClassificationContext {
  classification?: Classification;
  classificationEvidence?: string[];
  ownerDocument?: string | null;
  ownTransferEvidence?: boolean;
  paymentMethod?: string | null;
  type?: string;
}
function isOneOf<const T>(value: unknown, values: readonly T[]): value is T {
  return values.some((candidate) => candidate === value);
}
function money(value: MoneyInput, currency: string) {
  if (value === null || value === undefined) {
    return null;
  }
  try {
    const result = minor(value, currency);
    if (result !== null) {
      assertMinor(result);
    }
    return result;
  } catch (error) {
    if (
      error instanceof Fault &&
      ["CURRENCY_SCALE_UNSUPPORTED", "MONEY_PRECISION_UNSUPPORTED"].some(
        (code) => code === error.code,
      )
    ) {
      return null;
    }
    throw error;
  }
}
export function normalizeAccount(
  source: ProviderAccount,
  connectionId: string,
): AccountProjection {
  if (source.itemId !== connectionId) {
    throw new Error("SOURCE_IDENTITY_MISMATCH");
  }
  return {
    balanceMinor: money(source.balance, source.currencyCode),
    connectionId,
    currency: source.currencyCode,
    id: source.id,
    name: source.name,
    source,
    sourceUpdatedAt: source.updatedAt ?? null,
    type: source.type,
  };
}
export function normalizeTransaction(
  source: ProviderTransaction,
  account: AccountProjection,
): TransactionProjection {
  if (source.accountId !== account.id) {
    throw new Error("SOURCE_IDENTITY_MISMATCH");
  }
  const context: ClassificationContext = {
    paymentMethod: source.paymentData?.paymentMethod ?? null,
  };
  const document = account.source.taxNumber;
  classifyTransaction(context, source, {
    ownerDocument: document ? document.replace(nonDigitPattern, "") : null,
    type: account.type,
  });
  return {
    accountId: account.id,
    amountMinor: money(source.amount, source.currencyCode),
    category: source.category ?? null,
    classification: context.classification ?? Classification.unknown,
    connectionId: account.connectionId,
    currency: source.currencyCode,
    date: accountingDay(source.date) ?? "",
    description: source.description,
    direction: source.type,
    evidence: context.classificationEvidence ?? [],
    id: source.id,
    source,
    sourceUpdatedAt: source.updatedAt ?? null,
    status: source.status,
  };
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
  r: ClassificationContext,
  raw: ProviderTransaction,
  parent: ClassificationContext,
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
  raw: ProviderTransaction,
  parent: ClassificationContext,
  r: ClassificationContext,
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
  raw: ProviderTransaction,
  parent: ClassificationContext,
  r: ClassificationContext,
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
