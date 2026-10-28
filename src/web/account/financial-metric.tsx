import type { ReactNode } from "react";

import { formatBalance, type MoneyTone } from "../money";
import { MoneyValue } from "../money-value";
import { InfoTip } from "./info-tip";

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
      <dt>
        {label}
        <InfoTip label={label}>{hint}</InfoTip>
      </dt>
      <dd>
        <span
          className="metric-amount"
          data-money-tone={
            amount !== null && BigInt(amount) !== 0n ? tone : "neutral"
          }
        >
          {value === null ? (
            <span className="metric-unavailable">Indisponível</span>
          ) : (
            <MoneyValue value={value.slice(0, -(currency.length + 1))} />
          )}
        </span>
        <span className="metric-currency"> {currency}</span>
      </dd>
      {!!children && <dd className="metric-note">{children}</dd>}
    </div>
  );
}
