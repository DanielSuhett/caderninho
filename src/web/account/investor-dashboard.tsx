import { Badge, Empty, LayerCard } from "@cloudflare/kumo";
import { lazy, Suspense } from "react";

import type {
  InvestmentList,
  InvestmentPortfolio,
  PortalResponse,
} from "../../contracts";
import { tryCatch } from "../../shared";
import { formatBalance } from "../money";
import { MoneyValue } from "../money-value";
import { AccountIdentity } from "./account-identity";
import { amountProportion, percentageLabel } from "./allocation-presentation";
import { DisclosureItem } from "./disclosure-item";
import { FinancialMetric } from "./financial-metric";
import { InfoTip } from "./info-tip";
import { dayLabel } from "./workspace-resource";

export const investmentTypeNames: Record<string, string | undefined> = {
  COE: "COEs",
  EQUITY: "Ações",
  ETF: "ETFs",
  FIXED_INCOME: "Renda fixa",
  MUTUAL_FUND: "Fundos",
  OTHER: "Outros",
  SECURITY: "Previdência e títulos",
};
const colors = [
  "#3b82f6",
  "#14b8a6",
  "#a78bfa",
  "#f59e0b",
  "#ec4899",
  "#64748b",
];
const typeColors: Record<string, string | undefined> = {
  COE: colors[5],
  EQUITY: colors[3],
  ETF: colors[2],
  FIXED_INCOME: colors[0],
  MUTUAL_FUND: colors[1],
  SECURITY: colors[4],
};
function allocationColor(id: string, types: boolean) {
  if (types) {
    return typeColors[id] ?? "#64748b";
  }
  const seed = Array.from(id).reduce(
    (sum, character) => sum + character.charCodeAt(0),
    0,
  );
  return colors[seed % colors.length] ?? "#64748b";
}
const Chart = lazy(async () => {
  const { data, error } = await tryCatch(() => import("./allocation-chart"));
  return { default: error ? ChartUnavailable : data.AllocationChart };
});
function ChartUnavailable() {
  return <p>Consulte os valores na legenda.</p>;
}
function Money({
  amount,
  currency,
}: {
  amount: string | null | undefined;
  currency: string;
}) {
  return amount === null || amount === undefined ? (
    <>Não informado</>
  ) : (
    <MoneyValue value={formatBalance(amount, currency)} />
  );
}
function Allocation({
  groups,
  currency,
  title,
  types = false,
}: {
  groups: InvestmentPortfolio["totals"][number]["byType"];
  currency: string;
  title: string;
  types?: boolean;
}) {
  const slices = groups.map((row) => ({
    amountMinor: row.knownMinor,
    color: allocationColor(row.id, types),
    id: row.id,
    name: types ? (investmentTypeNames[row.name] ?? row.name) : row.name,
  }));
  const total = groups.reduce((sum, row) => sum + BigInt(row.knownMinor), 0n);
  const complete = !groups.some(
    (row) => row.unknownCount || BigInt(row.knownMinor) < 0n,
  );
  return (
    <LayerCard className="analysis-card cards-category-card">
      <header className="analysis-heading">
        <h2>{title}</h2>
        <InfoTip label={title}>
          Composição da posição bruta. Exclui posições resgatadas e fora do
          patrimônio.
        </InfoTip>
      </header>
      <div className="cards-category-content">
        {complete && total > 0n ? (
          <div className="financial-donut">
            <Suspense fallback={<p role="status">Carregando gráfico…</p>}>
              <Chart
                categories={slices}
                currency={currency}
                description={title}
              />
            </Suspense>
            <div className="financial-donut-center">
              <span>{groups.length}</span>
              <span className="cards-note">
                {types ? "classes" : "instituições"}
              </span>
            </div>
          </div>
        ) : (
          <p className="cards-note">Sem composição completa disponível.</p>
        )}
        <ul className="financial-category-legend">
          {slices.map((slice) => (
            <li
              className="financial-category-row"
              key={slice.id}
            >
              <span className="investor-legend-name">
                <span
                  className="investor-dot"
                  style={{ backgroundColor: slice.color }}
                />
                {slice.name}
              </span>
              <span className="financial-category-amount">
                <Money
                  amount={
                    groups.find((group) => group.id === slice.id)?.totalMinor
                  }
                  currency={currency}
                />
                {complete && total > 0n && (
                  <small>
                    {percentageLabel(
                      amountProportion(slice.amountMinor, total.toString()),
                    )}
                  </small>
                )}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </LayerCard>
  );
}
function PositionDetails({ row }: { row: InvestmentList[number] }) {
  const { details } = row;
  const fields = [
    [
      "Aplicado",
      <Money
        amount={details?.originalMinor}
        currency={row.currency}
        key="originalMinor"
      />,
    ],
    [
      "Líquido",
      <Money
        amount={details?.balanceMinor}
        currency={row.currency}
        key="balanceMinor"
      />,
    ],
    [
      "Resgate disponível",
      <Money
        amount={details?.withdrawalMinor}
        currency={row.currency}
        key="withdrawalMinor"
      />,
    ],
    [
      "Imposto de renda",
      <Money
        amount={details?.incomeTaxMinor}
        currency={row.currency}
        key="incomeTaxMinor"
      />,
    ],
    [
      "Impostos financeiros",
      <Money
        amount={details?.financialTaxMinor}
        currency={row.currency}
        key="financialTaxMinor"
      />,
    ],
    [
      "Vencimento",
      details?.dueDate ? dayLabel(details.dueDate) : "Não informado",
    ],
    [
      "Aplicação",
      details?.purchaseDate ? dayLabel(details.purchaseDate) : "Não informada",
    ],
    ["Emissor", details?.issuer ?? "Não informado"],
    ["Quantidade", details?.quantity ?? "Não informada"],
    ["Indexador", details?.rateType ?? "Não informado"],
    ["Taxa contratada", details?.rate ? `${details.rate}%` : "Não informada"],
    [
      "Taxa fixa anual",
      details?.fixedAnnualRate
        ? `${details.fixedAnnualRate}%`
        : "Não informada",
    ],
    [
      "Último mês",
      details?.lastMonthRate ? `${details.lastMonthRate}%` : "Não informado",
    ],
    [
      "Últimos 12 meses",
      details?.lastTwelveMonthsRate
        ? `${details.lastTwelveMonthsRate}%`
        : "Não informado",
    ],
    [
      "Ano anterior",
      details?.annualRate ? `${details.annualRate}%` : "Não informado",
    ],
  ] as const;
  return (
    <dl className="investor-details">
      {fields.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
export function InvestorDashboard({
  data,
  currency,
  people,
  showOwner = true,
}: {
  data: InvestmentPortfolio;
  currency: string;
  people: PortalResponse["people"];
  showOwner?: boolean;
}) {
  const summary = data.totals.find((row) => row.currency === currency);
  const rows = data.records.filter((row) => row.currency === currency);
  if (!rows.length) {
    return (
      <Empty
        size="sm"
        title="Nenhum investimento neste recorte"
      />
    );
  }
  return (
    <div className="investor-dashboard">
      {!!summary && (
        <>
          <LayerCard className="financial-surface">
            <dl className="investor-kpis">
              {[
                {
                  hint: "Valor informado antes de impostos.",
                  key: "gross",
                  label: "Posição bruta",
                  metric: summary.gross,
                },
                {
                  hint: "Valor após taxas e impostos informado pela instituição.",
                  key: "net",
                  label: "Posição líquida",
                  metric: summary.net,
                },
                {
                  hint: "Ganho ou perda acumulado informado pela instituição. Não é rentabilidade calculada pelo Caderninho.",
                  key: "profit",
                  label: "Resultado informado",
                  metric: summary.profit,
                },
                {
                  hint: "Valor disponível para resgate informado pela instituição; não garante liquidez imediata.",
                  key: "withdrawal",
                  label: "Resgate disponível",
                  metric: summary.withdrawal,
                },
              ].map(({ key, label, hint, metric }) => (
                <FinancialMetric
                  amount={metric.totalMinor}
                  currency={currency}
                  hint={hint}
                  key={key}
                  label={label}
                >
                  {!!metric.unknownCount && (
                    <small>
                      {metric.unknownCount} sem valor · conhecido:{" "}
                      <Money
                        amount={metric.knownMinor}
                        currency={currency}
                      />
                    </small>
                  )}
                </FinancialMetric>
              ))}
            </dl>
          </LayerCard>
          <div className="investor-analysis-grid">
            <Allocation
              currency={currency}
              groups={summary.byType}
              title="Por classe"
              types
            />
            <Allocation
              currency={currency}
              groups={summary.byInstitution}
              title="Por instituição"
            />
          </div>
        </>
      )}
      <section className="investor-positions">
        <header className="analysis-heading">
          <h2>Posições</h2>
          <span>{rows.length}</span>
        </header>
        <div
          aria-hidden="true"
          className="investor-position-head"
        >
          <span>Ativo</span>
          <span>Bruto</span>
          <span>Resultado</span>
          <span>Atualização</span>
        </div>
        {rows.map((row) => (
          <DisclosureItem
            className="investor-position"
            key={row.id}
            summary={
              <span className="investor-position-grid">
                <span className="investor-position-identity">
                  <AccountIdentity
                    account={row}
                    person={
                      showOwner && people.length > 1
                        ? people.find((person) => person.id === row.personId)
                        : undefined
                    }
                  />
                  <span className="investor-position-meta">
                    {investmentTypeNames[row.type] ?? row.type}
                    {row.details?.status === "TOTAL_WITHDRAWAL" && (
                      <Badge>Resgatado</Badge>
                    )}
                    {!row.included && <Badge>Fora do patrimônio</Badge>}
                    {row.details?.status === "PENDING" && (
                      <Badge>Pendente</Badge>
                    )}
                    {!!row.manual && <Badge>Manual</Badge>}
                  </span>
                </span>
                <span>
                  <small className="investor-mobile-label">Bruto</small>
                  <Money
                    amount={row.amountMinor}
                    currency={currency}
                  />
                </span>
                <span>
                  <small className="investor-mobile-label">Resultado</small>
                  <Money
                    amount={row.details?.profitMinor}
                    currency={currency}
                  />
                </span>
                <span className="cards-note">
                  {row.date ? dayLabel(row.date) : "Data não informada"}
                </span>
              </span>
            }
          >
            <PositionDetails row={row} />
          </DisclosureItem>
        ))}
      </section>
    </div>
  );
}
