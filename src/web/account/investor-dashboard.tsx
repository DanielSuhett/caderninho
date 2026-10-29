import { Badge } from "@cloudflare/kumo/components/badge";
import { Empty } from "@cloudflare/kumo/components/empty";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import {
  lazy,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import type {
  InvestmentGroup,
  InvestmentList,
  InvestmentPortfolio,
  PortalResponse,
} from "../../contracts";
import { UNKNOWN_BANK_ID } from "../../domain";
import { tryCatch } from "../../shared";
import { formatBalance } from "../money";
import { MoneyValue } from "../money-value";
import { AccountAvatar, BankAvatar } from "./account-identity";
import { amountProportion, percentageLabel } from "./allocation-presentation";
import { AnalysisSection } from "./analysis-section";
import { ChartViewport } from "./chart-viewport";
import { DisclosureItem } from "./disclosure-item";
import { FinancialMetric } from "./financial-metric";
import { AvatarFilterRoute, avatarFilterHref } from "./identity-filters";
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
interface AllocationAction {
  href?: string;
  label: string;
  onSelect?: () => void;
  selected?: boolean;
}
function AllocationName({
  action,
  name,
}: {
  action: AllocationAction | null | undefined;
  name: string;
}) {
  if (!action) {
    return <>{name}</>;
  }
  const label = `${name}, ${action.label}`;
  if (action.href) {
    return (
      <a
        aria-current={action.selected ? "true" : undefined}
        aria-label={label}
        className="investor-legend-link"
        href={action.href}
      >
        {name}
      </a>
    );
  }
  return (
    <button
      aria-label={label}
      className="investor-legend-link"
      onClick={action.onSelect}
      type="button"
    >
      {name}
    </button>
  );
}
function Allocation({
  groups,
  currency,
  select,
  title,
  types = false,
}: {
  groups: InvestmentPortfolio["totals"][number]["byType"];
  currency: string;
  select?: (id: string) => AllocationAction | null;
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
    <AnalysisSection
      hint="Composição da posição bruta. Exclui posições resgatadas e fora do patrimônio."
      title={title}
    >
      <div className="cards-category-content">
        {complete && total > 0n ? (
          <div className="financial-donut">
            <ChartViewport height={240}>
              <Suspense fallback={<p role="status">Carregando gráfico…</p>}>
                <Chart
                  categories={slices}
                  currency={currency}
                  description={title}
                />
              </Suspense>
            </ChartViewport>
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
                <AllocationName
                  action={select?.(slice.id)}
                  name={slice.name}
                />
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
    </AnalysisSection>
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
    ["Atualização", row.date ? dayLabel(row.date) : "Não informada"],
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
function groupName(group: InvestmentGroup, rows: InvestmentList) {
  if (group.subtype && acronym.test(group.subtype)) {
    return group.subtype;
  }
  const [first] = rows;
  if (rows.length === 1 && first) {
    return first.name;
  }
  return investmentTypeNames[group.type] ?? group.type;
}
const acronym = /^[A-Z]{2,5}$/;
function groupAnchor(group: InvestmentGroup) {
  return `investment-group-${group.id.replace(/[^A-Za-z0-9]+/g, "-")}`;
}
function positionStatus(row: InvestmentList[number]) {
  return (
    <>
      {!row.included && <Badge>Fora do patrimônio</Badge>}
      {row.details?.status === "PENDING" && <Badge>Pendente</Badge>}
      {!!row.manual && <Badge>Manual</Badge>}
    </>
  );
}
function amountOf(row: InvestmentList[number]) {
  return row.amountMinor === null ? 0n : BigInt(row.amountMinor);
}
function byAmountDescending(
  left: InvestmentList[number],
  right: InvestmentList[number],
) {
  const a = amountOf(left);
  const b = amountOf(right);
  if (a === b) {
    return 0;
  }
  return a > b ? -1 : 1;
}
function DueDate({ date }: { date: string | null | undefined }) {
  return (
    <span className="cards-note">
      {date ? dayLabel(date) : "Sem vencimento"}
    </span>
  );
}
function ownerOf(
  people: PortalResponse["people"],
  showOwner: boolean,
  row: InvestmentList[number],
) {
  return showOwner && people.length > 1
    ? people.find((person) => person.id === row.personId)
    : undefined;
}
function PositionRow({
  row,
  currency,
  people,
  showOwner,
}: {
  row: InvestmentList[number];
  currency: string;
  people: PortalResponse["people"];
  showOwner: boolean;
}) {
  return (
    <LayerCard>
      <DisclosureItem
        className="investor-position"
        leading={
          <AccountAvatar
            account={row}
            person={ownerOf(people, showOwner, row)}
          />
        }
        summary={
          <span className="investor-position-grid">
            <span className="investor-position-identity">
              <span className="account-identity">{row.name}</span>
              <span className="investor-position-meta">
                {investmentTypeNames[row.type] ?? row.type}
                {positionStatus(row)}
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
              <small className="investor-mobile-label">Vencimento</small>
              <DueDate date={row.details?.dueDate} />
            </span>
          </span>
        }
      >
        <PositionDetails row={row} />
      </DisclosureItem>
      );
    </LayerCard>
  );
}
function CompactPosition({
  row,
  currency,
}: {
  row: InvestmentList[number];
  currency: string;
}) {
  const { purchaseDate, dueDate } = row.details ?? {};
  const dates = [
    purchaseDate ? dayLabel(purchaseDate) : null,
    dueDate ? dayLabel(dueDate) : "Sem vencimento",
  ].filter(Boolean);
  return (
    <li className="investor-compact">
      <span>{dates.join(" → ")}</span>
      <Money
        amount={row.amountMinor}
        currency={currency}
      />
    </li>
  );
}
function GroupRow({
  group,
  rows,
  currency,
  open,
  onToggle,
  people,
  showOwner,
}: {
  group: InvestmentGroup;
  rows: InvestmentList;
  currency: string;
  open: boolean;
  onToggle: (id: string, open: boolean) => void;
  people: PortalResponse["people"];
  showOwner: boolean;
}) {
  const groupId = group.id;
  const onOpenChange = useCallback(
    (next: boolean) => onToggle(groupId, next),
    [onToggle, groupId],
  );
  const unknown = group.gross.unknownCount;
  const [firstRow] = rows;
  const owner = firstRow && ownerOf(people, showOwner, firstRow);
  const meta = [
    owner?.name ?? null,
    `${group.count} ${group.count === 1 ? "posição" : "posições"}`,
    group.count === rows.length
      ? null
      : `${rows.length - group.count} fora do total`,
    group.banks.length === 1 ? group.banks[0]?.name : null,
    group.rateTypes.join(", ") || null,
  ].filter(Boolean);
  return (
    <div
      className="investor-group-anchor"
      id={groupAnchor(group)}
    >
      <LayerCard>
        <DisclosureItem
          className="investor-position investor-group"
          leading={<BankAvatar banks={group.banks} />}
          onOpenChange={onOpenChange}
          open={open}
          summary={
            <span className="investor-position-grid">
              <span className="investor-position-identity">
                <span className="account-identity">
                  {groupName(group, rows)}
                </span>
                <span className="investor-position-meta">
                  {meta.join(" · ")}
                </span>
              </span>
              <span>
                <small className="investor-mobile-label">Bruto</small>
                <Money
                  amount={group.gross.knownMinor}
                  currency={currency}
                />
                {!!unknown && <small>{unknown} sem valor</small>}
              </span>
              <span>
                <small className="investor-mobile-label">
                  Próximo vencimento
                </small>
                <DueDate date={group.nearestDueDate} />
              </span>
            </span>
          }
        >
          <ul className="investor-group-items">
            {rows.map((row) => (
              <CompactPosition
                currency={currency}
                key={row.id}
                row={row}
              />
            ))}
          </ul>
        </DisclosureItem>
      </LayerCard>
    </div>
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
  const rows = data.records.filter(
    (row) =>
      row.currency === currency && row.details?.status !== "TOTAL_WITHDRAWAL",
  );
  const groups = data.groups.filter((group) => group.currency === currency);
  const route = useContext(AvatarFilterRoute);
  const [openGroups, setOpenGroups] = useState<ReadonlySet<string>>(new Set());
  const [reveal, setReveal] = useState<{ id: string } | null>(null);
  useEffect(() => {
    if (!reveal) {
      return;
    }
    const anchor = document.getElementById(reveal.id);
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    anchor?.scrollIntoView({
      behavior: reduced ? "auto" : "smooth",
      block: "start",
    });
    anchor
      ?.querySelector<HTMLElement>(".disclosure-trigger")
      ?.focus({ preventScroll: true });
  }, [reveal]);
  const byId = new Map(rows.map((row) => [row.id, row]));
  const toggleGroup = useCallback((id: string, open: boolean) => {
    setOpenGroups((current) => {
      const next = new Set(current);
      if (open) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }, []);
  const selectType = useCallback(
    (type: string): AllocationAction | null => {
      const matching = groups.filter((group) => group.type === type);
      const [first] = matching;
      if (!first) {
        return null;
      }
      return {
        label: "mostrar posições",
        onSelect: () => {
          setOpenGroups((current) => {
            const next = new Set(current);
            for (const group of matching) {
              next.add(group.id);
            }
            return next;
          });
          setReveal({ id: groupAnchor(first) });
        },
      };
    },
    [groups],
  );
  const selectInstitution = useCallback(
    (institutionId: string): AllocationAction | null => {
      if (institutionId === UNKNOWN_BANK_ID || !route) {
        return null;
      }
      const target = avatarFilterHref(route, "institutionId", institutionId);
      if (!target) {
        return null;
      }
      return {
        href: target.href,
        label: target.selected ? "remover filtro" : "filtrar posições",
        selected: target.selected,
      };
    },
    [route],
  );
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
              select={selectType}
              title="Por classe"
              types
            />
            <Allocation
              currency={currency}
              groups={summary.byInstitution}
              select={selectInstitution}
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
          <span>Vencimento</span>
        </div>
        <div className="investor-position-list">
          {groups.map((group) => {
            const members = group.recordIds
              .flatMap((id) => {
                const row = byId.get(id);
                return row ? [row] : [];
              })
              .sort(byAmountDescending);
            if (!members.length) {
              return null;
            }
            const [only] = members;
            if (members.length === 1 && only) {
              return (
                <PositionRow
                  currency={currency}
                  key={group.id}
                  people={people}
                  row={only}
                  showOwner={showOwner}
                />
              );
            }
            return (
              <GroupRow
                currency={currency}
                group={group}
                key={group.id}
                onToggle={toggleGroup}
                open={openGroups.has(group.id)}
                people={people}
                rows={members}
                showOwner={showOwner}
              />
            );
          })}
        </div>
      </section>
    </div>
  );
}
