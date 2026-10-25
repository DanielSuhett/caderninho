import { LayerCard, Meter } from "@cloudflare/kumo";
import { CreditCardIcon } from "@phosphor-icons/react";
import type { ReactNode } from "react";

import { formatBalance } from "../money";
import { MoneyValue } from "../money-value";
import { cardPercentage } from "./card-presentation";

export function CreditLimitCard({
  name,
  owner,
  currency,
  limit,
  allocated,
  available,
  children,
}: {
  name: string;
  owner?: string;
  currency: string;
  limit: string | null;
  allocated: string | null;
  available: string | null;
  children?: ReactNode;
}) {
  const context = owner ? `${owner} · ${currency}` : currency;
  const percentage = cardPercentage(allocated, limit);
  const excess = allocated !== null && BigInt(allocated) < 0n;
  let unavailableReason =
    "Ocupação indisponível: limite ou disponível não informado.";
  if (limit !== null && BigInt(limit) <= 0n) {
    unavailableReason =
      "Limite informado não é positivo; percentual indisponível.";
  }
  if (excess) {
    unavailableReason = "O crédito informado supera o limite total.";
  }
  const values = [
    { label: "Limite total", value: limit },
    {
      label: excess ? "Crédito excedente" : "Limite ocupado",
      value: excess ? (-BigInt(allocated ?? "0")).toString() : allocated,
    },
    { label: "Disponível", value: available },
  ];
  return (
    <LayerCard className="credit-limit-card">
      <header className="credit-limit-heading">
        <span className="credit-limit-icon">
          <CreditCardIcon
            aria-hidden
            size={20}
          />
        </span>
        <div>
          <h3>{name}</h3>
          <p>{context}</p>
        </div>
      </header>
      <dl className="credit-limit-values">
        {values.map(({ label, value }) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>
              {value === null ? (
                "Não informado"
              ) : (
                <MoneyValue value={formatBalance(value, currency)} />
              )}
            </dd>
          </div>
        ))}
      </dl>
      {percentage && !excess ? (
        <Meter
          customValue={percentage.label}
          label="Ocupação do limite"
          value={percentage.meter}
        />
      ) : (
        <p className="credit-limit-note">{unavailableReason}</p>
      )}
      <div className="credit-limit-details">{children}</div>
    </LayerCard>
  );
}
