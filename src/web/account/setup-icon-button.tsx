import { Tooltip } from "@cloudflare/kumo/components/tooltip";
import type { MouseEventHandler, ReactNode } from "react";

import { UiButton } from "../ui";

export function SetupIconButton({
  label,
  ...props
}: {
  label: string;
  children: ReactNode;
  onClick: MouseEventHandler<HTMLButtonElement>;
  disabled?: boolean;
  "aria-expanded"?: boolean;
  variant?: "primary" | "outline";
}) {
  return (
    <Tooltip
      content={label}
      render={
        <UiButton
          aria-label={label}
          shape="square"
          type="button"
          variant="outline"
          {...props}
        />
      }
    />
  );
}
