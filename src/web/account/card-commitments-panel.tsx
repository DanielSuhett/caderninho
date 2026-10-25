import {
  Badge,
  Banner,
  Empty,
  LayerCard,
  Link,
  SkeletonLine,
} from "@cloudflare/kumo";
import { lazy, Suspense } from "react";

import type { CardCommitments } from "../../contracts";
import { tryCatch } from "../../shared";
import { formatBalance } from "../money";
import { MoneyValue } from "../money-value";
import { CreditLimitCard } from "./credit-limit-card";
import { monthLabel } from "./dashboard-period";
import { DisclosureItem } from "./disclosure-item";
import { FinancialMetric } from "./financial-metric";
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
          <div className="financial-donut">
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
            <div className="financial-donut-center">
              <span>
                <Amount
                  currency={currency}
                  value={total}
                />
              </span>
              <span className="investment-meta">representados</span>
            </div>
          </div>
          <ul className="financial-category-legend">
            {positive.map((category) => (
              <li
                className="financial-category-row"
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
                <span className="financial-category-amount">
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
        <h2 id="card-limits-heading">Limites informados</h2>
        <span className="section-context">
          Moedas nativas · última observação importada
        </span>
      </header>
      <div className="cards-limits">
        {accounts.map((account) => (
          <CreditLimitCard
            allocated={account.allocatedCreditMinor}
            available={account.availableCreditMinor}
            currency={account.currency}
            key={account.id}
            limit={account.creditLimitMinor}
            name={account.name}
            owner={account.personName}
          >
            {!!account.balanceObservedAt && (
              <p>Atualizado em {dayLabel(account.balanceObservedAt)}</p>
            )}
            {account.limitSource === "manual" && (
              <p>Limite total cadastrado manualmente.</p>
            )}
            {!!account.hidden && (
              <p>Conta oculta · há lançamentos neste grupo.</p>
            )}
          </CreditLimitCard>
        ))}
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
      <LayerCard className="financial-summary">
        <p className="summary-period">
          {monthLabel(data.month)} a {monthLabel(data.to.slice(0, 7))} ·
          compromissos recebidos
        </p>
        <dl className="financial-metrics financial-metrics-three">
          <FinancialMetric
            amount={total ? total.spentMinor : emptyAmount}
            currency={currency}
            hint="Confirmados até a data de referência"
            label="Gastos realizados"
            tone="expense"
          />
          <FinancialMetric
            amount={total ? total.pendingMinor : emptyAmount}
            currency={currency}
            hint="Aguardando confirmação, até a referência"
            label="Pendentes"
          />
          <FinancialMetric
            amount={total ? total.futureMinor : emptyAmount}
            currency={currency}
            hint="Lançamentos recebidos após a referência"
            label="Futuros conhecidos"
          />
        </dl>
        <p className="financial-summary-note">
          Referência em {dayLabel(data.referenceDay)} · {currency}, sem
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
        <DisclosureItem
          className="investment-method"
          summary="Como os valores são calculados"
        >
          <p>
            Gastos realizados são despesas confirmadas das contas de cartão,
            líquidas de estornos. Pendentes e futuros são exibidos
            separadamente. Transferências, pagamentos de fatura e lançamentos
            ignorados ficam fora destas somas. Cada parcela conta apenas na data
            recebida; não inferimos parcelas ausentes.
          </p>
          {data.assumptions.map((assumption) => (
            <p key={assumption}>{assumption}</p>
          ))}
        </DisclosureItem>
      </LayerCard>
      <div className="card-analysis-grid">
        <CommitmentCategories
          currency={currency}
          data={data}
        />
        <CommitmentMonths
          currency={currency}
          data={data}
        />
      </div>
      <CardCreditLimits accounts={data.accounts} />
      <p className="analysis-footnote">
        Ocupado = limite − disponível. Limites compartilhados entre cartões não
        são somados.
      </p>
    </div>
  );
}
