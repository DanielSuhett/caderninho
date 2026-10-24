import { Chart } from "@cloudflare/kumo/components/chart";
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
  const values = safeChartValues(groups);
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
            areaStyle: { color: "rgba(228,228,231,.035)" },
            data: values ?? [],
            itemStyle: { color: "#f4f4f5" },
            lineStyle: { color: "#e4e4e7", width: 2 },
            name: `Despesas · ${currency}`,
            symbol: "circle",
            symbolSize: 7,
            type: "line",
          },
        ],
        textStyle: { fontFamily: "Inter, sans-serif", fontSize: 14 },
        tooltip: {
          backgroundColor: "#18181b",
          borderColor: "#52525b",
          renderMode: "richText",
          textStyle: { color: "#fafafa", fontSize: 14 },
          trigger: "axis",
          valueFormatter: (value: unknown) =>
            typeof value === "number"
              ? formatBalance(Math.trunc(value).toString(), currency)
              : "Valor indisponível",
        },
        xAxis: {
          axisLabel: {
            color: "#b3b3b8",
            fontSize: 14,
            formatter: (value: string) => value.slice(0, 3),
          },
          axisLine: { lineStyle: { color: "#3f3f46" } },
          axisTick: { show: false },
          data: groups.map((group) =>
            monthLabel(group.group).replace(" de ", " "),
          ),
          type: "category",
        },
        yAxis: {
          axisLabel: {
            color: "#b3b3b8",
            fontSize: 14,
            formatter: (value: number) =>
              formatBalance(Math.trunc(value).toString(), currency).replace(
                ` ${currency}`,
                "",
              ),
          },
          splitLine: { lineStyle: { color: "#29292e" } },
          type: "value",
        },
      }) satisfies Parameters<typeof Chart>[0]["options"],
    [currency, groups, values],
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
      isDarkMode
      options={options}
    />
  );
}
