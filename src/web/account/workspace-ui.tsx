import {
  Badge,
  RefreshButton as KumoRefreshButton,
  SkeletonLine,
  Text,
  Toolbar,
  Tooltip,
} from "@cloudflare/kumo";
import { SlidersHorizontalIcon } from "@phosphor-icons/react";
import { type ReactNode, useId } from "react";

import { DisclosureItem } from "./disclosure-item";
import { FilterDialog } from "./filter-dialog";

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
        <Text
          as="h1"
          size="lg"
          variant="heading"
        >
          {title}
        </Text>
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
    <Tooltip
      content={label}
      render={
        <KumoRefreshButton
          aria-label={label}
          disabled={disabled}
          onClick={onClick}
        />
      }
    />
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
      {["first", "second", "third", "fourth"].map((row) => (
        <div
          aria-hidden
          className="skeleton-row"
          key={row}
        >
          <SkeletonLine
            blockHeight={16}
            maxWidth={80}
            minWidth={60}
          />
          <SkeletonLine
            blockHeight={16}
            maxWidth={60}
            minWidth={40}
          />
        </div>
      ))}
    </div>
  );
}

export function WorkspaceFilters({
  action,
  children,
  context,
  activeCount = 0,
  leading,
  showClear,
}: {
  action: string;
  children: ReactNode;
  context?: string;
  activeCount?: number;
  leading?: ReactNode;
  showClear?: boolean;
}) {
  const formId = useId();
  const filters = new URLSearchParams(location.search);
  filters.delete("grid");
  return (
    <div className="filter-toolbar">
      {leading}
      <Toolbar aria-label="Filtros da consulta">
        <FilterDialog
          formId={formId}
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
        </FilterDialog>
        {(showClear ?? (activeCount > 0 || filters.size > 0)) && (
          <Toolbar.Link href={action}>Limpar</Toolbar.Link>
        )}
      </Toolbar>
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
  open,
  onOpenChange,
  defaultOpen,
}: {
  title: string;
  children: ReactNode;
  hint?: string;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  return (
    <DisclosureItem
      className="workspace-details"
      {...(defaultOpen !== undefined && { defaultOpen })}
      {...(onOpenChange && { onOpenChange })}
      {...(open !== undefined && { open })}
      summary={
        <>
          <span className="workspace-details-title">{title}</span>
          {!!hint && <Badge variant="secondary">{hint}</Badge>}
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
