import { type SyntheticEvent, useCallback, useMemo, useState } from "react";

import type { FinancialSummary } from "../../contracts";
import { formatAmount, formatBalance } from "../money";
import { MoneyValue } from "../money-value";
import { shiftMonth } from "./dashboard-period";
import { safeChartValues } from "./financial-presentation";
import { useWidth } from "./svg-chart";

const shortMonth = new Intl.DateTimeFormat("pt-BR", {
  month: "short",
  timeZone: "UTC",
});
const longMonth = new Intl.DateTimeFormat("pt-BR", {
  month: "long",
  timeZone: "UTC",
  year: "numeric",
});
const wholeCents = /,00$/u;
const plotHeight = 200;
const inset = { bottom: 28, left: 64, right: 16, top: 12 } as const;
// Round axis ceiling (1, 2 or 5 × 10^n) so the grid labels stay readable.
function niceCeiling(value: number) {
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const factor = [1, 2, 5, 10].find((item) => item * magnitude >= value) ?? 10;
  return factor * magnitude;
}
const monthDate = (month: string) => new Date(`${month}-01T12:00:00Z`);

const windowMonths = 12;
// Fixed 12-month axis ending at the shown month; months without classified
// expense show as zero.
function monthSeries(groups: FinancialSummary["groups"], endMonth: string) {
  const amounts = new Map(groups.map((group) => [group.group, group]));
  const currency = groups[0]?.currency ?? "";
  return Array.from({ length: windowMonths }, (_, index) => {
    const month = shiftMonth(endMonth, index - windowMonths + 1);
    return amounts.get(month) ?? { amountMinor: "0", currency, group: month };
  });
}

function percentChange(value: number, base: number) {
  if (!base) {
    return null;
  }
  return Math.round(((value - base) / base) * 100);
}

function Comparison({
  label,
  change,
}: {
  label: string;
  change: number | null;
}) {
  if (change === null) {
    return null;
  }
  const tone = change > 0 ? "expense" : "income";
  return (
    <span className="spending-comparison">
      <strong data-money-tone={change === 0 ? "neutral" : tone}>
        {change > 0 ? "+" : ""}
        {change}%
      </strong>{" "}
      {label}
    </span>
  );
}

export function MonthlySpendingChart({
  groups,
  currency,
  endMonth,
  referenceDay,
}: {
  groups: FinancialSummary["groups"];
  currency: string;
  endMonth: string;
  referenceDay?: string;
}) {
  const series = useMemo(
    () => monthSeries(groups, endMonth),
    [endMonth, groups],
  );
  const values = useMemo(() => safeChartValues(series), [series]);
  const openMonth = referenceDay?.slice(0, 7);
  const closedValues = useMemo(
    () =>
      (values ?? [])
        .filter((_, index) => series[index]?.group !== openMonth)
        .slice(-12),
    [openMonth, series, values],
  );
  const average = closedValues.length
    ? closedValues.reduce((sum, amount) => sum + amount, 0) /
      closedValues.length
    : 0;
  const lastClosed = series.findLastIndex((item) => item.group !== openMonth);
  const [selected, setSelected] = useState(
    lastClosed < 0 ? series.length - 1 : lastClosed,
  );
  const { frame, width } = useWidth();
  const openIndex = series.findIndex((item) => item.group === openMonth);
  const formatAxis = useCallback(
    (amount: number) =>
      formatAmount(Math.round(amount).toString(), currency).replace(
        wholeCents,
        "",
      ),
    [currency],
  );
  const select = useCallback(
    (event: SyntheticEvent<HTMLButtonElement>) =>
      setSelected(Number(event.currentTarget.dataset.index)),
    [],
  );
  if (!values) {
    return (
      <p className="chart-unavailable">
        A tabela preserva os valores exatos. A magnitude destes dados excede a
        escala numérica segura do gráfico.
      </p>
    );
  }
  const top = niceCeiling(Math.max(1, ...values, average));
  const current = series[selected];
  const value = values[selected] ?? 0;
  const yearAgo = current
    ? series.findIndex((item) => item.group === shiftMonth(current.group, -12))
    : -1;
  const open = current?.group === openMonth;
  const plotWidth = Math.max(0, width - inset.left - inset.right);
  const xAt = (index: number) =>
    inset.left +
    (series.length < 2
      ? plotWidth / 2
      : (index * plotWidth) / (series.length - 1));
  const yAt = (amount: number) =>
    inset.top + (1 - amount / top) * (plotHeight - inset.top - inset.bottom);
  const baseline = yAt(0);
  const points = values.map((amount, index) => `${xAt(index)},${yAt(amount)}`);
  const closedPoints = points.slice(0, openIndex < 0 ? undefined : openIndex);
  const line = `M${closedPoints.join("L")}`;
  const area = `${line}L${xAt(closedPoints.length - 1)},${baseline}L${xAt(0)},${baseline}Z`;
  const step = series.length < 2 ? plotWidth : plotWidth / (series.length - 1);
  const labelEvery = Math.max(1, Math.ceil(56 / Math.max(step, 1)));
  return (
    <figure className="spending-chart">
      <figcaption
        aria-live="polite"
        className="spending-readout"
      >
        <span className="spending-readout-month">
          {current ? longMonth.format(monthDate(current.group)) : ""}
          {open && " · em andamento"}
        </span>
        <strong className="spending-readout-value">
          <MoneyValue
            value={formatBalance(current?.amountMinor ?? "0", currency)}
          />
        </strong>
        <span className="spending-readout-comparisons">
          {!open && (
            <Comparison
              change={percentChange(value, average)}
              label="vs. média de 12 meses"
            />
          )}
          {yearAgo >= 0 && !open && (
            <Comparison
              change={percentChange(value, values[yearAgo] ?? 0)}
              label="vs. ano anterior"
            />
          )}
        </span>
      </figcaption>
      <div
        className="spending-plot"
        ref={frame}
      >
        {width > 0 && (
          <svg
            aria-hidden="true"
            className="spending-svg"
            height={plotHeight}
            width={width}
          >
            {[0, top / 2, top].map((tick) => (
              <g key={tick}>
                <line
                  className="spending-grid"
                  x1={inset.left}
                  x2={width - inset.right}
                  y1={yAt(tick)}
                  y2={yAt(tick)}
                />
                <text
                  className="spending-axis"
                  dominantBaseline="middle"
                  textAnchor="end"
                  x={inset.left - 8}
                  y={yAt(tick)}
                >
                  {formatAxis(tick)}
                </text>
              </g>
            ))}
            {closedPoints.length > 1 && (
              <path
                className="spending-area"
                d={area}
              />
            )}
            <line
              className="spending-average"
              x1={inset.left}
              x2={width - inset.right}
              y1={yAt(average)}
              y2={yAt(average)}
            />
            {closedPoints.length > 1 && (
              <path
                className="spending-line"
                d={line}
              />
            )}
            {openIndex > 0 && (
              <path
                className="spending-line spending-line-open"
                d={`M${points[openIndex - 1]}L${points[openIndex]}`}
              />
            )}
            <line
              className="spending-cursor"
              x1={xAt(selected)}
              x2={xAt(selected)}
              y1={inset.top}
              y2={baseline}
            />
            {values.map((amount, index) => (
              <circle
                className="spending-point"
                cx={xAt(index)}
                cy={yAt(amount)}
                data-open={index === openIndex}
                data-selected={index === selected}
                key={series[index]?.group}
                r={index === selected ? 5 : 3}
              />
            ))}
            {series.map((item, index) =>
              index % labelEvery === 0 || index === series.length - 1 ? (
                <text
                  className="spending-axis"
                  data-january={item.group.endsWith("-01")}
                  key={item.group}
                  textAnchor="middle"
                  x={xAt(index)}
                  y={plotHeight - 4}
                >
                  {item.group.endsWith("-01")
                    ? item.group.slice(0, 4)
                    : shortMonth.format(monthDate(item.group)).replace(".", "")}
                </text>
              ) : null,
            )}
          </svg>
        )}
        <ol
          aria-label={`Despesas por mês em ${currency}`}
          className="spending-targets"
        >
          {series.map((item, index) => (
            <li
              key={item.group}
              style={{
                inlineSize: `${step}px`,
                insetInlineStart: `${xAt(index) - step / 2}px`,
              }}
            >
              <button
                aria-label={`${longMonth.format(monthDate(item.group))}: ${formatBalance(item.amountMinor, currency)}`}
                aria-pressed={index === selected}
                className="spending-target"
                data-index={index}
                onClick={select}
                onFocus={select}
                onPointerEnter={select}
                type="button"
              />
            </li>
          ))}
        </ol>
      </div>
    </figure>
  );
}
