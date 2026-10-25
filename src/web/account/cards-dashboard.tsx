import { Badge } from "@cloudflare/kumo/components/badge";
import { Empty } from "@cloudflare/kumo/components/empty";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Link } from "@cloudflare/kumo/components/link";
import { Table } from "@cloudflare/kumo/components/table";
import { lazy, Suspense, useMemo } from "react";

import type { PortalCards, WorkspaceCatalog } from "../../contracts";
import type { CardAmount } from "../../domain";
import { tryCatch } from "../../shared";
import { formatBalance, type MoneyTone } from "../money";
import { MoneyValue } from "../money-value";
import { cardPercentage } from "./card-presentation";
import { CategoryLabel } from "./category-appearance";
import { CreditLimitCard } from "./credit-limit-card";
import { monthLabel } from "./dashboard-period";
import { DisclosureItem } from "./disclosure-item";
import { FinancialMetric } from "./financial-metric";
import { InfoTip } from "./info-tip";
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
function LimitCard({
  account,
  showOwner,
}: {
  account: PortalCards["accounts"][number];
  showOwner: boolean;
}) {
  return (
    <CreditLimitCard
      allocated={account.allocatedMinor}
      available={account.availableCreditMinor}
      currency={account.currency}
      identity={account.identity}
      limit={account.creditLimitMinor}
      name={`${account.name}${account.cardNumber ? ` · ${account.cardNumber}` : ""}`}
      person={
        showOwner
          ? { id: account.personId, name: account.personName }
          : undefined
      }
    >
      <p>Atualizado em {momentLabel(account.balanceObservedAt)}</p>
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
    <LayerCard className="analysis-card cards-category-card">
      <header className="analysis-heading">
        <h2>Gastos por categoria</h2>
        <span>{data.currency}</span>
        <InfoTip label="este resumo">
          {monthLabel(data.month)} · compras confirmadas antes dos estornos
        </InfoTip>
      </header>
      {groups.length ? (
        <div className="cards-category-content">
          {hasValues && !data.purchases.unknownCount ? (
            <div className="financial-donut">
              <Suspense fallback={<p role="status">Carregando gráfico…</p>}>
                <CategoryChart
                  categories={categories}
                  currency={data.currency}
                  groups={groups}
                />
              </Suspense>
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
          description="Compras confirmadas de contas de cartão aparecem aqui, inclusive sem categoria."
          size="sm"
          title="Sem gastos confirmados neste mês"
        />
      )}
    </LayerCard>
  );
}
export function CardsDashboard({
  data,
  categories,
  accountId,
  monthHref,
  showOwner,
  nextHref,
}: {
  data: PortalCards;
  categories: WorkspaceCatalog["categories"];
  accountId: string;
  monthHref: (month: string) => string;
  showOwner: boolean;
  nextHref: string | null;
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
            hint="Compras menos estornos classificados"
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
        <DisclosureItem summary="Critérios">
          <p className="cards-note">
            Somente contas categorizadas como cartão (CREDIT), no grupo e pessoa
            escolhidos. Gastos confirmados usam lançamentos POSTED até{" "}
            {dayLabel(data.referenceDay)}. Compras sem categoria entram no
            total; créditos só descontam quando classificados como despesa.
            Transferências, pagamentos de fatura e ignorados ficam fora. Cada
            parcela conta na data do lançamento recebido, nunca pelo valor total
            da compra. Pendentes e futuros ficam separados, sem somar duas
            vezes. A rosca mostra compras antes dos estornos; não representa a
            ocupação do limite. Valores em {data.currency}, sem conversão.
          </p>
        </DisclosureItem>
      </LayerCard>
      <div className="card-analysis-grid">
        <Categories
          categories={categories}
          data={data}
        />
        <LayerCard
          aria-labelledby="card-months-heading"
          className="analysis-card cards-months"
        >
          <header className="analysis-heading">
            <h2 id="card-months-heading">Parcelas por mês</h2>
            <span>{data.currency}</span>
            <InfoTip label="parcelas por mês">
              12 meses · somente parcelas recebidas. Ausência de registros não
              comprova ausência de compromisso.
            </InfoTip>
          </header>
          <Table className="cards-months-table">
            <Table.Header>
              <Table.Row>
                <Table.Head>Mês</Table.Head>
                <Table.Head>Confirmadas</Table.Head>
                <Table.Head>Pendentes</Table.Head>
                <Table.Head>Futuras</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {data.months.map((month) => (
                <Table.Row
                  className="even:bg-transparent"
                  key={month.month}
                >
                  <Table.Cell>
                    <Link
                      aria-current={
                        month.month === data.month ? "date" : undefined
                      }
                      href={monthHref(month.month)}
                    >
                      {monthLabel(month.month)}
                    </Link>
                  </Table.Cell>
                  {month.confirmed.count +
                  month.pending.count +
                  month.future.count ? (
                    (["confirmed", "pending", "future"] as const).map(
                      (state) => (
                        <Table.Cell
                          data-label={
                            {
                              confirmed: "Confirmadas",
                              future: "Futuras",
                              pending: "Pendentes",
                            }[state]
                          }
                          key={state}
                        >
                          {month[state].count ? (
                            <>
                              {amountLabel(
                                month[state].totalMinor,
                                data.currency,
                              )}{" "}
                              <span className="cards-count">
                                {month[state].count}{" "}
                                {month[state].count === 1
                                  ? "parcela"
                                  : "parcelas"}
                              </span>
                            </>
                          ) : (
                            <span className="cards-empty">
                              <span aria-hidden>—</span>
                              <span className="sr-only">
                                Sem parcelas recebidas
                              </span>
                            </span>
                          )}
                        </Table.Cell>
                      ),
                    )
                  ) : (
                    <Table.Cell colSpan={3}>Sem parcelas recebidas</Table.Cell>
                  )}
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </LayerCard>
      </div>
      <section aria-labelledby="card-limits-heading">
        <header className="section-heading">
          <h2 id="card-limits-heading">Limites informados</h2>
          <InfoTip label="estes valores">
            Última observação importada, fora do recorte mensal. Ocupado =
            limite − disponível. Limites compartilhados não são somados.
          </InfoTip>
        </header>
        {visibleAccounts.length ? (
          <div className="cards-limits">
            {visibleAccounts.map((account) => (
              <LimitCard
                account={account}
                key={account.id}
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
      <section aria-labelledby="card-installments-heading">
        <header className="section-heading">
          <h2 id="card-installments-heading">Parcelamentos</h2>
        </header>
        {data.installments.length ? (
          <LayerCard className="cards-installments">
            {data.installments.map((row) => (
              <DisclosureItem
                key={row.id}
                summary={
                  <span className="cards-installment-summary">
                    <span>
                      <span className="cards-purchase-name">
                        {row.description}
                      </span>
                      <span className="cards-note">
                        Parcela {row.installmentNumber} de{" "}
                        {row.totalInstallments} · {dayLabel(row.date)}
                      </span>
                    </span>
                    <span className="cards-installment-amount">
                      {amountLabel(row.amountMinor, data.currency)}
                      <Badge
                        variant={
                          row.status === "confirmed" ? "secondary" : "outline"
                        }
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
                }
              >
                <dl className="cards-installment-details">
                  <div>
                    <dt>Cartão</dt>
                    <dd>
                      {data.accounts.find(
                        (account) => account.id === row.accountId,
                      )?.name ?? "Cartão"}
                      {row.cardNumber ? ` · ${row.cardNumber}` : ""}
                    </dd>
                  </div>
                  <div>
                    <dt>Compra original</dt>
                    <dd>
                      {row.purchaseDate
                        ? dayLabel(row.purchaseDate)
                        : "Data não informada"}
                    </dd>
                  </div>
                  <div>
                    <dt>Categoria</dt>
                    <dd>
                      <CategoryLabel
                        category={categories.find(
                          (category) => category.id === row.categoryId,
                        )}
                        label={
                          categories.find(
                            (category) => category.id === row.categoryId,
                          )?.name ?? "Sem categoria"
                        }
                      />
                    </dd>
                  </div>
                </dl>
                <p className="cards-note">
                  Confirmação do lançamento não comprova pagamento da fatura.
                  Consulte outros meses na tabela acima.
                </p>
              </DisclosureItem>
            ))}
          </LayerCard>
        ) : (
          <Empty
            description="Escolha outro mês na tabela ou confira suas conexões."
            size="sm"
            title="Nenhuma parcela recebida neste mês"
          />
        )}
        {!!nextHref && <Link href={nextHref}>Mais parcelas deste mês</Link>}
      </section>
    </div>
  );
}
