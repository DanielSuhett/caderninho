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
  leading,
}: {
  summary: ReactNode;
  children: ReactNode;
  className?: string;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  leading?: ReactNode;
}) {
  const trigger = (
    <Collapsible.DefaultTrigger className="disclosure-trigger text-base">
      <span className="disclosure-label">{summary}</span>
    </Collapsible.DefaultTrigger>
  );
  let heading = trigger;
  if (leading) {
    heading = (
      <div className="disclosure-summary">
        <div className="disclosure-leading">{leading}</div>
        {trigger}
      </div>
    );
  }
  return (
    <Collapsible.Root
      {...(defaultOpen !== undefined && { defaultOpen })}
      {...(open !== undefined && { open })}
      {...(onOpenChange && { onOpenChange })}
      className={`disclosure-item ${className}`}
    >
      {heading}
      <Collapsible.Panel
        className="disclosure-panel"
        keepMounted
      >
        <div className="disclosure-content">{children}</div>
      </Collapsible.Panel>
    </Collapsible.Root>
  );
}
