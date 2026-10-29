import { Button } from "@cloudflare/kumo/components/button";
import { Tooltip } from "@cloudflare/kumo/components/tooltip";
import {
  CaretLeftIcon,
  CaretRightIcon,
  CaretUpDownIcon,
} from "@phosphor-icons/react";
import { useCallback } from "react";

import { monthLabel, shiftMonth } from "./dashboard-period";
import { deferred, useIntent } from "./deferred";

const loadPanel = async () =>
  (await import("./month-picker-panel")).MonthPickerPanel;

function MonthTrigger({
  label,
  onClick,
  onFocus,
  onPointerEnter,
}: {
  label: string;
  onClick?: () => void;
  onFocus?: () => void;
  onPointerEnter?: () => void;
}) {
  return (
    <Button
      aria-haspopup="dialog"
      aria-label={`Mês da consulta: ${label}`}
      {...(onClick && { onClick })}
      {...(onFocus && { onFocus })}
      {...(onPointerEnter && { onPointerEnter })}
    >
      {label}
      <CaretUpDownIcon
        aria-hidden
        size={16}
      />
    </Button>
  );
}

// The popover, month list and slider download when someone reaches for them.
const MonthPicker = deferred(loadPanel, ({ month }) => (
  <MonthTrigger label={monthLabel(month)} />
));

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
  const { hover, intent, open, warm } = useIntent(loadPanel);
  const previous = useCallback(
    () => onChange(shiftMonth(month, -1)),
    [month, onChange],
  );
  const next = useCallback(
    () => onChange(shiftMonth(month, 1)),
    [month, onChange],
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
      {intent === "idle" ? (
        <MonthTrigger
          label={monthLabel(month)}
          onClick={open}
          onFocus={warm}
          onPointerEnter={hover}
        />
      ) : (
        <MonthPicker
          month={month}
          months={months}
          onChange={onChange}
          open={intent === "open"}
        />
      )}
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
