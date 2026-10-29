import { Badge } from "@cloudflare/kumo/components/badge";
import { Empty } from "@cloudflare/kumo/components/empty";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Link } from "@cloudflare/kumo/components/link";
import { SkeletonLine } from "@cloudflare/kumo/components/loader";
import { Meter } from "@cloudflare/kumo/components/meter";
import { Table } from "@cloudflare/kumo/components/table";
import { lazy, type ReactNode, Suspense, useMemo } from "react";
import type { z } from "zod/v4";

import type {
  FinancialOverview,
  FinancialSummary,
  PortalTransactionListSchema,
} from "../../contracts";
import { AccountType } from "../../domain";
import { tryCatch } from "../../shared";
import { formatBalance, transactionTone } from "../money";
import { MoneyValue } from "../money-value";
import { AccountAvatar } from "./account-identity";
import { AnalysisSection } from "./analysis-section";
import type { CategoryAppearance } from "./category-appearance";
import { ChartViewport } from "./chart-viewport";
import { DisclosureItem } from "./disclosure-item";
import { FinancialMetric } from "./financial-metric";
import { categoryVolumes, summaryCurrency } from "./financial-presentation";
import { InfoTip } from "./info-tip";
import type { MonthlySpendingChart } from "./monthly-spending-chart";
import { amountLabel, TransactionAmount } from "./transaction-list";
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
      <MonthlyTable
        currency={currency}
        groups={groups}
      />
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
type OverviewAccount = FinancialOverview["accounts"][number];
type People = Array<{ id: string; name: string }>;
export interface FinancialDashboardProps {
  categories: CategoryAppearance[];
  currency: string;
  monthly: FinancialSummary | null;
  overview: FinancialOverview;
  people: People;
  recentScope?: string;
  records: RecentRecords;
  showOwner?: boolean;
  transactionsHref: string;
}
function accountHref(transactionsHref: string, accountId: string) {
  const separator = transactionsHref.includes("?") ? "&" : "?";
  return `${transactionsHref}${separator}${new URLSearchParams({ accountId })}`;
}
function sumMinor(values: Array<string | null | undefined>) {
  if (values.some((value) => value === null || value === undefined)) {
    return null;
  }
  return values
    .reduce((sum, value) => sum + BigInt(value ?? "0"), 0n)
    .toString();
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
  const { accounts, total } = summaryCurrency(overview, currency);
  const groups = categoryVolumes(overview, currency);
  const unknown = total?.unknownAmountCount ?? 0;
  const emptyAmount = overview.partial ? null : "0";
  const income = total ? total.incomeMinor : emptyAmount;
  const expense = total ? total.expenseMinor : emptyAmount;
  const flow = total ? total.cashFlowMinor : emptyAmount;
  const owners = showOwner && people.length > 1 ? people : [];
  return (
    <div className="financial-dashboard">
      <AccountHoldings
        accounts={accounts}
        currency={currency}
        partial={overview.partial}
        people={owners}
        referenceDay={overview.referenceDay}
        transactionsHref={transactionsHref}
      />
      <section aria-labelledby="financial-summary-heading">
        <h2
          className="sr-only"
          id="financial-summary-heading"
        >
          Movimento do período
        </h2>
        <LayerCard className="financial-summary">
          <dl className="financial-metrics financial-metrics-three">
            <FinancialMetric
              amount={income}
              currency={currency}
              hint="Categorias explícitas no período. Ignorados, pendentes, futuros, transferências e pagamentos de fatura ficam fora."
              label="Receitas"
              tone="income"
            />
            <FinancialMetric
              amount={expense}
              currency={currency}
              hint="Categorias explícitas no período, com estornos descontados. Ignorados, pendentes, futuros, transferências e pagamentos de fatura ficam fora. Cada parcela conta na data do lançamento recebido."
              label="Despesas"
              tone="expense"
            />
            <FinancialMetric
              amount={flow}
              currency={currency}
              hint={
                unknown
                  ? `Entradas − saídas, só bancos. ${unknown} registros sem valor conhecido deixam os totais indisponíveis.`
                  : "Entradas − saídas, só bancos"
              }
              label="Fluxo bancário"
            />
          </dl>
        </LayerCard>
      </section>
      <MonthlyAnalysis
        currency={currency}
        monthly={monthly}
      />
      <div className="financial-analysis-grid">
        <AnalysisSection
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
        <section
          aria-labelledby="recent-transactions-heading"
          className="analysis-section"
        >
          <header className="section-heading analysis-heading">
            <h2 id="recent-transactions-heading">
              Recentes
              <InfoTip label="transações recentes">{recentScope}</InfoTip>
            </h2>
            <Link href={transactionsHref}>Ver todas</Link>
          </header>
          <LayerCard className="analysis-card recent-card">
            {records.length ? (
              <ul className="recent-list">
                {records.slice(0, 6).map((row) => (
                  <li
                    className="recent-row"
                    key={row.id}
                  >
                    <time
                      className="recent-date"
                      dateTime={row.date}
                    >
                      {dayLabel(row.date).slice(0, 5)}
                    </time>
                    <span className="recent-description">
                      {row.description}
                    </span>
                    <span className="recent-amount">
                      <TransactionAmount
                        amount={amountLabel(row)}
                        available={row.amountMinor !== null}
                        tone={transactionTone(row)}
                      />
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty
                className="border-0 bg-transparent shadow-none"
                description="Escolha outro mês ou confira suas conexões."
                size="sm"
                title="Nenhuma transação neste período"
              />
            )}
          </LayerCard>
        </section>
      </div>
    </div>
  );
}
export function AccountHoldings({
  accounts,
  currency,
  partial,
  people,
  referenceDay,
  transactionsHref,
}: {
  accounts: OverviewAccount[];
  currency: string;
  partial: boolean;
  /** People shown on avatars; empty when ownership is not ambiguous. */
  people: People;
  referenceDay: string;
  transactionsHref: string;
}) {
  const banks = accounts.filter((account) => account.type === AccountType.BANK);
  const cards = accounts.filter(
    (account) => account.type === AccountType.CREDIT,
  );
  const bankBalance = banks.length
    ? sumMinor(banks.map((account) => account.balanceMinor))
    : null;
  return (
    <section
      aria-labelledby="financial-accounts-heading"
      className="holdings"
    >
      <h2
        className="sr-only"
        id="financial-accounts-heading"
      >
        Contas e cartões
      </h2>
      <HoldingPanel
        currency={currency}
        empty="Nenhuma conta conectada"
        hint={`Saldo da última observação importada, até ${dayLabel(referenceDay)}. Sem conversão de moedas.`}
        title="Contas"
        total={bankBalance}
        totalLabel="Saldo"
      >
        {banks.map((account) => (
          <BankRow
            account={account}
            href={accountHref(transactionsHref, account.id)}
            key={account.id}
            owners={people}
            partial={partial}
          />
        ))}
      </HoldingPanel>
      <HoldingPanel
        currency={currency}
        empty="Nenhum cartão conectado"
        hint="Valor da última fatura fechada de cada cartão. A fatura atual aparece como em fechamento. A barra mostra o uso do limite, quando conhecido."
        title="Cartões"
        total={sumMinor(
          cards.flatMap((card) =>
            card.lastBill?.amountMinor ? [card.lastBill.amountMinor] : [],
          ),
        )}
        totalLabel="Faturas fechadas"
      >
        {cards.map((account) => (
          <CardRow
            account={account}
            href={accountHref(transactionsHref, account.id)}
            key={account.id}
            owners={people}
            partial={partial}
          />
        ))}
      </HoldingPanel>
    </section>
  );
}
function HoldingPanel({
  title,
  totalLabel,
  total,
  currency,
  hint,
  empty,
  children,
}: {
  title: string;
  totalLabel: string;
  total: string | null;
  currency: string;
  hint: string;
  empty: string;
  children: ReactNode[];
}) {
  return (
    <LayerCard className="holding-panel">
      <header className="holding-header">
        <h3>
          {title}
          <InfoTip label={title}>{hint}</InfoTip>
        </h3>
        <p className="holding-total">
          <span className="holding-total-label">{totalLabel}</span>
          <strong className="holding-total-value">
            {total === null ? (
              "Indisponível"
            ) : (
              <MoneyValue value={formatBalance(total, currency)} />
            )}
          </strong>
        </p>
      </header>
      {children.length ? (
        <ul className="holding-list">{children}</ul>
      ) : (
        <p className="holding-empty">{empty}</p>
      )}
    </LayerCard>
  );
}
function BankRow({
  account,
  href,
  owners,
  partial,
}: {
  account: OverviewAccount;
  href: string;
  owners: People;
  partial: boolean;
}) {
  return (
    <li className="holding-item">
      <a
        className="holding-row"
        href={href}
      >
        <AccountAvatar
          account={account}
          filterable={false}
          person={owners.find((person) => person.id === account.personId)}
        />
        <span className="holding-name">
          <span className="bank-heading">{account.name}</span>
          <span className="holding-meta">
            {account.balanceObservedAt
              ? `Saldo em ${dayLabel(account.balanceObservedAt.slice(0, 10))}`
              : "Saldo sem data"}
            {!!account.manual && <Badge variant="secondary">Manual</Badge>}
            {partial ? <Badge variant="secondary">Dados parciais</Badge> : null}
          </span>
        </span>
        <span className="holding-value">
          {account.balanceMinor === null ? (
            "Indisponível"
          ) : (
            <MoneyValue
              value={formatBalance(account.balanceMinor, account.currency)}
            />
          )}
        </span>
      </a>
    </li>
  );
}
function closingLabel(closing: boolean | undefined) {
  if (closing === false) {
    return "Sem fatura no período";
  }
  return "Em fechamento";
}
function CardRow({
  account,
  href,
  owners,
  partial,
}: {
  account: OverviewAccount;
  href: string;
  owners: People;
  partial: boolean;
}) {
  const limit = account.creditLimitMinor
    ? BigInt(account.creditLimitMinor)
    : 0n;
  const owed = account.balanceMinor ? BigInt(account.balanceMinor) : 0n;
  const ratio: bigint = limit > 0n ? (owed * 100n) / limit : -1n;
  const used = ratio < 0n ? null : Math.min(100, Number(ratio));
  return (
    <li className="holding-item">
      <a
        className="holding-row"
        href={href}
      >
        <AccountAvatar
          account={account}
          filterable={false}
          person={owners.find((person) => person.id === account.personId)}
        />
        <span className="holding-name">
          <span className="bank-heading">{account.name}</span>
          <span className="holding-meta">
            {account.lastBill
              ? `Vence ${dayLabel(account.lastBill.dueDate)}`
              : closingLabel(account.billClosing)}
            {partial ? <Badge variant="secondary">Dados parciais</Badge> : null}
          </span>
          {used !== null && (
            <span
              aria-hidden="true"
              className="holding-usage"
              data-high={used >= 80}
            >
              <span
                className="holding-usage-fill"
                style={{ inlineSize: `${used}%` }}
              />
            </span>
          )}
        </span>
        <span
          className="holding-value"
          data-money-tone={
            account.lastBill?.amountMinor ? "expense" : "neutral"
          }
        >
          {account.lastBill?.amountMinor ? (
            <MoneyValue
              value={formatBalance(
                account.lastBill.amountMinor,
                account.currency,
              )}
            />
          ) : (
            "—"
          )}
        </span>
      </a>
    </li>
  );
}
function MonthlyTable({
  groups,
  currency,
}: {
  groups: FinancialSummary["groups"];
  currency: string;
}) {
  return (
    <Table aria-label="Despesas mensais exatas">
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
  const hint = monthly
    ? `${dayLabel(monthly.from)} a ${dayLabel(monthly.to)}. Despesas classificadas, sem projeção; o mês atual ainda está em andamento.${monthly.partial ? " Histórico parcial." : ""}${monthlyUnknown ? ` ${monthlyUnknown} registros sem valor ficam de fora.` : ""}`
    : "Série temporariamente indisponível";
  return (
    <AnalysisSection
      hint={hint}
      title="Despesas mês a mês"
    >
      <div
        className={
          monthlyGroups.length
            ? "analysis-body"
            : "analysis-body analysis-empty"
        }
      >
        {monthlyGroups.length ? (
          <ChartViewport height={280}>
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
                endMonth={(monthly?.to ?? "").slice(0, 7)}
                groups={monthlyGroups}
                key={`${currency}:${monthly?.to}`}
                {...(monthly && { referenceDay: monthly.referenceDay })}
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
          <MonthlyTable
            currency={currency}
            groups={monthlyGroups}
          />
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
