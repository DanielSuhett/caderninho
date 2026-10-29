import { Button } from "@cloudflare/kumo/components/button";
import { Popover } from "@cloudflare/kumo/components/popover";
import { Select } from "@cloudflare/kumo/components/select";
import { CaretUpDownIcon } from "@phosphor-icons/react";
import { useCallback, useState } from "react";

import { monthLabel } from "./dashboard-period";
import { MonthSlider } from "./month-slider";

export function MonthPickerPanel({
  month,
  months,
  onChange,
  open: initiallyOpen,
}: {
  month: string;
  months: Array<{ label: string; value: string }>;
  onChange: (month: string) => void;
  open: boolean;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  const [draft, setDraft] = useState(month);
  const toggle = useCallback(
    (value: boolean, details: { reason: string; event: Event }) => {
      // The month list renders in its own portal; Preact does not bubble its
      // presses through this popover, so they arrive as outside presses.
      if (
        !value &&
        details.reason === "outside-press" &&
        details.event.target instanceof Element &&
        details.event.target.closest('[role="listbox"]')
      ) {
        return;
      }
      setOpen(value);
      if (value) {
        setDraft(month);
      }
    },
    [month],
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
  return (
    <Popover
      onOpenChange={toggle}
      open={open}
    >
      <Popover.Trigger
        render={<Button aria-label={`Mês da consulta: ${monthLabel(month)}`} />}
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
  );
}
