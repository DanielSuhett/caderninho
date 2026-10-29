import { TransactionDirection } from "../domain";
export const MoneyTone = {
  expense: "expense",
  income: "income",
  neutral: "neutral",
} as const;
export type MoneyTone = (typeof MoneyTone)[keyof typeof MoneyTone];

export function transactionTone(row: {
  amountMinor: string | null;
  direction: TransactionDirection;
  ignored: boolean;
}): MoneyTone {
  if (
    row.ignored ||
    row.amountMinor === null ||
    BigInt(row.amountMinor) === 0n
  ) {
    return MoneyTone.neutral;
  }
  return row.direction === TransactionDirection.CREDIT
    ? MoneyTone.income
    : MoneyTone.expense;
}

// Short symbols for the usual currencies; any other code stays as a suffix.
const currencySymbols = new Map([
  ["BRL", "R$"],
  ["USD", "$"],
]);

// The bare amount in pt-BR digits, without symbol or code.
export function formatAmount(value: string, currency: string) {
  const scale =
    new Intl.NumberFormat("pt-BR", {
      currency,
      style: "currency",
    }).resolvedOptions().maximumFractionDigits ?? 0;
  const negative = value.startsWith("-");
  const digits = value.replace("-", "").padStart(scale + 1, "0");
  const whole = scale ? digits.slice(0, -scale) : digits;
  const fraction = scale ? `,${digits.slice(-scale)}` : "";
  return `${negative ? "−" : ""}${BigInt(whole).toLocaleString("pt-BR")}${fraction}`;
}

export function formatBalance(value: string | null, currency: string) {
  if (value === null) {
    return "Saldo indisponível";
  }
  const amount = formatAmount(value.replace("-", ""), currency);
  const sign = value.startsWith("-") ? "−" : "";
  const symbol = currencySymbols.get(currency);
  if (symbol) {
    return `${sign}${symbol} ${amount}`;
  }
  return `${sign}${amount} ${currency}`;
}
