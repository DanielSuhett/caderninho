export type MoneyTone = "income" | "expense" | "neutral";

export function transactionTone(row: {
  amountMinor: string | null;
  direction: "CREDIT" | "DEBIT";
  ignored: boolean;
}): MoneyTone {
  if (
    row.ignored ||
    row.amountMinor === null ||
    BigInt(row.amountMinor) === 0n
  ) {
    return "neutral";
  }
  return row.direction === "CREDIT" ? "income" : "expense";
}

export function formatBalance(value: string | null, currency: string) {
  if (value === null) {
    return "Saldo indisponível";
  }
  const scale =
    new Intl.NumberFormat("pt-BR", {
      currency,
      style: "currency",
    }).resolvedOptions().maximumFractionDigits ?? 0;
  const negative = value.startsWith("-");
  const digits = value.replace("-", "").padStart(scale + 1, "0");
  const whole = scale ? digits.slice(0, -scale) : digits;
  const fraction = scale ? `,${digits.slice(-scale)}` : "";
  return `${negative ? "−" : ""}${BigInt(whole).toLocaleString("pt-BR")}${fraction} ${currency}`;
}
