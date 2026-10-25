import {
  Badge,
  Empty,
  InlineCopyText,
  LayerCard,
  Link,
  Meter,
  SkeletonLine,
  Table,
} from "@cloudflare/kumo";
import { BankIcon, CreditCardIcon } from "@phosphor-icons/react";
import { lazy, Suspense, useMemo } from "react";
import type { z } from "zod/v4";

import type {
  FinancialOverview,
  FinancialSummary,
  PortalTransactionListSchema,
} from "../../contracts";
import { tryCatch } from "../../shared";
import { formatBalance } from "../money";
import type { CategoryAppearance } from "./category-appearance";
import { DisclosureItem } from "./disclosure-item";
import { FinancialMetric } from "./financial-metric";
import { categoryVolumes, summaryCurrency } from "./financial-presentation";
import { TransactionList } from "./transaction-list";
import { dayLabel } from "./workspace-resource";

function ChartUnavailable({
  groups,
  currency,
}: {
  groups: FinancialSummary["groups"];
  currency: string;
}) {
  return (
    <div>
      <p className="chart-unavailable">Gráfico indisponível. Valores exatos:</p>
      <Table aria-label="Despesas mensais, alternativa ao gráfico">
        <Table.Header>
          <Table.Row>
            <Table.Head>Mês</Table.Head>
            <Table.Head>Despesa e moeda</Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {groups.map((group) => (
            <Table.Row key={group.group}>
              <Table.Cell>{group.group}</Table.Cell>
              <Table.Cell>
                {formatBalance(group.amountMinor, currency)}
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
    </div>
  );
}
const MonthlyChart = lazy<
  typeof import("./monthly-spending-chart").MonthlySpendingChart
>(async () => {
  const { data, error } = await tryCatch(
    () => import("./monthly-spending-chart"),
  );
  if (error) {
    return { default: ChartUnavailable };
  }
  return { default: data.MonthlySpendingChart };
});
type RecentRecords = z.infer<
  typeof PortalTransactionListSchema
>["data"]["records"];
export interface FinancialDashboardProps {
  categories: CategoryAppearance[];
  currency: string;
  monthly: FinancialSummary | null;
  overview: FinancialOverview;
  people: Array<{ id: string; name: string }>;
  recentScope?: string;
  records: RecentRecords;
  rulesHref?: string;
  transactionsHref: string;
}
export function FinancialDashboard({
  overview,
  monthly,
  currency,
  categories,
  people,
  records,
  transactionsHref,
  recentScope = "Todas as moedas · últimos registros recebidos no período",
  rulesHref,
}: FinancialDashboardProps) {
  const { accounts, bankBalance, total } = summaryCurrency(overview, currency);
  const groups = categoryVolumes(overview, currency);
  const unknown = total?.unknownAmountCount ?? 0;
  const emptyAmount = overview.partial ? null : "0";
  const income = total ? total.incomeMinor : emptyAmount;
  const expense = total ? total.expenseMinor : emptyAmount;
  const flow = total ? total.cashFlowMinor : emptyAmount;
  return (
    <div className="financial-dashboard">
      <section aria-labelledby="financial-summary-heading">
        <h2
          className="sr-only"
          id="financial-summary-heading"
        >
          Resumo financeiro
        </h2>
        <LayerCard className="financial-summary">
          <p className="summary-period">
            {dayLabel(overview.from)} a {dayLabel(overview.to)} · resumo do
            período
          </p>
          <dl className="financial-metrics">
            <FinancialMetric
              amount={bankBalance}
              currency={currency}
              hint="Última observação importada"
              label="Saldo bancário importado"
            />
            <FinancialMetric
              amount={income}
              currency={currency}
              hint="Categorias explícitas · no período"
              label="Receitas classificadas"
              tone="income"
            />
            <FinancialMetric
              amount={expense}
              currency={currency}
              hint="Estornos descontados · no período"
              label="Despesas classificadas"
              tone="expense"
            />
            <FinancialMetric
              amount={flow}
              currency={currency}
              hint="Entradas − saídas, só bancos"
              label="Fluxo bancário"
            />
          </dl>
          <p className="financial-summary-note">
            Registros até {dayLabel(overview.referenceDay)} · {currency}, sem
            conversão.
          </p>
          {!!total?.unclassifiedCount && (
            <p className="financial-summary-note">
              Movimentos sem classificação: {total.unclassifiedCount}. Fora das
              receitas e despesas.{" "}
              {!!rulesHref && <Link href={rulesHref}>Conferir regras</Link>}
            </p>
          )}
          {!!unknown && (
            <p className="financial-summary-note">
              Registros sem valor conhecido: {unknown}. Totais do período
              indisponíveis; os dados recebidos continuam consultáveis.
            </p>
          )}
          <DisclosureItem summary="Como este resumo é calculado">
            <p className="summary-policy">
              Somente registros confirmados até a data de referência. Ignorados,
              pendentes e futuros ficam fora dos agregados. Receitas e despesas
              usam categorias explícitas; transferências e pagamentos de fatura
              ficam fora dessas duas somas. Fluxo bancário usa entradas e saídas
              das contas bancárias. Parcelas são consideradas na data de cada
              lançamento recebido. Saldos são a última observação importada, não
              o fechamento do mês escolhido.
            </p>
          </DisclosureItem>
        </LayerCard>
      </section>
      <div className="financial-analysis-grid">
        <LayerCard className="analysis-card">
          <header className="analysis-heading">
            <h2>Despesas por categoria</h2>
            <span>{currency}</span>
          </header>
          <p className="analysis-caption">
            Categorias explícitas · estornos descontados
            {unknown > 0 ? " · valores conhecidos" : ""}
          </p>
          <div className="analysis-body">
            {groups.length ? (
              <>
                <CategoryRows
                  categories={categories}
                  currency={currency}
                  groups={groups.slice(0, 5)}
                />
                {groups.length > 5 && (
                  <DisclosureItem
                    summary={`Mais ${groups.length - 5} ${groups.length === 6 ? "categoria" : "categorias"}`}
                  >
                    <CategoryRows
                      categories={categories}
                      currency={currency}
                      groups={groups.slice(5)}
                    />
                  </DisclosureItem>
                )}
              </>
            ) : (
              <Empty
                description="Categorias de despesa aparecem aqui após a classificação dos dados recebidos."
                size="sm"
                title="Nenhuma despesa classificada"
              />
            )}
          </div>
          <p className="analysis-footnote">
            Barras comparam o volume absoluto observado; não representam cotas.
          </p>
        </LayerCard>
        <MonthlyAnalysis
          currency={currency}
          monthly={monthly}
        />
      </div>
      <section aria-labelledby="recent-transactions-heading">
        <header className="section-heading">
          <h2 id="recent-transactions-heading">Transações recentes</h2>
          <Link href={transactionsHref}>Ver todas</Link>
        </header>
        <p className="analysis-caption">{recentScope}</p>
        {records.length ? (
          <TransactionList
            accounts={overview.accounts}
            categories={categories}
            records={records}
            referenceDay={overview.referenceDay}
            showOwner={people.length > 1}
          />
        ) : (
          <Empty
            description="Escolha outro mês ou confira suas conexões."
            size="sm"
            title="Nenhuma transação neste período"
          />
        )}
      </section>
      <section aria-labelledby="financial-accounts-heading">
        <header className="section-heading">
          <h2 id="financial-accounts-heading">Contas e cartões</h2>
          <span className="section-context">
            Saldos separados dos movimentos do período
          </span>
        </header>
        <AccountBalances
          accounts={accounts}
          partial={overview.partial}
          people={people}
          transactionsHref={transactionsHref}
        />
      </section>
    </div>
  );
}
function MonthlyAnalysis({
  monthly,
  currency,
}: {
  monthly: FinancialSummary | null;
  currency: string;
}) {
  const groups = monthly?.groups;
  const monthlyGroups = useMemo(
    () =>
      (groups ?? [])
        .filter((group) => group.currency === currency)
        .toSorted((a, b) => a.group.localeCompare(b.group)),
    [currency, groups],
  );
  const monthlyUnknown =
    monthly?.totals.find((item) => item.currency === currency)
      ?.unknownAmountCount ?? 0;
  return (
    <LayerCard className="analysis-card">
      <header className="analysis-heading">
        <h2>Despesas por mês</h2>
        <span>{currency}</span>
      </header>
      <p className="analysis-caption">
        {monthly
          ? `${dayLabel(monthly.from)} a ${dayLabel(monthly.to)} · sem projeção`
          : "Série temporariamente indisponível"}
      </p>
      {!!monthly?.partial && (
        <p className="analysis-caption">
          Histórico parcial também nesta série.
        </p>
      )}
      {monthlyUnknown > 0 && (
        <p className="analysis-caption">
          {monthlyUnknown} registros sem valor. Gráfico e tabela mostram somente
          as despesas conhecidas.
        </p>
      )}
      <div className="analysis-body">
        {monthlyGroups.length ? (
          <Suspense
            fallback={
              <div className="chart-loading">
                <SkeletonLine
                  maxWidth={90}
                  minWidth={80}
                />
                <SkeletonLine
                  maxWidth={90}
                  minWidth={80}
                />
              </div>
            }
          >
            <MonthlyChart
              currency={currency}
              groups={monthlyGroups}
            />
          </Suspense>
        ) : (
          <Empty
            description={
              monthly
                ? "O gráfico aparece com despesas classificadas no período."
                : "O restante do resumo continua disponível. Use Atualizar para tentar novamente."
            }
            size="sm"
            title={monthly ? "Sem série recebida" : "Série indisponível"}
          />
        )}
      </div>
      {!!monthlyGroups.length && (
        <DisclosureItem summary="Ver valores exatos">
          <Table aria-label="Despesas mensais exatas">
            <Table.Header>
              <Table.Row>
                <Table.Head>Mês</Table.Head>
                <Table.Head>Despesa e moeda</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {monthlyGroups.map((group) => (
                <Table.Row key={group.group}>
                  <Table.Cell>{group.group}</Table.Cell>
                  <Table.Cell>
                    {formatBalance(group.amountMinor, currency)}
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </DisclosureItem>
      )}
    </LayerCard>
  );
}
function CategoryRows({
  groups,
  categories,
  currency,
}: {
  groups: ReturnType<typeof categoryVolumes>;
  categories: CategoryAppearance[];
  currency: string;
}) {
  return (
    <ul className="category-volumes">
      {groups.map((group) => {
        const category = categories.find((item) => item.id === group.group);
        return (
          <li
            key={group.group}
            style={{ color: category?.color ?? "var(--text)" }}
          >
            <Meter
              aria-label={`Volume de ${category?.name ?? "categoria não identificada"}`}
              customValue={formatBalance(group.amountMinor, currency)}
              indicatorClassName="category-volume-indicator"
              label={category?.name ?? "Categoria não identificada"}
              value={group.volume}
            />
          </li>
        );
      })}
    </ul>
  );
}
export function AccountBalances({
  accounts,
  people,
  partial,
  transactionsHref,
}: {
  accounts: FinancialOverview["accounts"];
  people: Array<{ id: string; name: string }>;
  partial: boolean;
  transactionsHref: string;
}) {
  return (
    <LayerCard
      aria-label="Contas e cartões"
      className="record-list"
      render={<ul />}
    >
      {accounts.map((account) => (
        <li key={account.id}>
          <DisclosureItem
            className="record-item"
            summary={
              <>
                <span className="record-title bank-heading">
                  <span className="financial-account-icon">
                    {account.type === "CREDIT" ? (
                      <CreditCardIcon
                        aria-hidden
                        size={20}
                      />
                    ) : (
                      <BankIcon
                        aria-hidden
                        size={20}
                      />
                    )}
                  </span>
                  {account.name}
                </span>
                <span className="record-value">
                  {formatBalance(account.balanceMinor, account.currency)}
                </span>
                <span className="record-meta">
                  {account.type === "CREDIT" && (
                    <span>Cartão · não é dinheiro disponível</span>
                  )}
                  <span>
                    {account.balanceObservedAt
                      ? `Saldo em ${dayLabel(account.balanceObservedAt.slice(0, 10))}`
                      : "Saldo sem data informada"}
                  </span>
                  {partial === true && (
                    <Badge variant="secondary">Dados parciais</Badge>
                  )}
                </span>
              </>
            }
          >
            <div className="record-detail">
              <dl className="detail-list">
                <div>
                  <dt>Titular</dt>
                  <dd>
                    {people.find((person) => person.id === account.personId)
                      ?.name ?? "Titular não identificado"}
                  </dd>
                </div>
                <div>
                  <dt>Origem</dt>
                  <dd>{account.manual ? "Conta manual" : "Conta importada"}</dd>
                </div>
              </dl>
              <Link
                href={`${transactionsHref}${transactionsHref.includes("?") ? "&" : "?"}${new URLSearchParams({ accountId: account.id })}`}
              >
                Ver transações desta conta
              </Link>
              <DisclosureItem summary="Referência técnica">
                <InlineCopyText
                  labels={{
                    copied: "Identificador copiado",
                    copyAction: "Copiar identificador",
                  }}
                >
                  {account.id}
                </InlineCopyText>
              </DisclosureItem>
            </div>
          </DisclosureItem>
        </li>
      ))}
    </LayerCard>
  );
}
