import { Button } from "@cloudflare/kumo/components/button";
import { Popover } from "@cloudflare/kumo/components/popover";
import type { ReactNode } from "react";

import { dayLabel, momentLabel } from "./workspace-resource";

export function SyncStatusPopover({
  demo,
  icon,
  label,
  trigger,
  updatedAt,
}: {
  demo: boolean;
  icon: ReactNode;
  label: string;
  trigger: {
    "aria-busy": boolean;
    "aria-label": string;
    className: string;
    "data-state": string;
  };
  updatedAt: string | null;
}) {
  return (
    <Popover defaultOpen>
      <Popover.Trigger
        openOnHover
        render={
          <Button
            {...trigger}
            shape="square"
            size="base"
            type="button"
            variant="ghost"
          />
        }
      >
        {icon}
      </Popover.Trigger>
      <Popover.Content
        align="end"
        className="sync-status-panel"
      >
        <Popover.Title>{label}</Popover.Title>
        <Popover.Description>
          {demo ? "Dados fictícios de " : "Última importação concluída: "}
          {updatedAt ? (
            <time dateTime={updatedAt}>
              {updatedAt.length > 10
                ? momentLabel(updatedAt)
                : dayLabel(updatedAt)}
            </time>
          ) : (
            "ainda não registrada"
          )}
          .
        </Popover.Description>
      </Popover.Content>
    </Popover>
  );
}
