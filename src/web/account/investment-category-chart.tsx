import { Chart, ChartPalette } from "@cloudflare/kumo/components/chart";
import { PieChart } from "echarts/charts";
import { AriaComponent, TooltipComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import { useMemo } from "react";

import { formatBalance } from "../money";
import { useTheme } from "../use-theme";
import {
  categorySlices,
  type InvestmentCategorySlice,
  percentageLabel,
} from "./investments-presentation";

const echarts = await import("echarts/core");
echarts.use([PieChart, TooltipComponent, AriaComponent, CanvasRenderer]);

export function InvestmentCategoryChart({
  categories,
  currency,
}: {
  categories: InvestmentCategorySlice[];
  currency: string;
}) {
  const dark = useTheme() === "dark";
  const slices = useMemo(() => categorySlices(categories), [categories]);
  const options = useMemo(
    () =>
      ({
        animation: false,
        aria: {
          description: `Participação das categorias nos compromissos observados em ${currency}. A legenda contém os valores exatos.`,
          enabled: true,
        },
        backgroundColor: "transparent",
        series: [
          {
            avoidLabelOverlap: true,
            center: ["50%", "50%"],
            data: (slices ?? []).map((slice) => ({
              itemStyle: { color: slice.color },
              name: `${slice.name} · ${formatBalance(slice.amountMinor, currency)}`,
              value: slice.proportion,
            })),
            emphasis: { scale: false },
            itemStyle: {
              borderColor: ChartPalette.text("primary", dark),
              borderWidth: 0,
            },
            label: { show: false },
            radius: ["58%", "84%"],
            type: "pie",
          },
        ],
        textStyle: { fontFamily: "Inter, sans-serif", fontSize: 14 },
        tooltip: {
          renderMode: "richText",
          textStyle: { fontSize: 14 },
          trigger: "item",
          valueFormatter: (value: unknown) =>
            typeof value === "number" ? percentageLabel(value) : "",
        },
      }) satisfies Parameters<typeof Chart>[0]["options"],
    [currency, dark, slices],
  );
  return (
    <>
      <Chart
        echarts={echarts}
        height={220}
        isDarkMode={dark}
        options={options}
      />
      <span
        aria-hidden
        className="investment-donut-center"
      >
        Compromissos<span>{currency}</span>
      </span>
    </>
  );
}
