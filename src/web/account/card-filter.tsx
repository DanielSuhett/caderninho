import { Select } from "@cloudflare/kumo/components/select";

import type { PortalCards } from "../../contracts";
import { AccountIdentity } from "./account-identity";
import { cardChoices, cardLabel } from "./card-presentation";

export function CardFilter({
  accounts,
  cardId,
  showOwner,
}: {
  accounts: PortalCards["accounts"];
  cardId: string;
  showOwner: boolean;
}) {
  const choices = cardChoices(accounts);
  if (!choices.length) {
    return null;
  }
  return (
    <Select
      className="w-full"
      defaultValue={cardId}
      items={[
        { label: <span className="text-sm">Todos os cartões</span>, value: "" },
        ...choices.map(({ account, card }) => ({
          label: (
            <AccountIdentity
              account={{
                ...account,
                name: `${account.name} · ${cardLabel(card)}`,
                type: "CREDIT",
              }}
              person={
                showOwner
                  ? { id: card.personId, name: card.personName }
                  : undefined
              }
            />
          ),
          value: card.id,
        })),
      ]}
      label="Cartão"
      name="cardId"
    />
  );
}
