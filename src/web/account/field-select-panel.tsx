import { Select } from "@cloudflare/kumo/components/select";

import type { FieldSelectProps } from "./field-select";

export function FieldSelectPanel({
  className = "",
  defaultValue,
  items,
  label,
  name,
}: FieldSelectProps) {
  return (
    <Select
      className={className}
      defaultValue={defaultValue}
      items={items}
      label={label}
      name={name}
    />
  );
}
