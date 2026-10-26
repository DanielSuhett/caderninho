import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Meter } from "@cloudflare/kumo/components/meter";
import type { ReactNode } from "react";

import type { Person } from "../../domain";
import { formatBalance } from "../money";
import { MoneyValue } from "../money-value";
import { type AccountAppearance, AccountAvatar } from "./account-identity";
import { cardPercentage } from "./card-presentation";

export function CreditLimitCard({
  name,
  identity,
  person,
  currency,
  limit,
  allocated,
  available,
  children,
  action,
  estimated = false,
}: {
  name: string;
  identity?: AccountAppearance["identity"];
  person?: Person | undefined;
  currency: string;
  limit: string | null;
  allocated: string | null;
  available: string | null;
  children?: ReactNode;
  action?: ReactNode;
  estimated?: boolean;
}) {
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
    {
      label: estimated ? "Limite definido por você" : "Limite total",
      value: limit,
    },
    {
      label: excess ? "Crédito excedente" : "Limite ocupado",
      value: excess ? (-BigInt(allocated ?? "0")).toString() : allocated,
    },
    {
      label: estimated ? "Disponível estimado" : "Disponível",
      value: available,
    },
  ];
  return (
    <LayerCard className="credit-limit-card">
      <header className="credit-limit-heading">
        <AccountAvatar
          account={{ identity, name, type: "CREDIT" }}
          person={person}
        />
        <div>
          <h3>{name}</h3>
        </div>
        {action}
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
