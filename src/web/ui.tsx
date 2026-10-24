import { Button, LinkButton } from "@cloudflare/kumo/components/button";
import { Input } from "@cloudflare/kumo/components/input";
import { type ComponentProps, useId } from "react";

interface DataAttributes {
  [key: `data-${string}`]: string;
}

export function UiButton({
  variant = "primary",
  tone = "normal",
  className = "",
  ...props
}: ComponentProps<typeof Button> &
  DataAttributes & { tone?: "normal" | "danger" }) {
  return (
    <Button
      size="base"
      type="submit"
      {...props}
      className={`${tone === "danger" ? "caderninho-danger" : ""} ${variant === "primary" && tone === "normal" ? "caderninho-primary" : ""} ${className}`}
      variant={
        variant === "primary" || variant === "secondary" ? "outline" : variant
      }
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
      size="base"
      {...props}
      className={`${variant === "primary" ? "caderninho-primary" : ""} ${className}`}
      variant={
        variant === "primary" || variant === "secondary" ? "outline" : variant
      }
    />
  );
}

export function UiField({
  label,
  ...props
}: ComponentProps<typeof Input> & { label: string }) {
  const generatedId = useId();
  const id = props.id ?? `field-${generatedId}`;
  // Keep caller IDs: Kumo's built-in Field wrapper generates its own ID.
  return (
    <div className="field">
      <label
        htmlFor={id}
        id={`${id}-label`}
      >
        {label}
      </label>
      <Input
        size="lg"
        {...props}
        aria-labelledby={`${id}-label`}
        id={id}
      />
    </div>
  );
}
