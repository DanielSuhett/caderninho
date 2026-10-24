import { Button, Select, Tooltip } from "@cloudflare/kumo";
import { CaretLeftIcon, CaretRightIcon } from "@phosphor-icons/react";
import { useCallback } from "react";

import { monthLabel, shiftMonth } from "./dashboard-period";

export function PeriodPicker({
  month,
  onChange,
  fromMonth = "0001-01",
  toMonth = "9998-12",
}: {
  month: string;
  fromMonth?: string;
  toMonth?: string;
  onChange: (month: string) => void;
}) {
  const previous = useCallback(
    () => onChange(shiftMonth(month, -1)),
    [month, onChange],
  );
  const next = useCallback(
    () => onChange(shiftMonth(month, 1)),
    [month, onChange],
  );
  const change = useCallback(
    (value: string | null) => {
      if (value) {
        onChange(value);
      }
    },
    [onChange],
  );
  const months = Array.from({ length: 25 }, (_, index) => {
    const value = shiftMonth(month, index - 12);
    return { label: monthLabel(value), value };
  }).filter(
    (item) =>
      (!fromMonth || item.value >= fromMonth) &&
      (!toMonth || item.value <= toMonth),
  );
  return (
    <div className="period-picker">
      <Tooltip
        content="Mês anterior"
        render={
          <Button
            aria-label="Mês anterior"
            disabled={!!fromMonth && month <= fromMonth}
            icon={CaretLeftIcon}
            onClick={previous}
            shape="square"
          />
        }
      />
      <Select
        items={months}
        label="Mês da consulta"
        onValueChange={change}
        value={month}
      />
      <Tooltip
        content="Próximo mês"
        render={
          <Button
            aria-label="Próximo mês"
            disabled={!!toMonth && month >= toMonth}
            icon={CaretRightIcon}
            onClick={next}
            shape="square"
          />
        }
      />
    </div>
  );
}
