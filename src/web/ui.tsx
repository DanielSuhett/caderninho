import { Button, LinkButton } from "@cloudflare/kumo/components/button";
import { Checkbox } from "@cloudflare/kumo/components/checkbox";
import { Input } from "@cloudflare/kumo/components/input";
import { type ComponentProps, useState } from "react";

interface DataAttributes {
  [key: `data-${string}`]: string;
}

export function UiButton({
  tone = "normal",
  variant = "secondary",
  ...props
}: ComponentProps<typeof Button> &
  DataAttributes & { tone?: "normal" | "danger" }) {
  return (
    <Button
      size="base"
      type="submit"
      {...props}
      variant={tone === "danger" ? "destructive" : variant}
    />
  );
}

export function UiLink(props: ComponentProps<typeof LinkButton>) {
  return (
    <LinkButton
      size="base"
      {...props}
    />
  );
}

export function UiField(
  props: ComponentProps<typeof Input> & { label: string },
) {
  return <Input {...props} />;
}

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
