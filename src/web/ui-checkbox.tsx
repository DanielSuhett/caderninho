import { Checkbox } from "@cloudflare/kumo/components/checkbox";
import { type ComponentProps, useState } from "react";

// Kumo 2.14 exposes a controlled Checkbox. This adapter provides native-form defaults.
export function UiCheckbox({
  defaultChecked = false,
  ...props
}: Omit<ComponentProps<typeof Checkbox>, "checked" | "onCheckedChange"> & {
  defaultChecked?: boolean;
}) {
  const [checked, setChecked] = useState(defaultChecked);
  return (
    <Checkbox
      {...props}
      checked={checked}
      onCheckedChange={setChecked}
    />
  );
}
