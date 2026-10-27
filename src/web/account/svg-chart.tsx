import {
  type PointerEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

// Kumo ChartPalette Attention, identical in both themes.
export const attentionColor = "#FC574A";

const lineInset = { bottom: 32, left: 70, right: 12, top: 24 } as const;
const tickSteps = [1, 2, 5, 10] as const;
const donutRadius = { inner: 0.58, outer: 0.82 } as const;

export interface DonutSlice {
  color: string;
  name: string;
  value: number;
}

interface TooltipAnchor {
  index: number;
  x: number;
  y: number;
}

function useWidth() {
  const frame = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = frame.current;
    if (!element) {
      return;
    }
    const observer = new ResizeObserver(([entry]) => {
      if (entry) {
        setWidth(Math.round(entry.contentRect.width));
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return { frame, width };
}

function niceStep(span: number) {
  const magnitude = 10 ** Math.floor(Math.log10(span));
  const step = tickSteps.find((candidate) => candidate * magnitude >= span);
  return (step ?? 10) * magnitude;
}

// Matches a zero-based value axis with about five round ticks.
export function valueTicks(values: number[]) {
  const low = Math.min(0, ...values);
  const high = Math.max(0, ...values);
  if (low === high) {
    return [0, 1];
  }
  const step = niceStep((high - low) / 4);
  const ticks: number[] = [];
  for (
    let tick = Math.floor(low / step) * step;
    tick < high + step;
    tick += step
  ) {
    ticks.push(tick);
  }
  return ticks;
}

function ChartTooltip({
  anchor,
  width,
  children,
}: {
  anchor: TooltipAnchor;
  width: number;
  children: ReactNode;
}) {
  const side =
    anchor.x < width / 2
      ? { left: anchor.x + 12 }
      : { right: width - anchor.x + 12 };
  return (
    <div
      className="svg-chart-tooltip"
      style={{ ...side, top: anchor.y }}
    >
      {children}
    </div>
  );
}

function TooltipRow({
  color,
  name,
  value,
}: {
  color: string;
  name: string;
  value: string;
}) {
  return (
    <span className="svg-chart-tooltip-row">
      <span
        aria-hidden="true"
        className="svg-chart-marker"
        style={{ background: color }}
      />
      <span>{name}</span>
      <strong>{value}</strong>
    </span>
  );
}

function lineScale({
  count,
  height,
  values,
  width,
}: {
  count: number;
  height: number;
  values: number[];
  width: number;
}) {
  const ticks = valueTicks(values);
  const low = ticks[0] ?? 0;
  const high = ticks.at(-1) ?? 1;
  const plotWidth = Math.max(0, width - lineInset.left - lineInset.right);
  const bottom = height - lineInset.bottom;
  const plotHeight = bottom - lineInset.top;
  const xAt = (index: number) => {
    if (count < 2) {
      return lineInset.left + plotWidth / 2;
    }
    return lineInset.left + (index * plotWidth) / (count - 1);
  };
  const yAt = (value: number) =>
    bottom - ((value - low) / (high - low)) * plotHeight;
  return { plotWidth, ticks, xAt, yAt };
}

export function LineChart({
  color,
  description,
  formatAxis,
  formatValue,
  height,
  labels,
  seriesName,
  values,
}: {
  color: string;
  description: string;
  formatAxis: (value: number) => string;
  formatValue: (value: number) => string;
  height: number;
  labels: string[];
  seriesName: string;
  values: number[];
}) {
  const { frame, width } = useWidth();
  const [anchor, setAnchor] = useState<TooltipAnchor | null>(null);
  const scale = useMemo(
    () => lineScale({ count: values.length, height, values, width }),
    [height, values, width],
  );
  const { plotWidth, ticks, xAt, yAt } = scale;
  const bottom = height - lineInset.bottom;
  const points = values.map((value, index) => `${xAt(index)},${yAt(value)}`);
  const point = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (values.length === 0) {
        return;
      }
      const { left } = event.currentTarget.getBoundingClientRect();
      const ratio = (event.clientX - left - lineInset.left) / (plotWidth || 1);
      const nearest = Math.round(ratio * (values.length - 1));
      const index = Math.min(values.length - 1, Math.max(0, nearest));
      setAnchor({ index, x: xAt(index), y: yAt(values[index] ?? 0) });
    },
    [plotWidth, values, xAt, yAt],
  );
  const leave = useCallback(() => setAnchor(null), []);
  return (
    <div
      className="svg-chart"
      onPointerLeave={leave}
      onPointerMove={point}
      ref={frame}
      style={{ height }}
    >
      {width > 0 && (
        <svg
          aria-label={description}
          height={height}
          role="img"
          width={width}
        >
          {ticks.map((tick) => (
            <g key={tick}>
              <line
                className="svg-chart-grid"
                x1={lineInset.left}
                x2={width - lineInset.right}
                y1={yAt(tick)}
                y2={yAt(tick)}
              />
              <text
                className="svg-chart-label"
                dominantBaseline="middle"
                textAnchor="end"
                x={lineInset.left - 8}
                y={yAt(tick)}
              >
                {formatAxis(tick)}
              </text>
            </g>
          ))}
          <line
            className="svg-chart-axis"
            x1={lineInset.left}
            x2={width - lineInset.right}
            y1={yAt(0)}
            y2={yAt(0)}
          />
          {labels.map((label, index) => (
            <text
              className="svg-chart-label"
              key={label}
              textAnchor="middle"
              x={xAt(index)}
              y={bottom + 22}
            >
              {label.slice(0, 3)}
            </text>
          ))}
          {!!anchor && (
            <line
              className="svg-chart-axis"
              x1={anchor.x}
              x2={anchor.x}
              y1={lineInset.top}
              y2={bottom}
            />
          )}
          <polygon
            fill={color}
            fillOpacity={0.04}
            points={`${xAt(0)},${yAt(0)} ${points.join(" ")} ${xAt(values.length - 1)},${yAt(0)}`}
          />
          <polyline
            fill="none"
            points={points.join(" ")}
            stroke={color}
            strokeLinejoin="round"
            strokeWidth={2}
          />
          {values.map((value, index) => (
            <circle
              className="svg-chart-point"
              cx={xAt(index)}
              cy={yAt(value)}
              key={labels[index] ?? index}
              r={anchor?.index === index ? 5 : 3.5}
              stroke={color}
            />
          ))}
        </svg>
      )}
      {!!anchor && (
        <ChartTooltip
          anchor={anchor}
          width={width}
        >
          <span>{labels[anchor.index]}</span>
          <TooltipRow
            color={color}
            name={seriesName}
            value={formatValue(values[anchor.index] ?? 0)}
          />
        </ChartTooltip>
      )}
    </div>
  );
}

function polar(center: number, radius: number, turn: number) {
  const angle = turn * 2 * Math.PI - Math.PI / 2;
  return `${center + radius * Math.cos(angle)} ${center + radius * Math.sin(angle)}`;
}

// Full circles split into two arcs because SVG cannot draw a closed arc.
function arcPath(center: number, start: number, end: number): string {
  if (end - start >= 1) {
    return `${arcPath(center, start, start + 0.5)} ${arcPath(center, start + 0.5, end)}`;
  }
  const outer = center * donutRadius.outer;
  const inner = center * donutRadius.inner;
  const large = end - start > 0.5 ? 1 : 0;
  return [
    `M ${polar(center, outer, start)}`,
    `A ${outer} ${outer} 0 ${large} 1 ${polar(center, outer, end)}`,
    `L ${polar(center, inner, end)}`,
    `A ${inner} ${inner} 0 ${large} 0 ${polar(center, inner, start)}`,
    "Z",
  ].join(" ");
}

export function DonutChart({
  description,
  formatValue,
  height,
  slices,
}: {
  description: string;
  formatValue: (value: number) => string;
  height: number;
  slices: DonutSlice[];
}) {
  const { frame, width } = useWidth();
  const [anchor, setAnchor] = useState<TooltipAnchor | null>(null);
  const visible = slices.filter((slice) => slice.value > 0);
  const total = visible.reduce((sum, slice) => sum + slice.value, 0);
  const center = height / 2;
  const offset = (width - height) / 2;
  let start = 0;
  const arcs = visible.map((slice) => {
    const end = start + slice.value / total;
    const path = arcPath(center, start, end);
    start = end;
    return { path, slice };
  });
  const point = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const { currentTarget, target } = event;
    const index =
      target instanceof SVGPathElement ? Number(target.dataset.index) : -1;
    if (index < 0) {
      setAnchor(null);
      return;
    }
    const { left, top } = currentTarget.getBoundingClientRect();
    setAnchor({ index, x: event.clientX - left, y: event.clientY - top });
  }, []);
  const leave = useCallback(() => setAnchor(null), []);
  const active = anchor && arcs[anchor.index]?.slice;
  return (
    <div
      className="svg-chart"
      onPointerLeave={leave}
      onPointerMove={point}
      ref={frame}
      style={{ height }}
    >
      {width > 0 && total > 0 && (
        <svg
          aria-label={description}
          height={height}
          role="img"
          viewBox={`${-offset} 0 ${width} ${height}`}
          width={width}
        >
          {arcs.map(({ path, slice }, index) => (
            <path
              d={path}
              data-index={index}
              key={`${slice.name}-${index.toString()}`}
              opacity={!anchor || anchor.index === index ? 1 : 0.6}
              style={{ fill: slice.color }}
            />
          ))}
        </svg>
      )}
      {!!(anchor && active) && (
        <ChartTooltip
          anchor={anchor}
          width={width}
        >
          <TooltipRow
            color={active.color}
            name={active.name}
            value={formatValue(active.value)}
          />
        </ChartTooltip>
      )}
    </div>
  );
}
