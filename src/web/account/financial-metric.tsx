import type { ReactNode } from "react";

import { formatBalance, type MoneyTone } from "../money";
import { MoneyValue } from "../money-value";

export function FinancialMetric({
  label,
  amount,
  currency,
  hint,
  tone = "neutral",
  children,
}: {
  label: string;
  amount: string | null;
  currency: string;
  hint: string;
  tone?: MoneyTone;
  children?: ReactNode;
}) {
  const value = amount === null ? null : formatBalance(amount, currency);
  return (
    <div className="financial-metric">
      <dt>{label}</dt>
      <dd>
        <span
          className="metric-amount"
          data-money-tone={
            amount !== null && BigInt(amount) !== 0n ? tone : "neutral"
          }
        >
          {value === null ? (
            "Indisponível"
          ) : (
            <MoneyValue value={value.slice(0, -(currency.length + 1))} />
          )}
        </span>
        <span className="metric-currency"> {currency}</span>
      </dd>
      <small>{hint}</small>
      {children}
    </div>
  );
}
