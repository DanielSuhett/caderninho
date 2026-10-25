import { Collapsible } from "@cloudflare/kumo/components/collapsible";
import type { ReactNode } from "react";

// Actions stay in the panel; the complete summary is one keyboard target.
export function DisclosureItem({
  summary,
  children,
  className = "",
  open,
  onOpenChange,
  defaultOpen,
}: {
  summary: ReactNode;
  children: ReactNode;
  className?: string;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  return (
    <Collapsible.Root
      {...(defaultOpen !== undefined && { defaultOpen })}
      {...(open !== undefined && { open })}
      {...(onOpenChange && { onOpenChange })}
      className={`disclosure-item ${className}`}
    >
      <Collapsible.DefaultTrigger className="disclosure-trigger text-base">
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
