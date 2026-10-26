import { Button } from "@cloudflare/kumo/components/button";
import { Popover } from "@cloudflare/kumo/components/popover";
import { Select } from "@cloudflare/kumo/components/select";
import { Tooltip } from "@cloudflare/kumo/components/tooltip";
import {
  CaretLeftIcon,
  CaretRightIcon,
  CaretUpDownIcon,
} from "@phosphor-icons/react";
import { useCallback, useState } from "react";

import { monthLabel, shiftMonth } from "./dashboard-period";
import { MonthSlider } from "./month-slider";

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
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(month);
  const toggle = useCallback(
    (value: boolean) => {
      setOpen(value);
      if (value) {
        setDraft(month);
      }
    },
    [month],
  );
  const previous = useCallback(
    () => onChange(shiftMonth(month, -1)),
    [month, onChange],
  );
  const next = useCallback(
    () => onChange(shiftMonth(month, 1)),
    [month, onChange],
  );
  const change = useCallback((value: string | null) => {
    if (value) {
      setDraft(value);
    }
  }, []);
  const apply = useCallback(() => {
    setOpen(false);
    onChange(draft);
  }, [draft, onChange]);
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
      <Popover
        onOpenChange={toggle}
        open={open}
      >
        <Popover.Trigger
          render={
            <Button aria-label={`Mês da consulta: ${monthLabel(month)}`} />
          }
        >
          {monthLabel(month)}
          <CaretUpDownIcon
            aria-hidden
            size={16}
          />
        </Popover.Trigger>
        <Popover.Content className="month-picker-panel">
          <Popover.Title>Escolher mês</Popover.Title>
          <Select
            aria-label="Mês"
            items={months}
            onValueChange={change}
            value={draft}
          />
          <MonthSlider
            label="Deslizar pelos meses"
            months={months.map((item) => item.value)}
            onChange={setDraft}
            value={draft}
          />
          <div className="month-picker-actions">
            <Popover.Close render={<Button variant="secondary" />}>
              Cancelar
            </Popover.Close>
            <Button
              onClick={apply}
              variant="primary"
            >
              Ver mês
            </Button>
          </div>
        </Popover.Content>
      </Popover>
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
