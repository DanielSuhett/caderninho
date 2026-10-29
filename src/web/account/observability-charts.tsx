import { type SyntheticEvent, useCallback, useState } from "react";

import type { AuditReport } from "../../contracts";
import { useWidth } from "./svg-chart";

type Day = AuditReport["daily"][number];

const dayLabel = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  timeZone: "UTC",
  weekday: "short",
});
const shortDay = (day: string) => day.slice(5).split("-").reverse().join("/");
const number = (value: number) => value.toLocaleString("pt-BR");
export const averageMs = (row: { durationMs: number; requests: number }) =>
  row.requests ? Math.round(row.durationMs / row.requests) : 0;
export const errorRate = (row: { errors: number; requests: number }) =>
  row.requests ? (100 * row.errors) / row.requests : 0;
export const percent = (value: number) =>
  `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

function niceCeiling(value: number) {
  const magnitude = 10 ** Math.floor(Math.log10(Math.max(value, 1)));
  const factor = [1, 2, 5, 10].find((item) => item * magnitude >= value) ?? 10;
  return factor * magnitude;
}

export function Sparkline({
  tone,
  values,
}: {
  tone: "accent" | "danger";
  values: number[];
}) {
  const max = Math.max(...values, 1);
  const step = values.length > 1 ? 100 / (values.length - 1) : 100;
  const points = values
    .map((value, index) => `${index * step},${30 - (value / max) * 28}`)
    .join(" ");
  return (
    <svg
      aria-hidden="true"
      className="obs-spark"
      data-tone={tone}
      preserveAspectRatio="none"
      viewBox="0 0 100 32"
    >
      <polyline
        points={`0,32 ${points} 100,32`}
        vectorEffect="non-scaling-stroke"
      />
      <polyline
        points={points}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

const plotHeight = 180;
const inset = { bottom: 28, left: 40, right: 8, top: 8 } as const;

export function ActivityChart({ daily }: { daily: Day[] }) {
  const { frame, width } = useWidth();
  const [selected, setSelected] = useState(daily.length - 1);
  const select = useCallback(
    (event: SyntheticEvent<HTMLButtonElement>) =>
      setSelected(Number(event.currentTarget.dataset.index)),
    [],
  );
  const day = daily[selected];
  if (!day) {
    return null;
  }
  const ceiling = niceCeiling(Math.max(...daily.map((row) => row.requests)));
  const plotWidth = Math.max(width - inset.left - inset.right, 0);
  const innerHeight = plotHeight - inset.top - inset.bottom;
  const slot = daily.length ? plotWidth / daily.length : 0;
  const bar = Math.max(Math.min(slot * 0.64, 28), 2);
  const y = (value: number) =>
    inset.top + innerHeight - (value / ceiling) * innerHeight;
  const labelEvery = Math.ceil(daily.length / Math.max(plotWidth / 56, 1));
  return (
    <figure className="obs-activity">
      <figcaption
        aria-live="polite"
        className="obs-readout"
      >
        <span className="obs-readout-day">
          {dayLabel.format(new Date(`${day.day}T12:00:00Z`))}
        </span>
        <strong>{number(day.requests)}</strong>
        <span>requisições</span>
        <span className="obs-readout-meta">
          <span data-tone={day.errors ? "danger" : "neutral"}>
            {number(day.errors)} {day.errors === 1 ? "falha" : "falhas"}
          </span>
          <span>{number(averageMs(day))} ms em média</span>
        </span>
      </figcaption>
      <div
        className="obs-plot"
        ref={frame}
      >
        {width > 0 && (
          <svg
            aria-hidden="true"
            height={plotHeight}
            width={width}
          >
            {[0, 0.5, 1].map((share) => (
              <g key={share}>
                <line
                  className="svg-chart-grid"
                  x1={inset.left}
                  x2={width - inset.right}
                  y1={y(ceiling * share)}
                  y2={y(ceiling * share)}
                />
                <text
                  className="svg-chart-label"
                  dominantBaseline="middle"
                  textAnchor="end"
                  x={inset.left - 8}
                  y={y(ceiling * share)}
                >
                  {number(ceiling * share)}
                </text>
              </g>
            ))}
            {daily.map((row, index) => {
              const x = inset.left + slot * index + (slot - bar) / 2;
              const ok = row.requests - row.errors;
              return (
                <g
                  className={
                    index === selected ? "obs-day is-active" : "obs-day"
                  }
                  key={row.day}
                >
                  <rect
                    className="obs-bar"
                    height={Math.max(y(0) - y(ok), 0)}
                    rx={2}
                    width={bar}
                    x={x}
                    y={y(ok)}
                  />
                  {row.errors > 0 && (
                    <rect
                      className="obs-bar-error"
                      height={Math.max(y(0) - y(row.errors), 2)}
                      rx={2}
                      width={bar}
                      x={x}
                      y={y(row.requests) - 1}
                    />
                  )}
                  {index % labelEvery === 0 && (
                    <text
                      className="svg-chart-label"
                      textAnchor="middle"
                      x={x + bar / 2}
                      y={plotHeight - 6}
                    >
                      {shortDay(row.day)}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        )}
        <ol
          aria-label="Requisições por dia"
          className="obs-targets"
          style={{ left: inset.left, right: inset.right }}
        >
          {daily.map((row, index) => (
            <li
              key={row.day}
              style={{
                left: `${(100 * index) / daily.length}%`,
                width: `${100 / daily.length}%`,
              }}
            >
              <button
                aria-label={`${shortDay(row.day)}: ${row.requests} requisições, ${row.errors} falhas`}
                aria-pressed={index === selected}
                className="obs-target"
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

export function BarGauge({
  label,
  rows,
}: {
  label: string;
  rows: Array<{ id: string; meta: string; name: string; value: number }>;
}) {
  const max = Math.max(...rows.map((row) => row.value), 1);
  return (
    <ul
      aria-label={label}
      className="obs-gauge"
    >
      {rows.map((row) => (
        <li key={row.id}>
          <span className="obs-gauge-name">{row.name}</span>
          <span className="obs-gauge-value">
            {number(row.value)}
            <small className="obs-unit">{row.meta}</small>
          </span>
          <span
            aria-hidden="true"
            className="obs-gauge-track"
          >
            <span style={{ width: `${(100 * row.value) / max}%` }} />
          </span>
        </li>
      ))}
    </ul>
  );
}
