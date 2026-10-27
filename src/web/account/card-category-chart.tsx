import { useCallback, useMemo } from "react";

import type { PortalCards, WorkspaceCatalog } from "../../contracts";
import { formatBalance } from "../money";
import { safeChartValues } from "./financial-presentation";
import { DonutChart } from "./svg-chart";

export function CardCategoryChart({
  groups,
  categories,
  currency,
}: {
  groups: PortalCards["categories"];
  categories: WorkspaceCatalog["categories"];
  currency: string;
}) {
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
  const slices = useMemo(
    () =>
      groups.map((row, index) => {
        const category = categories.find((item) => item.id === row.categoryId);
        return {
          color: category?.color ?? "var(--chart-muted)",
          name: category?.name ?? "Sem categoria",
          value: values?.[index] ?? 0,
        };
      }),
    [categories, groups, values],
  );
  const formatValue = useCallback(
    (value: number) => formatBalance(Math.trunc(value).toString(), currency),
    [currency],
  );
  if (!values) {
    return (
      <p className="cards-note">
        Valores acima da escala segura do gráfico. Consulte a legenda exata.
      </p>
    );
  }
  return (
    <DonutChart
      description={`Gastos confirmados por categoria, em ${currency}, antes dos estornos. A legenda apresenta valores exatos.`}
      formatValue={formatValue}
      height={240}
      slices={slices}
    />
  );
}
