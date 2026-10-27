import { useMemo } from "react";

import { formatBalance } from "../money";
import {
  type AllocationSlice,
  categorySlices,
  percentageLabel,
} from "./allocation-presentation";
import { DonutChart } from "./svg-chart";

export function AllocationChart({
  categories,
  currency,
  description = "Composição dos compromissos observados",
}: {
  categories: AllocationSlice[];
  currency: string;
  description?: string;
}) {
  const slices = useMemo(
    () =>
      (categorySlices(categories) ?? []).map((slice) => ({
        color: slice.color,
        name: `${slice.name} · ${formatBalance(slice.amountMinor, currency)}`,
        value: slice.proportion,
      })),
    [categories, currency],
  );
  return (
    <DonutChart
      description={`${description} em ${currency}. A legenda contém os valores exatos.`}
      formatValue={percentageLabel}
      height={240}
      slices={slices}
    />
  );
}
