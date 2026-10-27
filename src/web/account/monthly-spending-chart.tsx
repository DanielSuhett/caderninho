import { useCallback, useMemo, useState } from "react";

import type { FinancialSummary } from "../../contracts";
import { formatBalance } from "../money";
import { monthLabel } from "./dashboard-period";
import { safeChartValues } from "./financial-presentation";
import { MonthSlider } from "./month-slider";
import { attentionColor, LineChart } from "./svg-chart";

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
  const formatValue = useCallback(
    (value: number) => formatBalance(Math.trunc(value).toString(), currency),
    [currency],
  );
  const formatAxis = useCallback(
    (value: number) => formatValue(value).replace(` ${currency}`, ""),
    [currency, formatValue],
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
      <LineChart
        color={attentionColor}
        description={`Despesas classificadas por mês, em ${currency}. Valores exatos disponíveis na tabela abaixo.`}
        formatAxis={formatAxis}
        formatValue={formatValue}
        height={260}
        labels={visibleGroups.map((group) =>
          monthLabel(group.group).replace(" de ", " "),
        )}
        seriesName={`Despesas · ${currency}`}
        values={values}
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
