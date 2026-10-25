import { Tooltip } from "@cloudflare/kumo/components/tooltip";
import { InfoIcon } from "@phosphor-icons/react";
import type { ReactNode } from "react";

export function InfoTip({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <Tooltip
      content={children}
      render={
        <button
          aria-label={`Sobre ${label}`}
          className="info-tip"
          type="button"
        >
          <InfoIcon
            aria-hidden
            size={16}
          />
        </button>
      }
    />
  );
}
