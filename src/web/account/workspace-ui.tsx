import { ArrowClockwiseIcon } from "@phosphor-icons/react";
import type { ReactNode } from "react";

import { UiButton } from "../ui";

export function WorkspaceHeading({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <header className="workspace-heading">
      <div>
        <h1>{title}</h1>
        {!!description && <p>{description}</p>}
      </div>
      {children}
    </header>
  );
}

export function RefreshButton({
  onClick,
  disabled = false,
  label = "Atualizar dados",
}: {
  onClick: () => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <span className="icon-action">
      <UiButton
        aria-label={label}
        className="icon-button"
        disabled={disabled}
        onClick={onClick}
        type="button"
        variant="secondary"
      >
        <ArrowClockwiseIcon
          aria-hidden="true"
          size={20}
        />
      </UiButton>
      <span
        aria-hidden="true"
        className="action-tooltip"
      >
        {label}
      </span>
    </span>
  );
}

export function WorkspaceSkeleton() {
  return (
    <div
      aria-busy="true"
      className="workspace-skeleton"
      role="status"
    >
      <span className="sr-only">Carregando dados salvos…</span>
      <div
        aria-hidden="true"
        className="skeleton-controls"
      />
      {["first", "second", "third", "fourth"].map((row) => (
        <div
          aria-hidden="true"
          className="skeleton-row"
          key={row}
        >
          <span />
          <span />
          <span />
        </div>
      ))}
    </div>
  );
}

export function FilterBar({
  action,
  children,
}: {
  action: string;
  children: ReactNode;
}) {
  return (
    <form
      action={action}
      className="workspace-filters"
      method="get"
    >
      {children}
    </form>
  );
}
export function WorkspaceMetrics({
  items,
}: {
  items: Array<{ label: string; value: ReactNode; hint?: string }>;
}) {
  return (
    <dl className="workspace-metrics">
      {items.map((item) => (
        <div key={item.label}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
          {!!item.hint && <small>{item.hint}</small>}
        </div>
      ))}
    </dl>
  );
}
