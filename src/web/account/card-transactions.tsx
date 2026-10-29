import { Banner } from "@cloudflare/kumo/components/banner";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Link } from "@cloudflare/kumo/components/link";
import { useCallback, useState } from "react";

import type {
  PortalCard,
  PortalCards,
  PortalQueryResults,
  WorkspaceCatalog,
} from "../../contracts";
import { formatBalance } from "../money";
import { MoneyValue } from "../money-value";
import { UiButton } from "../ui";
import { AccountAvatar } from "./account-identity";
import { workspaceHref } from "./account-navigation";
import { cardDigitsLabel, cardMonthSpend } from "./card-presentation";
import { DisclosureItem } from "./disclosure-item";
import { TransactionList } from "./transaction-list";
import { useResource } from "./workspace-resource";

type CardAccount = PortalCards["accounts"][number];
export type ReadCardTransactions = (
  card: { accountId: string; cardId: string },
  signal: AbortSignal,
  fresh: boolean,
) => Promise<PortalQueryResults["get_portal_transactions"]>;

// Each card loads its own month only when opened, so the page never prefetches
// the ledger of every card.
export function CardTransactions({
  accounts,
  categories,
  read,
  showOwner,
}: {
  accounts: CardAccount[];
  categories: WorkspaceCatalog["categories"];
  read: ReadCardTransactions;
  showOwner: boolean;
}) {
  return (
    <div className="cards-installments">
      {accounts.flatMap((account) =>
        account.cards
          .filter((card) => !card.hidden)
          .map((card) => (
            <CardTransactionGroup
              account={account}
              card={card}
              categories={categories}
              key={card.id}
              read={read}
              showOwner={showOwner}
            />
          )),
      )}
    </div>
  );
}

function CardTransactionGroup({
  account,
  card,
  categories,
  read,
  showOwner,
}: {
  account: CardAccount;
  card: PortalCard;
  categories: WorkspaceCatalog["categories"];
  read: ReadCardTransactions;
  showOwner: boolean;
}) {
  const [open, setOpen] = useState(false);
  const spend = cardMonthSpend(card);
  const appearance = {
    identity: account.identity,
    name: account.name,
    type: "CREDIT",
  };
  return (
    <LayerCard className="cards-purchase cards-limit-row">
      <DisclosureItem
        leading={
          <AccountAvatar
            account={appearance}
            person={
              showOwner
                ? { id: card.personId, name: card.personName }
                : undefined
            }
          />
        }
        onOpenChange={setOpen}
        open={open}
        summary={
          <span className="cards-limit-line">
            <span className="cards-limit-name">{cardDigitsLabel(card)}</span>
            <span className="account-card-amount">
              {spend === null ? (
                "Não informado"
              ) : (
                <MoneyValue value={formatBalance(spend, account.currency)} />
              )}
            </span>
          </span>
        }
      >
        {open === true && (
          <CardTransactionRows
            account={{ ...appearance, id: account.id }}
            cardId={card.id}
            categories={categories}
            read={read}
          />
        )}
      </DisclosureItem>
    </LayerCard>
  );
}

function CardTransactionRows({
  account,
  cardId,
  categories,
  read,
}: {
  account: { id: string; identity: CardAccount["identity"]; name: string };
  cardId: string;
  categories: WorkspaceCatalog["categories"];
  read: ReadCardTransactions;
}) {
  const load = useCallback(
    (signal: AbortSignal, fresh: boolean) =>
      read({ accountId: account.id, cardId }, signal, fresh),
    [account.id, cardId, read],
  );
  const resource = useResource(load);
  const { data } = resource;
  if (resource.error) {
    return (
      <Banner
        description={
          <div className="installment-recovery">
            <p>Não foi possível carregar as transações.</p>
            <UiButton
              onClick={resource.retry}
              variant="secondary"
            >
              Tentar novamente
            </UiButton>
          </div>
        }
        variant="error"
      />
    );
  }
  if (!data) {
    return (
      <p
        className="muted"
        role="status"
      >
        Carregando transações…
      </p>
    );
  }
  if (!data.data.records.length) {
    return <p className="muted">Nenhuma transação deste cartão no mês.</p>;
  }
  return (
    <>
      {data.partial === true && (
        <Banner
          description="Importação parcial. Esta lista pode estar incompleta."
          variant="secondary"
        />
      )}
      <TransactionList
        accounts={[account]}
        categories={categories}
        records={data.data.records}
        referenceDay={data.data.referenceDay}
        showAvatar={false}
        showOwner={false}
      />
      {!!data.data.cursor && (
        <Link
          href={workspaceHref(
            `/account/transactions?accountId=${encodeURIComponent(account.id)}`,
          )}
        >
          Ver todas as transações da conta
        </Link>
      )}
    </>
  );
}
