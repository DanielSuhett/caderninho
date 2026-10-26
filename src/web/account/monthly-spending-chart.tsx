import { Chart, ChartPalette } from "@cloudflare/kumo/components/chart";
import { LineChart } from "echarts/charts";
import {
  AriaComponent,
  GridComponent,
  TooltipComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import { useCallback, useMemo, useState } from "react";

import type { FinancialSummary } from "../../contracts";
import { ChartType } from "../../domain";
import { formatBalance } from "../money";
import { useTheme } from "../use-theme";
import { chartTooltip } from "./chart-tooltip";
import { monthLabel } from "./dashboard-period";
import { safeChartValues } from "./financial-presentation";
import { MonthSlider } from "./month-slider";

const echarts = await import("echarts/core");
echarts.use([
  LineChart,
  GridComponent,
  TooltipComponent,
  AriaComponent,
  CanvasRenderer,
]);

export function MonthlySpendingChart({
  groups,
  currency,
}: {
  groups: FinancialSummary["groups"];
  currency: string;
}) {
  const windowSize = Math.min(6, Math.max(3, Math.ceil(groups.length / 2)));
  const [endMonth, setEndMonth] = useState(() => groups.at(-1)?.group ?? "");
  const selected = groups.findIndex((group) => group.group === endMonth);
  const end =
    selected < 0
      ? groups.length - 1
      : Math.min(groups.length - 1, Math.max(windowSize - 1, selected));
  const visibleGroups = useMemo(
    () => groups.slice(Math.max(0, end - windowSize + 1), end + 1),
    [end, groups, windowSize],
  );
  const values = useMemo(() => safeChartValues(visibleGroups), [visibleGroups]);
  const moveWindow = useCallback((month: string) => setEndMonth(month), []);
  const windowLabel = `${monthLabel(visibleGroups[0]?.group ?? endMonth)} — ${monthLabel(visibleGroups.at(-1)?.group ?? endMonth)}`;
  const dark = useTheme() === "dark";
  const expenseColor = ChartPalette.semantic("Attention", dark);
  const options = useMemo(
    () =>
      ({
        animation: false,
        aria: {
          description: `Despesas classificadas por mês, em ${currency}. Valores exatos disponíveis na tabela abaixo.`,
          enabled: true,
        },
        backgroundColor: "transparent",
        grid: { bottom: 32, containLabel: false, left: 70, right: 12, top: 24 },
        series: [
          {
            areaStyle: { color: expenseColor, opacity: 0.04 },
            clip: false,
            connectNulls: false,
            data: values ?? [],
            itemStyle: { color: expenseColor },
            lineStyle: { color: expenseColor, width: 2 },
            name: `Despesas · ${currency}`,
            symbol: "circle",
            symbolSize: 7,
            type: ChartType.line,
          },
        ],
        textStyle: { fontFamily: "Inter, sans-serif", fontSize: 14 },
        tooltip: {
          ...chartTooltip,
          trigger: "axis",
          valueFormatter: (value: unknown) =>
            typeof value === "number"
              ? formatBalance(Math.trunc(value).toString(), currency)
              : "Valor indisponível",
        },
        xAxis: {
          axisLabel: {
            color: ChartPalette.text("primary", dark),
            fontSize: 14,
            formatter: (value: string) => value.slice(0, 3),
          },
          axisLine: {
            lineStyle: { color: ChartPalette.text("secondary", dark) },
          },
          axisTick: { show: false },
          boundaryGap: false,
          data: visibleGroups.map((group) =>
            monthLabel(group.group).replace(" de ", " "),
          ),
          type: "category",
        },
        yAxis: {
          axisLabel: {
            color: ChartPalette.text("primary", dark),
            fontSize: 14,
            formatter: (value: number) =>
              formatBalance(Math.trunc(value).toString(), currency).replace(
                ` ${currency}`,
                "",
              ),
          },
          splitLine: {
            lineStyle: {
              color: ChartPalette.text("secondary", dark),
              opacity: 0.2,
            },
          },
          type: "value",
        },
      }) satisfies Parameters<typeof Chart>[0]["options"],
    [currency, dark, expenseColor, visibleGroups, values],
  );
  if (!values) {
    return (
      <p className="chart-unavailable">
        A tabela preserva os valores exatos. A magnitude destes dados excede a
        escala numérica segura do gráfico.
      </p>
    );
  }
  return (
    <>
      <Chart
        echarts={echarts}
        height={260}
        isDarkMode={dark}
        options={options}
      />
      <MonthSlider
        label="Janela de meses"
        months={groups
          .slice(Math.min(windowSize - 1, groups.length - 1))
          .map((group) => group.group)}
        onChange={moveWindow}
        value={visibleGroups.at(-1)?.group ?? endMonth}
        visibleValue={windowLabel}
      />
    </>
  );
}
