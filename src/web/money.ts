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
