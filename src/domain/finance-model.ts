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
    status: source.status,
  };
}
