import {
  ArrowClockwiseIcon,
  SlidersHorizontalIcon,
} from "@phosphor-icons/react";
import { type ReactNode, useId } from "react";

import { UiButton } from "../ui";
import { DisclosureItem } from "./disclosure-item";
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
  context,
  activeCount = 0,
}: {
  action: string;
  children: ReactNode;
  context?: string;
  activeCount?: number;
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
            Filtros{activeCount > 0 ? ` · ${activeCount}` : ""}
          </>
        }
      >
        <form
          action={action}
          className="workspace-filters"
          id={formId}
          method="get"
        >
          {children}
          <a
            className="filter-clear"
            href={action}
          >
            Limpar filtros
          </a>
        </form>
      </WorkspaceDrawer>
      {!!context && <p className="filter-context">{context}</p>}
    </div>
  );
}

export function RecordReference({ children }: { children: ReactNode }) {
  return (
    <DisclosureItem
      className="record-reference"
      summary="Referência técnica"
    >
      <dl className="detail-list">{children}</dl>
    </DisclosureItem>
  );
}

export function WorkspaceDetails({
  title,
  children,
  hint,
}: {
  title: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <DisclosureItem
      className="workspace-details"
      summary={
        <>
          <h2 className="workspace-details-title">{title}</h2>
          {!!hint && <span className="workspace-details-hint">{hint}</span>}
        </>
      }
    >
      <div className="workspace-details-body">{children}</div>
    </DisclosureItem>
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
