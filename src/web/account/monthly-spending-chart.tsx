import { Chart, ChartPalette } from "@cloudflare/kumo/components/chart";
import { LineChart } from "echarts/charts";
import {
  AriaComponent,
  GridComponent,
  TooltipComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import { useMemo } from "react";

import type { FinancialSummary } from "../../contracts";
import { formatBalance } from "../money";
import { useTheme } from "../use-theme";
import { monthLabel } from "./dashboard-period";
import { safeChartValues } from "./financial-presentation";

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
  const values = useMemo(() => safeChartValues(groups), [groups]);
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
            data: values ?? [],
            itemStyle: { color: expenseColor },
            lineStyle: { color: expenseColor, width: 2 },
            name: `Despesas · ${currency}`,
            symbol: "circle",
            symbolSize: 7,
            type: "line",
          },
        ],
        textStyle: { fontFamily: "Inter, sans-serif", fontSize: 14 },
        tooltip: {
          renderMode: "richText",
          textStyle: { fontSize: 14 },
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
          data: groups.map((group) =>
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
    [currency, dark, expenseColor, groups, values],
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
    <Chart
      echarts={echarts}
      height={260}
      isDarkMode={dark}
      options={options}
    />
  );
}
