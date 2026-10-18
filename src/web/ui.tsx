import { Button, LinkButton } from "@cloudflare/kumo/components/button";
import { Input } from "@cloudflare/kumo/components/input";
import { useId, type ComponentProps } from "react";

type DataAttributes = { [key: `data-${string}`]: string };

export function UiButton({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<typeof Button> & DataAttributes) {
  return (
    <Button
      size="lg"
      type="submit"
      {...props}
      variant={variant === "primary" ? "secondary" : variant}
      className={`${variant === "primary" ? "caderninho-primary" : ""} ${className}`}
    />
  );
}

export function UiLink({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<typeof LinkButton>) {
  return (
    <LinkButton
      size="lg"
      {...props}
      variant={variant === "primary" ? "secondary" : variant}
      className={`${variant === "primary" ? "caderninho-primary" : ""} ${className}`}
    />
  );
}

export function UiField({
  label,
  ...props
}: ComponentProps<typeof Input> & { label: string }) {
  const generatedId = useId();
  const id = props.id ?? "field-" + generatedId;
  // Keep caller IDs: Kumo's built-in Field wrapper generates its own ID.
  return (
    <div className="field">
      <label
        id={id + "-label"}
        htmlFor={id}
      >
        {label}
      </label>
      <Input
        size="lg"
        {...props}
        id={id}
        aria-labelledby={id + "-label"}
      />
    </div>
  );
}
