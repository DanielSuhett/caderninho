import { type ChangeEvent, useCallback, useId } from "react";

import { monthLabel } from "./dashboard-period";

// Kumo 2.14 has no Slider. Keep the native keyboard/touch range semantics.
export function MonthSlider({
  months,
  value,
  onChange,
  label,
  visibleValue,
}: {
  months: string[];
  value: string;
  onChange: (month: string) => void;
  label: string;
  visibleValue?: string;
}) {
  const id = useId();
  const change = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const month = months[Number(event.currentTarget.value)];
      if (month) {
        onChange(month);
      }
    },
    [months, onChange],
  );
  if (months.length < 2) {
    return null;
  }
  return (
    <div className="month-slider">
      <label htmlFor={id}>
        {label}
        <span>{visibleValue ?? monthLabel(value)}</span>
      </label>
      <input
        aria-valuetext={visibleValue ?? monthLabel(value)}
        id={id}
        max={months.length - 1}
        min={0}
        onChange={change}
        step={1}
        type="range"
        value={Math.max(0, months.indexOf(value))}
      />
    </div>
  );
}
