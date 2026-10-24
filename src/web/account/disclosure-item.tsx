import { Collapsible } from "@cloudflare/kumo";
import type { ReactNode } from "react";

// Actions stay in the panel; the complete summary is one keyboard target.
export function DisclosureItem({
  summary,
  children,
  className = "",
  open,
  onOpenChange,
}: {
  summary: ReactNode;
  children: ReactNode;
  className?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  return (
    <Collapsible.Root
      {...(open !== undefined && { open })}
      {...(onOpenChange && { onOpenChange })}
      className={`disclosure-item ${className}`}
    >
      <Collapsible.DefaultTrigger className="disclosure-trigger text-sm">
        <span className="disclosure-label">{summary}</span>
      </Collapsible.DefaultTrigger>
      <Collapsible.DefaultPanel
        className="disclosure-panel"
        keepMounted
      >
        {children}
      </Collapsible.DefaultPanel>
    </Collapsible.Root>
  );
}
