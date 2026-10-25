import { Chart, ChartPalette } from "@cloudflare/kumo/components/chart";
import { PieChart } from "echarts/charts";
import { AriaComponent, TooltipComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import { useMemo } from "react";

import { formatBalance } from "../money";
import { useTheme } from "../use-theme";
import {
  type AllocationSlice,
  categorySlices,
  percentageLabel,
} from "./allocation-presentation";

const echarts = await import("echarts/core");
echarts.use([PieChart, TooltipComponent, AriaComponent, CanvasRenderer]);

export function AllocationChart({
  categories,
  currency,
  description = "Composição dos compromissos observados",
}: {
  categories: AllocationSlice[];
  currency: string;
  description?: string;
}) {
  const dark = useTheme() === "dark";
  const slices = useMemo(() => categorySlices(categories), [categories]);
  const options = useMemo(
    () =>
      ({
        animation: false,
        aria: {
          description: `${description} em ${currency}. A legenda contém os valores exatos.`,
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
            radius: ["58%", "82%"],
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
    [currency, dark, slices, description],
  );
  return (
    <Chart
      echarts={echarts}
      height={240}
      isDarkMode={dark}
      options={options}
    />
  );
}
