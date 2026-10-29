import { Badge } from "@cloudflare/kumo/components/badge";
import { Empty } from "@cloudflare/kumo/components/empty";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Link } from "@cloudflare/kumo/components/link";
import { Meter } from "@cloudflare/kumo/components/meter";
import { Tabs } from "@cloudflare/kumo/components/tabs";
import { CaretRightIcon, PencilSimpleIcon } from "@phosphor-icons/react";
import { lazy, Suspense, useCallback, useMemo, useState } from "react";

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
import { AccountAvatar } from "./account-identity";
import { workspaceHref } from "./account-navigation";
import { AnalysisSection } from "./analysis-section";
import { CardInstallments } from "./card-installments";
import {
  cardDigitsLabel,
  cardMonthSpend,
  cardPercentage,
} from "./card-presentation";
import {
  CardTransactions,
  type ReadCardTransactions,
} from "./card-transactions";
import { CategoryLabel } from "./category-appearance";
import { ChartViewport } from "./chart-viewport";
import { monthLabel, monthPeriod } from "./dashboard-period";
import { DisclosureItem } from "./disclosure-item";
import { FinancialMetric } from "./financial-metric";
import { InfoTip } from "./info-tip";
import { PersonAvatar } from "./person-identity";

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
// Cards without a sublimit are measured against the shared account limit, so
// every row reads like the account above it.
// The card's share of its limit: its own sublimit when set, otherwise the
// account limit already shown above, so only a sublimit repeats its value.
function CardLimitMeter({
  card,
  currency,
  accountLimit,
}: {
  card: PortalCard;
  currency: string;
  accountLimit: string | null;
}) {
  const limit = card.creditLimitMinor ?? accountLimit;
  const usage = cardPercentage(cardMonthSpend(card), limit);
  if (!(usage && limit)) {
    return null;
  }
  return (
    <Meter
      customValue={usage.label}
      label={
        card.creditLimitMinor === null
          ? "Do limite total"
          : `Sublimite · ${formatBalance(limit, currency)}`
      }
      value={usage.meter}
    />
  );
}
function AccountCardRow({
  card,
  currency,
  accountLimit,
  showOwner,
}: {
  card: PortalCard;
  currency: string;
  accountLimit: string | null;
  showOwner: boolean;
}) {
  return (
    <li data-hidden={card.hidden}>
      <div className="account-card-row">
        {showOwner ? (
          <PersonAvatar
            person={{ id: card.personId, name: card.personName }}
            size={24}
          />
        ) : null}
        <span className="account-card-name">
          {cardDigitsLabel(card)}
          {!!card.hidden && <Badge variant="secondary">Oculto</Badge>}
        </span>
        <span className="account-card-amount">
          {amountLabel(cardMonthSpend(card), currency)}
        </span>
      </div>
      <CardLimitMeter
        accountLimit={accountLimit}
        card={card}
        currency={currency}
      />
    </li>
  );
}
// Every card of the account, primary first and hidden last, in one list of
// the drill-down.
function AccountCards({
  cards,
  currency,
  accountLimit,
  showOwner,
}: {
  cards: PortalCard[];
  currency: string;
  accountLimit: string | null;
  showOwner: boolean;
}) {
  if (cards.length < 2 && !cards.some((card) => card.number)) {
    return null;
  }
  const ordered = cards.toSorted(
    (a, b) =>
      Number(a.hidden) - Number(b.hidden) ||
      Number(b.primary) - Number(a.primary),
  );
  return (
    <ul
      aria-label="Cartões desta conta"
      className="account-cards"
    >
      {ordered.map((card) => (
        <AccountCardRow
          accountLimit={accountLimit}
          card={card}
          currency={currency}
          key={card.id}
          showOwner={showOwner}
        />
      ))}
    </ul>
  );
}
function shortDay(day: string) {
  return `${day.slice(8, 10)}/${day.slice(5, 7)}`;
}
function LimitValue({
  label,
  value,
  currency,
}: {
  label: string;
  value: string | null;
  currency: string;
}) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{amountLabel(value, currency)}</dd>
    </div>
  );
}
// One short collapsible row per account: identity, use and meter on top;
// values, dates and the account's cards only when opened.
function LimitCard({
  account,
  showOwner,
  onEdit,
}: {
  account: PortalCards["accounts"][number];
  showOwner: boolean;
  onEdit?: ((account: PortalCards["accounts"][number]) => void) | undefined;
}) {
  const edit = useCallback(() => onEdit?.(account), [account, onEdit]);
  const usage = cardPercentage(
    account.allocatedMinor,
    account.creditLimitMinor,
  );
  const dates = [
    account.closeDate && `fecha ${shortDay(account.closeDate)}`,
    account.dueDate && `vence ${shortDay(account.dueDate)}`,
  ].filter(Boolean);
  return (
    <LayerCard className="cards-limit-row">
      <DisclosureItem
        leading={
          <AccountAvatar
            account={{
              identity: account.identity,
              name: account.name,
              type: "CREDIT",
            }}
            person={
              showOwner
                ? { id: account.personId, name: account.personName }
                : undefined
            }
          />
        }
        summary={
          <span className="cards-limit-summary">
            <span className="cards-limit-line">
              <span className="cards-limit-name">
                {account.cardNumber
                  ? `•••• ${account.cardNumber}`
                  : account.name}
              </span>
            </span>
            {!!usage && (
              <Meter
                customValue={usage.label}
                label="Ocupação"
                value={usage.meter}
              />
            )}
            <span className="cards-limit-meta">
              {amountLabel(account.allocatedMinor, account.currency)} de{" "}
              {amountLabel(account.creditLimitMinor, account.currency)}
              {!!account.creditEstimated && " · estimado"}
            </span>
          </span>
        }
      >
        <div className="cards-limit-panel">
          <dl className="cards-limit-values">
            <LimitValue
              currency={account.currency}
              label="Disponível"
              value={account.availableCreditMinor}
            />
            {!!dates.length && (
              <div>
                <dt>Fatura</dt>
                <dd>{dates.join(" · ")}</dd>
              </div>
            )}
          </dl>
          {!!onEdit && (
            <UiIconButton
              label={`Editar limite de ${account.name}`}
              onClick={edit}
            >
              <PencilSimpleIcon
                aria-hidden
                size={20}
              />
            </UiIconButton>
          )}
        </div>
        <AccountCards
          accountLimit={account.creditLimitMinor}
          cards={account.cards}
          currency={account.currency}
          showOwner={showOwner}
        />
      </DisclosureItem>
    </LayerCard>
  );
}

// Opens Transações with every card of the month in the clicked category,
// keeping the current space and person.
function categoryTransactionsHref(month: string, categoryId: string | null) {
  const current = new URLSearchParams(
    typeof location === "undefined" ? "" : location.search,
  );
  const params = new URLSearchParams({ cards: "on", ...monthPeriod(month) });
  for (const key of ["space", "person"]) {
    const value = current.get(key);
    if (value) {
      params.set(key, value);
    }
  }
  if (categoryId) {
    params.set("categoryId", categoryId);
  } else {
    params.set("uncategorized", "on");
  }
  return workspaceHref(`/account/transactions?${params}`);
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
                <a
                  className="financial-category-link"
                  href={categoryTransactionsHref(data.month, group.categoryId)}
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
                      {cardPercentage(
                        group.totalMinor,
                        data.purchases.totalMinor,
                      )?.label ?? "Não informada"}
                    </span>
                  </span>
                  <CaretRightIcon
                    aria-hidden="true"
                    className="financial-category-caret"
                    size={16}
                  />
                </a>
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
function CardInstallmentList({
  data,
  nextHref,
  showOwner,
}: {
  data: PortalCards;
  nextHref: string | null;
  showOwner: boolean;
}) {
  return (
    <>
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
    </>
  );
}
export function CardsDashboard({
  data,
  categories,
  accountId,
  showOwner,
  nextHref,
  onEditLimit,
  readTransactions,
}: {
  data: PortalCards;
  categories: WorkspaceCatalog["categories"];
  accountId: string;
  showOwner: boolean;
  nextHref: string | null;
  onEditLimit?:
    | ((account: PortalCards["accounts"][number]) => void)
    | undefined;
  readTransactions?: ReadCardTransactions | undefined;
}) {
  const [activity, setActivity] = useState<string>(
    readTransactions ? "transactions" : "installments",
  );
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
                  showOwner={showOwner}
                />
              ))}
            </div>
          ) : (
            <Empty
              className="border-0 bg-transparent shadow-none"
              size="sm"
              title="Nenhum cartão com limite nesta moeda"
            />
          )}
        </section>
      </div>
      <section aria-labelledby="card-activity-heading">
        <header className="section-heading">
          <h2 id="card-activity-heading">Movimentações</h2>
        </header>
        {!!readTransactions && (
          <Tabs
            className="transaction-tabs"
            onValueChange={setActivity}
            tabs={[
              { label: "Transações", value: "transactions" },
              { label: "Parcelamentos", value: "installments" },
            ]}
            value={activity}
            variant="underline"
          />
        )}
        {activity === "transactions" && readTransactions ? (
          <CardTransactions
            accounts={visibleAccounts}
            categories={categories}
            read={readTransactions}
            showOwner={showOwner}
          />
        ) : (
          <CardInstallmentList
            data={data}
            nextHref={nextHref}
            showOwner={showOwner}
          />
        )}
      </section>
    </div>
  );
}
