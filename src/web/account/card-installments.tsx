import { Badge } from "@cloudflare/kumo/components/badge";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { useState } from "react";

import type { PortalCardInstallment, PortalCards } from "../../contracts";
import { installmentGroupKey } from "../../domain/card-installments";
import { formatBalance } from "../money";
import { MoneyValue } from "../money-value";
import { AccountAvatar } from "./account-identity";
import { DisclosureItem } from "./disclosure-item";
import { RelatedInstallments } from "./related-installments";
import { dayLabel } from "./workspace-resource";

export function CardInstallments({
  data,
  showOwner,
}: {
  data: PortalCards;
  showOwner: boolean;
}) {
  const purchases = new Map<string, PortalCardInstallment[]>();
  for (const row of data.installments) {
    const key =
      installmentGroupKey({
        ...row,
        currency: data.currency,
        direction: "DEBIT",
      }) ?? row.id;
    // One purchase can have several received installments in the selected month.
    const members = purchases.get(key) ?? [];
    members.push(row);
    purchases.set(key, members);
  }
  return (
    <div className="cards-installments">
      {[...purchases.values()]
        .flatMap((members) => {
          const numbers = members.map((row) => row.installmentNumber);
          return new Set(numbers).size === numbers.length
            ? members.slice(0, 1)
            : members;
        })
        .map((row) => (
          <CardPurchase
            data={data}
            key={row.id}
            row={row}
            showOwner={showOwner}
          />
        ))}
    </div>
  );
}
function CardPurchase({
  row,
  data,
  showOwner,
}: {
  row: PortalCardInstallment;
  data: PortalCards;
  showOwner: boolean;
}) {
  const [open, setOpen] = useState(false);
  const account = data.accounts.find((item) => item.id === row.accountId);
  const appearance = {
    identity: account?.identity,
    name: account?.name ?? "Cartão",
    type: "CREDIT",
  };
  return (
    <LayerCard className="cards-purchase">
      <DisclosureItem
        leading={
          <AccountAvatar
            account={appearance}
            person={
              showOwner && account
                ? { id: account.personId, name: account.personName }
                : undefined
            }
          />
        }
        onOpenChange={setOpen}
        open={open}
        summary={
          <span className="cards-installment-summary">
            <span className="cards-purchase-identity">
              <span>
                <span className="cards-purchase-name">{row.description}</span>
                <span className="cards-note">
                  {row.totalInstallments} parcelas
                  {!!row.purchaseDate && ` · ${dayLabel(row.purchaseDate)}`}
                </span>
              </span>
            </span>
            <span className="cards-installment-amount">
              <span>
                {row.amountMinor === null ? (
                  `Indisponível · ${data.currency}`
                ) : (
                  <MoneyValue
                    value={formatBalance(row.amountMinor, data.currency)}
                  />
                )}
              </span>
              <span className="cards-installment-current">
                <span className="cards-note">
                  {row.installmentNumber}/{row.totalInstallments} neste mês
                </span>
                <Badge
                  variant={row.status === "pending" ? "warning" : "secondary"}
                >
                  {
                    {
                      confirmed: "Confirmada",
                      future: "Futura",
                      pending: "Pendente",
                    }[row.status]
                  }
                </Badge>
              </span>
            </span>
          </span>
        }
      >
        {open === true && (
          <RelatedInstallments
            account={appearance}
            accountId={row.accountId}
            id={row.id}
          />
        )}
      </DisclosureItem>
    </LayerCard>
  );
}
