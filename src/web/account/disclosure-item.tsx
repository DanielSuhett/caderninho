import { CaretDownIcon } from "@phosphor-icons/react";
import type { ReactNode } from "react";

// Keep links and actions in children: summary is one native keyboard target.
export function DisclosureItem({
  summary,
  children,
  className = "",
}: {
  summary: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <details className={`disclosure-item ${className}`}>
      <summary className="disclosure-summary">
        {summary}
        <CaretDownIcon
          aria-hidden
          className="disclosure-chevron"
          size={16}
        />
      </summary>
      {children}
    </details>
  );
}
