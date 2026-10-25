import { Badge } from "@cloudflare/kumo/components/badge";
import { RefreshButton as KumoRefreshButton } from "@cloudflare/kumo/components/button";
import { SkeletonLine } from "@cloudflare/kumo/components/loader";
import { Text } from "@cloudflare/kumo/components/text";
import { Toolbar } from "@cloudflare/kumo/components/toolbar";
import { Tooltip } from "@cloudflare/kumo/components/tooltip";
import { SlidersHorizontalIcon } from "@phosphor-icons/react";
import { type ReactNode, useId } from "react";

import { DisclosureItem } from "./disclosure-item";
import { FilterDialog } from "./filter-dialog";
import { InfoTip } from "./info-tip";

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
          {!!description && <InfoTip label={title}>{description}</InfoTip>}
        </Text>
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
  identity,
  showClear,
}: {
  action: string;
  children: ReactNode;
  context?: string;
  activeCount?: number;
  leading?: ReactNode;
  identity?: ReactNode;
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
              {identity}
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
      {!!context && <span className="sr-only">{context}</span>}
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
          <dt>
            {item.label}
            {!!item.hint && <InfoTip label={item.label}>{item.hint}</InfoTip>}
          </dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
