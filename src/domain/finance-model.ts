import { accountingDay, assertMinor, decimal, minor } from "./exact";
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
import type { TransactionIdentification } from "./transaction.entity";

export function normalizeMoney(value: MoneyInput, currency: string) {
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
    ...(source.creditData && {
      details: {
        availableCreditMinor: normalizeMoney(
          source.creditData.availableCreditLimit,
          source.currencyCode,
        ),
        cardNumber: source.number?.replace(/\D/g, "").slice(-4) || null,
        closeDate: accountingDay(source.creditData.balanceCloseDate),
        creditLimitMinor: normalizeMoney(
          source.creditData.creditLimit,
          source.currencyCode,
        ),
        dueDate: accountingDay(source.creditData.balanceDueDate),
        id: source.id,
      },
    }),
    balanceMinor: normalizeMoney(source.balance, source.currencyCode),
    currency: source.currencyCode,
    id: source.id,
    name: source.name,
    type: source.type,
  };
}
export function normalizeTransaction(
  source: ProviderTransaction,
  accountId: string,
): TransactionProjection {
  if (source.accountId !== accountId) {
    throw new Error("SOURCE_IDENTITY_MISMATCH");
  }
  return {
    ...((source.creditCardMetadata || source.operationType) && {
      details: {
        accountId,
        billId: source.creditCardMetadata?.billId ?? null,
        cardNumber:
          source.creditCardMetadata?.cardNumber?.replace(/\D/g, "").slice(-4) ||
          null,
        id: source.id,
        installmentNumber: source.creditCardMetadata?.installmentNumber ?? null,
        operationType: source.operationType ?? null,
        purchaseDate: accountingDay(source.creditCardMetadata?.purchaseDate),
        totalInstallments: source.creditCardMetadata?.totalInstallments ?? null,
      },
    }),
    accountId,
    amountMinor: normalizeMoney(source.amount, source.currencyCode),
    category: source.category ?? null,
    currency: source.currencyCode,
    date: accountingDay(source.date) ?? "",
    description: source.description,
    direction: source.type,
    id: source.id,
    identification: normalizeIdentification(source),
    status: source.status,
  };
}

function normalizeIdentification(
  source: ProviderTransaction,
): TransactionIdentification | null {
  const {
    accountId: _accountId,
    amount: _amount,
    amountInAccountCurrency,
    balance,
    currencyCode,
    date: _date,
    description: _description,
    id: _id,
    status: _status,
    type: _type,
    creditCardMetadata: card,
    paymentData: payment,
    ...identification
  } = source;
  const result: TransactionIdentification = { ...identification };
  if (source.date.length > 10) {
    result.date = source.date;
  }
  // These amounts belong to the account currency, which may differ from the
  // transaction currency. Preserve exact decimal units without inferring a scale.
  if (amountInAccountCurrency !== undefined) {
    result.amountInAccountCurrency = decimal(amountInAccountCurrency);
  }
  if (balance !== undefined) {
    result.balance = decimal(balance);
  }
  if (card !== undefined) {
    result.creditCardMetadata = normalizeCard(card, currencyCode);
  }
  if (payment !== undefined) {
    result.paymentData = normalizePayment(payment, currencyCode);
  }
  return Object.keys(result).length ? result : null;
}

function normalizeCard(
  card: ProviderTransaction["creditCardMetadata"],
  currency: string,
) {
  if (!card) {
    return null;
  }
  const { totalAmount, payeeMCC, ...fields } = card;
  return {
    ...fields,
    ...(card.cardNumber !== undefined && {
      cardNumber: card.cardNumber?.replace(/\D/g, "").slice(-4) || null,
    }),
    ...(payeeMCC !== undefined && {
      payeeMCC: payeeMCC === null ? null : String(payeeMCC),
    }),
    ...(totalAmount !== undefined && {
      totalAmountMinor: normalizeMoney(totalAmount, currency),
    }),
  };
}

function normalizePayment(
  payment: ProviderTransaction["paymentData"],
  currency: string,
) {
  if (!payment) {
    return null;
  }
  const { boletoMetadata: boleto, ...fields } = payment;
  return {
    ...fields,
    ...(boleto !== undefined && {
      boletoMetadata: normalizeBoleto(boleto, currency),
    }),
  };
}

function normalizeBoleto(
  boleto: import("./provider.entity").ProviderBoleto | null,
  currency: string,
) {
  if (!boleto) {
    return null;
  }
  return {
    ...(boleto.barcode !== undefined && { barcode: boleto.barcode }),
    ...(boleto.digitableLine !== undefined && {
      digitableLine: boleto.digitableLine,
    }),
    ...(boleto.baseAmount !== undefined && {
      baseAmountMinor: normalizeMoney(boleto.baseAmount, currency),
    }),
    ...(boleto.discountAmount !== undefined && {
      discountAmountMinor: normalizeMoney(boleto.discountAmount, currency),
    }),
    ...(boleto.interestAmount !== undefined && {
      interestAmountMinor: normalizeMoney(boleto.interestAmount, currency),
    }),
    ...(boleto.penaltyAmount !== undefined && {
      penaltyAmountMinor: normalizeMoney(boleto.penaltyAmount, currency),
    }),
  };
}
