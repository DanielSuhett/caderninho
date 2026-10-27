import { Empty } from "@cloudflare/kumo/components/empty";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Link } from "@cloudflare/kumo/components/link";
import { PencilSimpleIcon } from "@phosphor-icons/react";
import { lazy, Suspense, useCallback, useMemo } from "react";

import type {
  PortalCard,
  PortalCards,
  WorkspaceCatalog,
} from "../../contracts";
import type { CardAmount } from "../../domain";
import { tryCatch } from "../../shared";
import { formatBalance, type MoneyTone } from "../money";
import { MoneyValue } from "../money-value";
import { UiIconButton } from "../ui";
import { AnalysisSection } from "./analysis-section";
import { CardInstallments } from "./card-installments";
import { cardLabel, cardPercentage } from "./card-presentation";
import { CategoryLabel } from "./category-appearance";
import { ChartViewport } from "./chart-viewport";
import { CreditLimitCard } from "./credit-limit-card";
import { monthLabel } from "./dashboard-period";
import { FinancialMetric } from "./financial-metric";
import { InfoTip } from "./info-tip";
import { PersonAvatar } from "./person-identity";
import { dayLabel, momentLabel } from "./workspace-resource";

const CategoryChart = lazy(async () => {
  const { data, error } = await tryCatch(() => import("./card-category-chart"));
  return { default: error ? ChartUnavailable : data.CardCategoryChart };
});
function ChartUnavailable() {
  return (
    <p className="cards-note">
      Gráfico indisponível. Os valores continuam na legenda.
    </p>
  );
}
function amountLabel(value: string | null, currency: string) {
  return value === null ? (
    "Não informado"
  ) : (
    <MoneyValue value={formatBalance(value, currency)} />
  );
}
function CardMetric({
  label,
  amount,
  currency,
  hint,
  tone = "neutral",
}: {
  label: string;
  amount: CardAmount;
  currency: string;
  hint: string;
  tone?: MoneyTone;
}) {
  return (
    <FinancialMetric
      amount={amount.totalMinor}
      currency={currency}
      hint={hint}
      label={label}
      tone={tone}
    >
      {!!amount.unknownCount && (
        <small>
          {amount.unknownCount} sem valor · conhecidos:{" "}
          {amountLabel(amount.knownMinor, currency)}
        </small>
      )}
    </FinancialMetric>
  );
}
function AccountCardRow({
  card,
  currency,
  showOwner,
  onEdit,
}: {
  card: PortalCard;
  currency: string;
  showOwner: boolean;
  onEdit?: ((card: PortalCard) => void) | undefined;
}) {
  const edit = useCallback(() => onEdit?.(card), [card, onEdit]);
  return (
    <li>
      <span className="account-card-name">
        {showOwner ? (
          <PersonAvatar
            person={{ id: card.personId, name: card.personName }}
            size={24}
          />
        ) : null}
        {cardLabel(card)}
      </span>
      <span>{amountLabel(card.confirmed.totalMinor, currency)}</span>
      {!!onEdit && (
        <UiIconButton
          label={`Editar ${cardLabel(card)}`}
          onClick={edit}
        >
          <PencilSimpleIcon
            aria-hidden
            size={20}
          />
        </UiIconButton>
      )}
    </li>
  );
}
function AccountCards({
  cards,
  currency,
  showOwner,
  onEdit,
}: {
  cards: PortalCard[];
  currency: string;
  showOwner: boolean;
  onEdit?: ((card: PortalCard) => void) | undefined;
}) {
  if (cards.length < 2 && !cards.some((card) => card.number)) {
    return null;
  }
  const hiddenCards = cards.filter((card) => card.hidden);
  return (
    <>
      <ul
        aria-label="Cartões desta conta"
        className="account-cards"
      >
        {cards
          .filter((card) => !card.hidden)
          .map((card) => (
            <AccountCardRow
              card={card}
              currency={currency}
              key={card.id}
              onEdit={onEdit}
              showOwner={showOwner}
            />
          ))}
      </ul>
      {!!hiddenCards.length && (
        <details className="account-cards-hidden">
          <summary>Cartões ocultos ({hiddenCards.length})</summary>
          <ul className="account-cards">
            {hiddenCards.map((card) => (
              <AccountCardRow
                card={card}
                currency={currency}
                key={card.id}
                onEdit={onEdit}
                showOwner={showOwner}
              />
            ))}
          </ul>
        </details>
      )}
    </>
  );
}
function LimitCard({
  account,
  showOwner,
  onEdit,
  onEditCard,
}: {
  account: PortalCards["accounts"][number];
  showOwner: boolean;
  onEdit?: ((account: PortalCards["accounts"][number]) => void) | undefined;
  onEditCard?: ((card: PortalCard) => void) | undefined;
}) {
  const edit = useCallback(() => onEdit?.(account), [account, onEdit]);
  return (
    <CreditLimitCard
      action={
        onEdit && (
          <UiIconButton
            label={`Editar limite de ${account.name}`}
            onClick={edit}
          >
            <PencilSimpleIcon
              aria-hidden
              size={20}
            />
          </UiIconButton>
        )
      }
      allocated={account.allocatedMinor}
      available={account.availableCreditMinor}
      currency={account.currency}
      estimated={account.creditEstimated}
      identity={account.identity}
      limit={account.creditLimitMinor}
      name={`${account.name}${account.cardNumber ? ` · ${account.cardNumber}` : ""}`}
      person={
        showOwner
          ? { id: account.personId, name: account.personName }
          : undefined
      }
    >
      <AccountCards
        cards={account.cards}
        currency={account.currency}
        onEdit={onEditCard}
        showOwner={showOwner}
      />
      <p>Observado em {momentLabel(account.balanceObservedAt)}</p>
      {!!account.creditEstimated && (
        <p>
          Limite local. O disponível estimado usa a ocupação importada; não
          altera o banco.
        </p>
      )}
      {!!(account.closeDate || account.dueDate) && (
        <p>
          {account.closeDate
            ? `Fecha em ${dayLabel(account.closeDate)}`
            : "Fechamento não informado"}{" "}
          ·{" "}
          {account.dueDate
            ? `Vence em ${dayLabel(account.dueDate)}`
            : "Vencimento não informado"}
        </p>
      )}
    </CreditLimitCard>
  );
}

function Categories({
  data,
  categories,
}: {
  data: PortalCards;
  categories: WorkspaceCatalog["categories"];
}) {
  const groups = useMemo(
    () =>
      data.categories.toSorted((a, b) => {
        const difference = BigInt(b.knownMinor) - BigInt(a.knownMinor);
        return difference < 0n ? -1 : Number(difference > 0n);
      }),
    [data.categories],
  );
  const hasValues = groups.some((group) => BigInt(group.knownMinor) > 0n);
  return (
    <AnalysisSection
      currency={data.currency}
      hint={`${monthLabel(data.month)} · compras confirmadas antes dos estornos`}
      title="Gastos por categoria"
    >
      {groups.length ? (
        <div className="cards-category-content">
          {hasValues && !data.purchases.unknownCount ? (
            <div className="financial-donut">
              <ChartViewport height={240}>
                <Suspense fallback={<p role="status">Carregando gráfico…</p>}>
                  <CategoryChart
                    categories={categories}
                    currency={data.currency}
                    groups={groups}
                  />
                </Suspense>
              </ChartViewport>
              <div className="financial-donut-center">
                <span>
                  {amountLabel(data.purchases.totalMinor, data.currency)}
                </span>
                <span className="cards-note">em compras</span>
              </div>
            </div>
          ) : (
            <p className="cards-note">
              {data.purchases.unknownCount
                ? "Gráfico indisponível: há compras sem valor informado."
                : "Nenhum valor positivo para representar no gráfico."}
            </p>
          )}
          <ul className="financial-category-legend">
            {groups.map((group) => (
              <li
                className="financial-category-row"
                key={group.categoryId ?? "uncategorized"}
              >
                <CategoryLabel
                  category={categories.find(
                    (category) => category.id === group.categoryId,
                  )}
                  label={
                    categories.find(
                      (category) => category.id === group.categoryId,
                    )?.name ?? "Sem categoria"
                  }
                />
                <span className="financial-category-amount">
                  {amountLabel(group.totalMinor, data.currency)}
                  <span className="cards-note">
                    {cardPercentage(group.totalMinor, data.purchases.totalMinor)
                      ?.label ?? "Não informada"}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <Empty
          className="border-0 bg-transparent shadow-none"
          description="Compras confirmadas de contas de cartão aparecem aqui, inclusive sem categoria."
          size="sm"
          title="Sem gastos confirmados neste mês"
        />
      )}
    </AnalysisSection>
  );
}
export function CardsDashboard({
  data,
  categories,
  accountId,
  showOwner,
  nextHref,
  onEditLimit,
  onEditCard,
}: {
  data: PortalCards;
  categories: WorkspaceCatalog["categories"];
  accountId: string;
  showOwner: boolean;
  nextHref: string | null;
  onEditLimit?:
    | ((account: PortalCards["accounts"][number]) => void)
    | undefined;
  onEditCard?: ((card: PortalCard) => void) | undefined;
}) {
  const visibleAccounts = data.accounts.filter(
    (account) =>
      account.currency === data.currency &&
      (!accountId || account.id === accountId),
  );
  return (
    <div className="cards-dashboard">
      <LayerCard className="financial-summary">
        <dl className="financial-metrics financial-metrics-three">
          <CardMetric
            amount={data.confirmed}
            currency={data.currency}
            hint="Compras confirmadas de cartão no período, inclusive sem categoria, menos estornos classificados. Ignorados, transferências e pagamentos de fatura ficam fora. Cada parcela conta na data do lançamento recebido."
            label="Gastos confirmados"
            tone="expense"
          />
          <CardMetric
            amount={data.pending}
            currency={data.currency}
            hint="Data até hoje · aguardam confirmação"
            label="Pendentes"
          />
          <CardMetric
            amount={data.future}
            currency={data.currency}
            hint="Data posterior a hoje · já recebidos"
            label="Futuros conhecidos"
          />
        </dl>
        {!!data.refunds.count && (
          <p className="cards-note">
            Compras: {amountLabel(data.purchases.totalMinor, data.currency)} ·
            estornos classificados:{" "}
            {amountLabel(data.refunds.totalMinor, data.currency)}.
          </p>
        )}
      </LayerCard>
      <div className="card-analysis-grid">
        <Categories
          categories={categories}
          data={data}
        />
        <section aria-labelledby="card-limits-heading">
          <header className="section-heading">
            <h2 id="card-limits-heading">Limites dos cartões</h2>
            <InfoTip label="estes valores">
              Valores fora do recorte mensal. Um limite local preserva a
              ocupação recebida do banco e torna o disponível uma estimativa.
              Limites compartilhados não são somados.
            </InfoTip>
          </header>
          {visibleAccounts.length ? (
            <div className="cards-limits">
              {visibleAccounts.map((account) => (
                <LimitCard
                  account={account}
                  key={account.id}
                  onEdit={onEditLimit}
                  onEditCard={onEditCard}
                  showOwner={showOwner}
                />
              ))}
            </div>
          ) : (
            <p className="cards-note">
              Nenhum cartão com limite nesta moeda. Compras podem estar em uma
              moeda diferente da conta.
            </p>
          )}
        </section>
      </div>
      <section aria-labelledby="card-installments-heading">
        <header className="section-heading">
          <h2 id="card-installments-heading">Parcelamentos</h2>
        </header>
        {data.installments.length ? (
          <CardInstallments
            data={data}
            showOwner={showOwner}
          />
        ) : (
          <Empty
            className="border-0 bg-transparent shadow-none"
            description="Escolha outro mês no topo ou confira suas conexões."
            size="sm"
            title="Nenhuma parcela recebida neste mês"
          />
        )}
        {!!nextHref && <Link href={nextHref}>Mais parcelas deste mês</Link>}
      </section>
    </div>
  );
}
