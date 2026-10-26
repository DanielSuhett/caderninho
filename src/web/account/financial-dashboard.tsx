import { Badge } from "@cloudflare/kumo/components/badge";
import { Empty } from "@cloudflare/kumo/components/empty";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Link } from "@cloudflare/kumo/components/link";
import { SkeletonLine } from "@cloudflare/kumo/components/loader";
import { Meter } from "@cloudflare/kumo/components/meter";
import { Table } from "@cloudflare/kumo/components/table";
import { ArrowRightIcon } from "@phosphor-icons/react";
import { lazy, Suspense, useMemo } from "react";
import type { z } from "zod/v4";

import type {
  FinancialOverview,
  FinancialSummary,
  PortalTransactionListSchema,
} from "../../contracts";
import { tryCatch } from "../../shared";
import { formatBalance } from "../money";
import { UiLink } from "../ui";
import { AccountAvatar } from "./account-identity";
import { AnalysisSection } from "./analysis-section";
import type { CategoryAppearance } from "./category-appearance";
import { ChartViewport } from "./chart-viewport";
import { DisclosureItem } from "./disclosure-item";
import { FinancialMetric } from "./financial-metric";
import { categoryVolumes, summaryCurrency } from "./financial-presentation";
import { InfoTip } from "./info-tip";
import type { MonthlySpendingChart } from "./monthly-spending-chart";
import { PersonIdentity } from "./person-identity";
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
const MonthlyChart = lazy<typeof MonthlySpendingChart>(async () => {
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
  showOwner?: boolean;
  transactionsHref: string;
}
export function FinancialDashboard({
  overview,
  monthly,
  currency,
  categories,
  people,
  showOwner = true,
  records,
  transactionsHref,
  recentScope = "Todas as moedas · últimos registros recebidos no período",
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
          <dl className="financial-metrics">
            <FinancialMetric
              amount={bankBalance}
              currency={currency}
              hint={`Última observação importada. Registros até ${dayLabel(overview.referenceDay)}; sem conversão de moedas.`}
              label="Saldo bancário importado"
            />
            <FinancialMetric
              amount={income}
              currency={currency}
              hint="Categorias explícitas no período. Ignorados, pendentes, futuros, transferências e pagamentos de fatura ficam fora."
              label="Receitas classificadas"
              tone="income"
            />
            <FinancialMetric
              amount={expense}
              currency={currency}
              hint="Categorias explícitas no período, com estornos descontados. Ignorados, pendentes, futuros, transferências e pagamentos de fatura ficam fora. Cada parcela conta na data do lançamento recebido."
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
          {!!unknown && (
            <p className="financial-summary-note">
              Registros sem valor conhecido: {unknown}. Totais do período
              indisponíveis; os dados recebidos continuam consultáveis.
            </p>
          )}
        </LayerCard>
      </section>
      <div className="financial-analysis-grid">
        <AnalysisSection
          currency={currency}
          hint={
            <>
              Categorias explícitas, com estornos descontados. Barras comparam o
              volume absoluto observado.{" "}
              {unknown > 0 ? "Somente valores conhecidos." : ""}
            </>
          }
          title="Despesas por categoria"
        >
          <div
            className={
              groups.length ? "analysis-body" : "analysis-body analysis-empty"
            }
          >
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
                className="border-0 bg-transparent shadow-none"
                contents={<Link href={transactionsHref}>Ver transações</Link>}
                size="sm"
                title="Nenhuma despesa classificada"
              />
            )}
          </div>
        </AnalysisSection>
        <MonthlyAnalysis
          currency={currency}
          monthly={monthly}
        />
      </div>
      <section aria-labelledby="recent-transactions-heading">
        <header className="section-heading">
          <h2 id="recent-transactions-heading">
            Transações recentes
            <InfoTip label="transações recentes">{recentScope}</InfoTip>
          </h2>
          <Link href={transactionsHref}>Ver todas</Link>
        </header>
        {records.length ? (
          <TransactionList
            accounts={overview.accounts}
            categories={categories}
            records={records}
            referenceDay={overview.referenceDay}
            showOwner={showOwner && people.length > 1}
          />
        ) : (
          <Empty
            className="border-0 bg-transparent shadow-none"
            description="Escolha outro mês ou confira suas conexões."
            size="sm"
            title="Nenhuma transação neste período"
          />
        )}
      </section>
      <section aria-labelledby="financial-accounts-heading">
        <header className="section-heading">
          <h2 id="financial-accounts-heading">Contas e cartões</h2>
          <InfoTip label="estes valores">
            Saldos separados dos movimentos do período
          </InfoTip>
        </header>
        <AccountBalances
          accounts={accounts}
          partial={overview.partial}
          people={people}
          showOwner={showOwner}
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
    <AnalysisSection
      currency={currency}
      hint={
        monthly
          ? `${dayLabel(monthly.from)} a ${dayLabel(monthly.to)} · sem projeção`
          : "Série temporariamente indisponível"
      }
      title="Despesas por mês"
    >
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
      <div
        className={
          monthlyGroups.length
            ? "analysis-body"
            : "analysis-body analysis-empty"
        }
      >
        {monthlyGroups.length ? (
          <ChartViewport height={320}>
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
                key={`${currency}:${monthly?.to}`}
              />
            </Suspense>
          </ChartViewport>
        ) : (
          <Empty
            className="border-0 bg-transparent shadow-none"
            description={
              monthly
                ? "Escolha outro período ou classifique os lançamentos."
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
    </AnalysisSection>
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
  showOwner = true,
  partial,
  transactionsHref,
}: {
  accounts: FinancialOverview["accounts"];
  people: Array<{ id: string; name: string }>;
  partial: boolean;
  showOwner?: boolean;
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
            leading={
              <AccountAvatar
                account={account}
                person={
                  showOwner && people.length > 1
                    ? people.find((person) => person.id === account.personId)
                    : undefined
                }
              />
            }
            summary={
              <>
                <span className="record-title bank-heading">
                  {account.name}
                </span>
                <span className="record-value">
                  {formatBalance(account.balanceMinor, account.currency)}
                </span>
                <span className="record-meta">
                  {!!account.manual && (
                    <Badge variant="secondary">Manual</Badge>
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
            <div className="record-detail account-balance-detail">
              <div className="record-owner">
                <span className="sr-only">Titular</span>
                <PersonIdentity
                  person={
                    people.find((person) => person.id === account.personId) ?? {
                      id: account.personId,
                      name: "Titular não identificado",
                    }
                  }
                />
              </div>
              <UiLink
                href={`${transactionsHref}${transactionsHref.includes("?") ? "&" : "?"}${new URLSearchParams({ accountId: account.id })}`}
                variant="outline"
              >
                Ver transações{" "}
                <ArrowRightIcon
                  aria-hidden
                  size={16}
                />
              </UiLink>
            </div>
          </DisclosureItem>
        </li>
      ))}
    </LayerCard>
  );
}
