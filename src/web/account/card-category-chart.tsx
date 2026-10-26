import { Chart, ChartPalette } from "@cloudflare/kumo/components/chart";
import { PieChart } from "echarts/charts";
import { AriaComponent, TooltipComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import { useMemo } from "react";

import type { PortalCards, WorkspaceCatalog } from "../../contracts";
import { formatBalance } from "../money";
import { useTheme } from "../use-theme";
import { chartTooltip } from "./chart-tooltip";
import { safeChartValues } from "./financial-presentation";

const echarts = await import("echarts/core");
echarts.use([PieChart, TooltipComponent, AriaComponent, CanvasRenderer]);

export function CardCategoryChart({
  groups,
  categories,
  currency,
}: {
  groups: PortalCards["categories"];
  categories: WorkspaceCatalog["categories"];
  currency: string;
}) {
  const dark = useTheme() === "dark";
  const values = useMemo(
    () =>
      safeChartValues(
        groups.map((row) => ({
          amountMinor: row.knownMinor,
          currency,
          group: row.categoryId ?? "",
        })),
      ),
    [currency, groups],
  );
  const options = useMemo(
    () =>
      ({
        animation: false,
        aria: {
          description: `Gastos confirmados por categoria, em ${currency}, antes dos estornos. A legenda apresenta valores exatos.`,
          enabled: true,
        },
        backgroundColor: "transparent",
        series: [
          {
            center: ["50%", "50%"],
            data: groups.map((row, index) => {
              const category = categories.find(
                (item) => item.id === row.categoryId,
              );
              return {
                itemStyle: {
                  color:
                    category?.color ?? ChartPalette.text("secondary", dark),
                },
                name: category?.name ?? "Sem categoria",
                value: values?.[index] ?? 0,
              };
            }),
            emphasis: { scale: false },
            label: { show: false },
            radius: ["58%", "82%"],
            type: "pie",
          },
        ],
        textStyle: { fontFamily: "Inter, sans-serif", fontSize: 14 },
        tooltip: {
          ...chartTooltip,
          trigger: "item",
          valueFormatter: (value: unknown) =>
            typeof value === "number"
              ? formatBalance(Math.trunc(value).toString(), currency)
              : "Valor não informado",
        },
      }) satisfies Parameters<typeof Chart>[0]["options"],
    [categories, currency, dark, groups, values],
  );
  if (!values) {
    return (
      <p className="cards-note">
        Valores acima da escala segura do gráfico. Consulte a legenda exata.
      </p>
    );
  }
  return (
    <Chart
      echarts={echarts}
      height={240}
      isDarkMode={dark}
      options={options}
    />
  );
}
