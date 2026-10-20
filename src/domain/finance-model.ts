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
  return {
    accountId: account.id,
    amountMinor: money(source.amount, source.currencyCode),
    category: source.category ?? null,
    connectionId: account.connectionId,
    currency: source.currencyCode,
    date: accountingDay(source.date) ?? "",
    description: source.description,
    direction: source.type,
    id: source.id,
    status: source.status,
  };
}
