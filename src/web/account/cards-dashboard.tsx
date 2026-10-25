import { Badge, Empty, LayerCard, Link, Meter, Table } from "@cloudflare/kumo";
import { CreditCardIcon } from "@phosphor-icons/react";
import { lazy, Suspense, useMemo } from "react";

import type { PortalCards, WorkspaceCatalog } from "../../contracts";
import type { CardAmount } from "../../domain";
import { tryCatch } from "../../shared";
import { formatBalance } from "../money";
import { MoneyValue } from "../money-value";
import { cardPercentage } from "./card-presentation";
import { CategoryLabel } from "./category-appearance";
import { monthLabel } from "./dashboard-period";
import { DisclosureItem } from "./disclosure-item";
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
}: {
  label: string;
  amount: CardAmount;
  currency: string;
  hint: string;
}) {
  return (
    <div className="cards-metric">
      <dt>{label}</dt>
      <dd>{amountLabel(amount.totalMinor, currency)}</dd>
      <small>{hint}</small>
      {!!amount.unknownCount && (
        <small>
          {amount.unknownCount} sem valor · conhecidos:{" "}
          {amountLabel(amount.knownMinor, currency)}
        </small>
      )}
    </div>
  );
}
function LimitCard({
  account,
  showOwner,
}: {
  account: PortalCards["accounts"][number];
  showOwner: boolean;
}) {
  const percentage = cardPercentage(
    account.allocatedMinor,
    account.creditLimitMinor,
  );
  const excess =
    account.allocatedMinor !== null && BigInt(account.allocatedMinor) < 0n;
  return (
    <LayerCard className="cards-limit-card">
      <header className="cards-limit-heading">
        <CreditCardIcon
          aria-hidden
          size={20}
        />
        <div>
          <h3>
            {account.name}
            {account.cardNumber ? ` · ${account.cardNumber}` : ""}
          </h3>
          {showOwner ? (
            <p className="cards-note">{account.personName}</p>
          ) : null}
        </div>
      </header>
      <dl className="cards-limit-values">
        <div>
          <dt>Limite</dt>
          <dd>{amountLabel(account.creditLimitMinor, account.currency)}</dd>
        </div>
        <div>
          <dt>{excess ? "Crédito excedente" : "Alocado"}</dt>
          <dd>
            {amountLabel(
              excess
                ? (-BigInt(account.allocatedMinor ?? "0")).toString()
                : account.allocatedMinor,
              account.currency,
            )}
          </dd>
        </div>
        <div>
          <dt>Disponível</dt>
          <dd>{amountLabel(account.availableCreditMinor, account.currency)}</dd>
        </div>
      </dl>
      {!!percentage && !excess && (
        <Meter
          customValue={percentage.label}
          label="Ocupação do limite"
          value={percentage.meter}
        />
      )}
      {!percentage && (
        <p className="cards-note">
          {account.creditLimitMinor !== null &&
          BigInt(account.creditLimitMinor) <= 0n
            ? "Limite informado não é positivo; percentual indisponível."
            : "Ocupação indisponível: limite ou disponível não informado."}
        </p>
      )}
      <p className="cards-note">
        Última observação da conta: {momentLabel(account.balanceObservedAt)}
      </p>
      {!!(account.closeDate || account.dueDate) && (
        <p className="cards-note">
          {account.closeDate
            ? `Fechamento: ${dayLabel(account.closeDate)}`
            : "Fechamento não informado"}{" "}
          ·{" "}
          {account.dueDate
            ? `Vencimento: ${dayLabel(account.dueDate)}`
            : "Vencimento não informado"}
        </p>
      )}
    </LayerCard>
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
    <LayerCard className="cards-category-card">
      <header>
        <h2>Gastos por categoria</h2>
        <p className="cards-note">
          {monthLabel(data.month)} · compras confirmadas antes dos estornos
        </p>
      </header>
      {groups.length ? (
        <div className="cards-category-content">
          {hasValues && !data.purchases.unknownCount ? (
            <div className="cards-chart">
              <Suspense fallback={<p role="status">Carregando gráfico…</p>}>
                <CategoryChart
                  categories={categories}
                  currency={data.currency}
                  groups={groups}
                />
              </Suspense>
              <div className="cards-chart-center">
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
          <Table className="cards-category-table">
            <Table.Header>
              <Table.Row>
                <Table.Head>Categoria</Table.Head>
                <Table.Head>Valor</Table.Head>
                <Table.Head>Participação</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {groups.map((group) => (
                <Table.Row key={group.categoryId ?? "uncategorized"}>
                  <Table.Cell>
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
                  </Table.Cell>
                  <Table.Cell>
                    {amountLabel(group.totalMinor, data.currency)}
                  </Table.Cell>
                  <Table.Cell>
                    {cardPercentage(group.totalMinor, data.purchases.totalMinor)
                      ?.label ?? "Não informada"}
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
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
      <LayerCard className="cards-summary">
        <dl className="cards-metrics">
          <CardMetric
            amount={data.confirmed}
            currency={data.currency}
            hint="Compras menos estornos classificados"
            label="Gastos confirmados do mês"
          />
          <CardMetric
            amount={data.pending}
            currency={data.currency}
            hint="Data até hoje · aguardam confirmação"
            label="Pendentes no mês"
          />
          <CardMetric
            amount={data.future}
            currency={data.currency}
            hint="Data posterior a hoje · já recebidos"
            label="Futuros no mês"
          />
        </dl>
        {!!data.refunds.count && (
          <p className="cards-note">
            Compras: {amountLabel(data.purchases.totalMinor, data.currency)} ·
            estornos classificados:{" "}
            {amountLabel(data.refunds.totalMinor, data.currency)}.
          </p>
        )}
        <DisclosureItem summary="Como os valores são calculados">
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
      <section aria-labelledby="card-limits-heading">
        <header className="cards-section-heading">
          <h2 id="card-limits-heading">Limites informados</h2>
          <span>Últimos dados importados · não acompanham o mês escolhido</span>
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
        <p className="cards-note">
          Alocado = limite − disponível. Limites compartilhados entre cartões
          não são somados.
        </p>
      </section>
      <Categories
        categories={categories}
        data={data}
      />
      <section aria-labelledby="card-months-heading">
        <header className="cards-section-heading">
          <h2 id="card-months-heading">Parcelas por mês</h2>
          <span>12 meses · somente parcelas recebidas</span>
        </header>
        <LayerCard className="cards-table-card">
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
                <Table.Row key={month.month}>
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
        <p className="cards-note">
          — indica que nenhuma parcela foi recebida; não comprova ausência de
          compromisso. Parcelas não enviadas pelo banco não são projetadas.
        </p>
      </section>
      <section aria-labelledby="card-installments-heading">
        <header className="cards-section-heading">
          <h2 id="card-installments-heading">
            Parcelamentos em {monthLabel(data.month)}
          </h2>
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
