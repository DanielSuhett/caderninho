import {
  type PointerEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

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

export function useWidth() {
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
