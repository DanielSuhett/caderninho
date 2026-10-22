import {
  ArrowClockwiseIcon,
  SlidersHorizontalIcon,
} from "@phosphor-icons/react";
import { type ReactNode, useId } from "react";

import { UiButton } from "../ui";
import { WorkspaceDrawer } from "./workspace-drawer";

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

export function FilterDrawer({
  action,
  children,
  summary,
}: {
  action: string;
  children: ReactNode;
  summary: string[];
}) {
  const formId = useId();
  return (
    <div className="filter-toolbar">
      <WorkspaceDrawer
        footer={
          <UiButton
            form={formId}
            type="submit"
          >
            Aplicar filtros
          </UiButton>
        }
        title="Filtros"
        trigger={
          <>
            <SlidersHorizontalIcon
              aria-hidden="true"
              size={20}
            />
            Filtros
          </>
        }
      >
        <p className="muted">As alterações só valem depois de aplicar.</p>
        <form
          action={action}
          className="workspace-filters"
          id={formId}
          method="get"
        >
          {children}
        </form>
      </WorkspaceDrawer>
      <ul
        aria-label="Recorte aplicado"
        className="applied-filters"
      >
        {summary.map((value) => (
          <li key={value}>{value}</li>
        ))}
      </ul>
      <a
        className="filter-clear"
        href={action}
      >
        Limpar filtros
      </a>
    </div>
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
