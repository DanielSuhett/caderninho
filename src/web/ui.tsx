import { Button, LinkButton } from "@cloudflare/kumo/components/button";
import { Tooltip } from "@cloudflare/kumo/components/tooltip";
import type { ComponentProps } from "react";

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

export function UiIconButton({
  label,
  className = "",
  ...props
}: Omit<
  ComponentProps<typeof UiButton>,
  "aria-label" | "aria-labelledby" | "shape" | "title"
> & {
  label: string;
}) {
  return (
    <Tooltip
      content={label}
      render={
        <UiButton
          {...props}
          aria-label={label}
          className={`compact-icon-action ${className}`}
          shape="square"
          type="button"
          variant={props.variant ?? "outline"}
        />
      }
    />
  );
}
