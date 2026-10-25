import {
  Badge,
  Banner,
  Empty,
  LayerCard,
  Link,
  Meter,
  SkeletonLine,
} from "@cloudflare/kumo";
import { CreditCardIcon } from "@phosphor-icons/react";
import { lazy, Suspense } from "react";

import type { CardCommitments } from "../../contracts";
import { tryCatch } from "../../shared";
import { formatBalance, type MoneyTone } from "../money";
import { MoneyValue } from "../money-value";
import { monthLabel } from "./dashboard-period";
import { DisclosureItem } from "./disclosure-item";
import {
  amountProportion,
  type InvestmentCategorySlice,
  percentageLabel,
} from "./investments-presentation";
import { dayLabel } from "./workspace-resource";

function ChartUnavailable() {
  return (
    <p className="chart-unavailable">
      O gráfico está indisponível. Os valores exatos continuam na legenda.
    </p>
  );
}

const CategoryChart = lazy(async () => {
  const { data, error } = await tryCatch(
    () => import("./investment-category-chart"),
  );
  return { default: error ? ChartUnavailable : data.InvestmentCategoryChart };
});

function Amount({
  value,
  currency,
}: {
  value: string | null;
  currency: string;
}) {
  return value === null ? (
    <span className="muted">Indisponível · {currency}</span>
  ) : (
    <MoneyValue value={formatBalance(value, currency)} />
  );
}

function CommitmentMetric({
  title,
  value,
  currency,
  hint,
  tone = "neutral",
}: {
  title: string;
  value: string | null;
  currency: string;
  hint: string;
  tone?: MoneyTone;
}) {
  const formatted = value === null ? null : formatBalance(value, currency);
  return (
    <div className="financial-metric">
      <dt>{title}</dt>
      <dd>
        <span
          className="metric-amount"
          data-money-tone={
            value !== null && BigInt(value) !== 0n ? tone : "neutral"
          }
        >
          {formatted === null ? (
            "Indisponível"
          ) : (
            <MoneyValue value={formatted.slice(0, -(currency.length + 1))} />
          )}
        </span>
        <span className="metric-currency"> {currency}</span>
      </dd>
      <small>{hint}</small>
    </div>
  );
}

function InstallmentRows({
  installments,
}: {
  installments: CardCommitments["installments"];
}) {
  const phaseLabels = {
    future: "Futura",
    pending: "Pendente",
    spent: "Realizada",
  } as const;
  return (
    <ul className="investment-installments">
      {installments.map((installment) => (
        <li
          className="investment-installment-row"
          key={installment.id}
        >
          <div className="investment-installment-copy">
            <span className="font-medium">{installment.description}</span>
            <span className="investment-meta">
              {installment.accountName} · {dayLabel(installment.date)} · parcela{" "}
              {installment.installmentNumber} de {installment.totalInstallments}
            </span>
            <span className="investment-meta">
              {installment.categoryName}
              {!!installment.purchaseDate &&
                ` · compra em ${dayLabel(installment.purchaseDate)}`}
            </span>
          </div>
          <div className="investment-installment-value">
            <Amount
              currency={installment.currency}
              value={installment.amountMinor}
            />
            <div className="investment-states">
              {installment.direction === "CREDIT" && (
                <Badge variant="outline">Crédito ou estorno</Badge>
              )}
              <Badge
                variant={
                  installment.phase === "pending" ? "outline" : "secondary"
                }
              >
                {phaseLabels[installment.phase]}
              </Badge>
              {installment.phase === "future" &&
                installment.status === "PENDING" && (
                  <Badge variant="outline">Pendente</Badge>
                )}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function CommitmentMonths({
  data,
  currency,
}: {
  data: CardCommitments;
  currency: string;
}) {
  const months = data.months.filter((row) => row.currency === currency);
  const installments = data.installments.filter(
    (row) => row.currency === currency,
  );
  return (
    <LayerCard className="analysis-card investment-months">
      <header className="analysis-heading">
        <h2>Compromissos por mês</h2>
        <span>{currency}</span>
      </header>
      <p className="analysis-caption">
        Lançamentos recebidos. Abra cada mês para ver as parcelas conhecidas.
      </p>
      <div
        aria-hidden
        className="investment-month-columns"
      >
        <span>Mês</span>
        <span>Realizados</span>
        <span>Pendentes</span>
        <span>Futuros</span>
      </div>
      {months.length ? (
        <div className="investment-month-list">
          {months.map((month) => {
            const rows = installments.filter(
              (row) => row.date.slice(0, 7) === month.month,
            );
            const summary = (
              <div className="investment-month-values">
                <span className="investment-month-name">
                  {monthLabel(month.month)}
                </span>
                <span>
                  <span className="investment-mobile-label">Realizados</span>
                  <Amount
                    currency={currency}
                    value={month.spentMinor}
                  />
                </span>
                <span>
                  <span className="investment-mobile-label">Pendentes</span>
                  <Amount
                    currency={currency}
                    value={month.pendingMinor}
                  />
                </span>
                <span>
                  <span className="investment-mobile-label">Futuros</span>
                  <Amount
                    currency={currency}
                    value={month.futureMinor}
                  />
                </span>
              </div>
            );
            if (!rows.length) {
              return (
                <div
                  className="investment-month-static"
                  key={month.month}
                >
                  {summary}
                  {!!month.unknownAmountCount && (
                    <p className="investment-meta">
                      {month.unknownAmountCount} lançamentos sem valor
                      conhecido.
                    </p>
                  )}
                </div>
              );
            }
            return (
              <DisclosureItem
                className="investment-month"
                key={month.month}
                summary={summary}
              >
                <InstallmentRows installments={rows} />
                {!!month.unknownAmountCount && (
                  <p className="investment-month-empty">
                    {month.unknownAmountCount} lançamentos sem valor conhecido.
                    Os totais afetados estão indisponíveis.
                  </p>
                )}
              </DisclosureItem>
            );
          })}
        </div>
      ) : (
        <Empty
          description="Os meses aparecem quando houver lançamentos nesta moeda."
          size="sm"
          title="Nenhum compromisso recebido"
        />
      )}
      <p className="analysis-footnote">
        As parcelas que o provedor não enviou não são projetadas. Pagamentos de
        fatura, transferências e ignorados ficam fora.
      </p>
    </LayerCard>
  );
}

function CommitmentCategories({
  data,
  currency,
}: {
  data: CardCommitments;
  currency: string;
}) {
  const categories = data.categories.filter((row) => row.currency === currency);
  const positive = categories.filter(
    (row) => BigInt(row.knownAmountMinor) > 0n,
  );
  const total = positive
    .reduce((sum, row) => sum + BigInt(row.knownAmountMinor), 0n)
    .toString();
  const credits = categories.filter((row) => BigInt(row.knownAmountMinor) < 0n);
  const unknownOnly = categories.filter(
    (row) => BigInt(row.knownAmountMinor) === 0n && row.unknownAmountCount > 0,
  );
  const unknown = categories.some((row) => row.unknownAmountCount > 0);
  const slices: InvestmentCategorySlice[] = positive.map((row) => ({
    amountMinor: row.knownAmountMinor,
    color: row.color,
    id: row.id ?? "unclassified",
    name: row.name,
  }));
  return (
    <LayerCard className="analysis-card investment-categories">
      <header className="analysis-heading">
        <h2>Compromissos por categoria</h2>
        <span>{currency}</span>
      </header>
      <p className="analysis-caption">
        Realizados, pendentes e futuros recebidos · {monthLabel(data.month)} a{" "}
        {monthLabel(data.to.slice(0, 7))}
      </p>
      {positive.length ? (
        <>
          <div className="investment-donut">
            <Suspense
              fallback={
                <div
                  aria-label="Carregando gráfico"
                  className="chart-loading"
                  role="status"
                >
                  <SkeletonLine
                    blockHeight={20}
                    maxWidth={70}
                    minWidth={50}
                  />
                </div>
              }
            >
              <CategoryChart
                categories={slices}
                currency={currency}
              />
            </Suspense>
          </div>
          <p className="investment-category-total">
            <span>Total representado</span>
            <Amount
              currency={currency}
              value={total}
            />
          </p>
          <ul className="investment-category-legend">
            {positive.map((category) => (
              <li
                className="investment-category-row"
                key={category.id ?? "unclassified"}
              >
                <span className="investment-category-name">
                  <span
                    aria-hidden
                    className="investment-category-dot"
                    style={{ backgroundColor: category.color }}
                  />
                  {category.name}
                </span>
                <span className="investment-category-amount">
                  <Amount
                    currency={currency}
                    value={category.knownAmountMinor}
                  />
                  <span className="investment-meta">
                    {percentageLabel(
                      amountProportion(category.knownAmountMinor, total),
                    )}
                    {category.unknownAmountCount > 0 && " · valor parcial"}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <Empty
          description="As categorias aparecem a partir dos compromissos recebidos dos cartões."
          size="sm"
          title="Nenhum valor para representar"
        />
      )}
      {!!credits.length && (
        <div className="investment-credit-categories">
          <p>Créditos líquidos, fora da pizza:</p>
          {credits.map((category) => (
            <p key={category.id ?? "unclassified"}>
              <span>{category.name}</span>
              <Amount
                currency={currency}
                value={category.knownAmountMinor}
              />
            </p>
          ))}
        </div>
      )}
      {!!unknownOnly.length && (
        <div className="investment-credit-categories">
          <p>Categorias sem valor conhecido, fora da pizza:</p>
          {unknownOnly.map((category) => (
            <p key={category.id ?? "unclassified"}>
              <span>{category.name}</span>
              <Amount
                currency={currency}
                value={null}
              />
            </p>
          ))}
        </div>
      )}
      <p className="analysis-footnote">
        Percentuais dos compromissos com valor positivo conhecido
        {unknown ? "; há valores indisponíveis" : ""}. Não representam o limite
        ocupado no banco.
      </p>
    </LayerCard>
  );
}

export function CardCreditLimits({
  accounts,
}: {
  accounts: CardCommitments["accounts"];
}) {
  return (
    <section aria-labelledby="card-limits-heading">
      <header className="section-heading">
        <h2 id="card-limits-heading">Limites dos cartões</h2>
        <span className="section-context">
          Moedas nativas · última observação importada
        </span>
      </header>
      <div className="investment-card-grid">
        {accounts.map((account) => {
          const measured =
            account.creditLimitMinor !== null &&
            account.allocatedCreditMinor !== null &&
            BigInt(account.creditLimitMinor) > 0n;
          const proportion = measured
            ? amountProportion(
                account.allocatedCreditMinor ?? "0",
                account.creditLimitMinor ?? "0",
              )
            : null;
          return (
            <LayerCard
              className="investment-credit-card"
              key={account.id}
            >
              <header className="investment-card-heading">
                <span className="investment-card-icon">
                  <CreditCardIcon
                    aria-hidden
                    size={20}
                  />
                </span>
                <div>
                  <h3>{account.name}</h3>
                  <p>
                    {account.personName} · {account.currency}
                    {!!account.hidden && " · conta oculta"}
                  </p>
                </div>
              </header>
              <dl className="investment-credit-values">
                <div>
                  <dt>Limite total</dt>
                  <dd>
                    <Amount
                      currency={account.currency}
                      value={account.creditLimitMinor}
                    />
                  </dd>
                </div>
                <div>
                  <dt>Ocupado na origem</dt>
                  <dd>
                    <Amount
                      currency={account.currency}
                      value={account.allocatedCreditMinor}
                    />
                  </dd>
                </div>
                <div>
                  <dt>Disponível na origem</dt>
                  <dd>
                    <Amount
                      currency={account.currency}
                      value={account.availableCreditMinor}
                    />
                  </dd>
                </div>
              </dl>
              {proportion !== null && (
                <Meter
                  customValue={percentageLabel(proportion)}
                  label="Ocupação do limite informado"
                  showValue
                  value={Math.min(proportion, 100)}
                />
              )}
              <p className="investment-meta investment-limit-note">
                {account.allocatedCreditMinor === null
                  ? "Não há informações suficientes para calcular a ocupação. A soma de lançamentos não substitui essa informação."
                  : "Ocupação calculada pelo limite total menos o disponível informado pela origem."}
                {account.availabilitySource === "unavailable" &&
                  " Disponível não informado pela origem."}
                {!!account.balanceObservedAt &&
                  ` Conta lida em ${dayLabel(account.balanceObservedAt)}.`}
                {account.limitSource === "manual" &&
                  " Limite total cadastrado manualmente."}
              </p>
            </LayerCard>
          );
        })}
      </div>
    </section>
  );
}

export function CardCommitmentsPanel({
  data,
  currency,
  partial = false,
  connectionsHref = "/account/connections",
}: {
  data: CardCommitments;
  currency: string;
  partial?: boolean;
  connectionsHref?: string;
}) {
  const total = data.totals.find((row) => row.currency === currency);
  if (!data.accounts.length) {
    return (
      <Empty
        contents={
          <p>
            Os cartões da pessoa e do grupo selecionados aparecerão aqui após a
            importação. <Link href={connectionsHref}>Conferir conexões</Link>
          </p>
        }
        size="sm"
        title="Nenhum cartão neste escopo"
      />
    );
  }
  const emptyAmount = partial ? null : "0";
  return (
    <div className="investment-dashboard">
      {!!partial && (
        <Banner
          description="Os valores refletem os registros disponíveis. Parcelas e limites podem estar incompletos."
          title="Dados parciais"
          variant="secondary"
        />
      )}
      <LayerCard className="financial-summary investment-summary">
        <dl className="financial-metrics investment-metrics">
          <CommitmentMetric
            currency={currency}
            hint="Confirmados até a data de referência"
            title="Gastos realizados"
            tone="expense"
            value={total ? total.spentMinor : emptyAmount}
          />
          <CommitmentMetric
            currency={currency}
            hint="Aguardando confirmação, até a referência"
            title="Pendentes"
            value={total ? total.pendingMinor : emptyAmount}
          />
          <CommitmentMetric
            currency={currency}
            hint="Lançamentos recebidos após a referência"
            title="Futuros conhecidos"
            value={total ? total.futureMinor : emptyAmount}
          />
        </dl>
        <p className="financial-summary-note">
          {dayLabel(data.from)} a {dayLabel(data.to)} · referência em{" "}
          {dayLabel(data.referenceDay)} · somente cartões · {currency}, sem
          conversão.
        </p>
        {!!total?.unknownAmountCount && (
          <p className="financial-summary-note">
            {total.unknownAmountCount} lançamentos sem valor conhecido. Totais
            afetados indisponíveis; a legenda usa apenas valores conhecidos.
          </p>
        )}
        {!!total?.unclassifiedCount && (
          <p className="financial-summary-note">
            {total.unclassifiedCount} lançamentos sem classificação, fora dos
            gastos. Subtotal conhecido:{" "}
            <Amount
              currency={currency}
              value={total.knownUnclassifiedMinor}
            />
            {total.unclassifiedUnknownAmountCount > 0 &&
              "; há valores indisponíveis"}
            .
          </p>
        )}
      </LayerCard>
      <div className="investment-analysis-grid">
        <CommitmentMonths
          currency={currency}
          data={data}
        />
        <CommitmentCategories
          currency={currency}
          data={data}
        />
      </div>
      <CardCreditLimits accounts={data.accounts} />
      <DisclosureItem
        className="investment-method"
        summary="Como os valores são calculados"
      >
        <p>
          Gastos realizados são despesas confirmadas das contas de cartão,
          líquidas de estornos. Pendentes e futuros são exibidos separadamente.
          Transferências, pagamentos de fatura e lançamentos ignorados ficam
          fora destas somas. Cada parcela conta apenas na data recebida; não
          inferimos parcelas ausentes.
        </p>
        {data.assumptions.map((assumption) => (
          <p key={assumption}>{assumption}</p>
        ))}
      </DisclosureItem>
    </div>
  );
}
