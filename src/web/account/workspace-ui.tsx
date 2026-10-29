import { Badge } from "@cloudflare/kumo/components/badge";
import { Text } from "@cloudflare/kumo/components/text";
import { Toolbar } from "@cloudflare/kumo/components/toolbar";
import { SlidersHorizontalIcon } from "@phosphor-icons/react";
import { type ReactNode, useId } from "react";

import type { FinancialIdentity } from "../../domain";
import { DisclosureItem } from "./disclosure-item";
import { FilterDialog } from "./filter-dialog";
import { IdentityFilterChips } from "./identity-filters";
import { InfoTip } from "./info-tip";

export function WorkspaceHeading({
  title,
  description,
  filters,
  children,
}: {
  title: string;
  description?: string;
  filters?: ReactNode;
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
      {!!(filters || children) && (
        <div className="page-actions">
          {filters}
          {children}
        </div>
      )}
    </header>
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
  identities = [],
}: {
  action: string;
  children: ReactNode;
  context?: string;
  activeCount?: number;
  leading?: ReactNode;
  identity?: ReactNode;
  showClear?: boolean;
  identities?: Array<{ identity?: FinancialIdentity | null | undefined }>;
}) {
  const formId = useId();
  const filters = new URLSearchParams(location.search);
  filters.delete("grid");
  const identityCount =
    Number(!!filters.get("institutionId")) + Number(!!filters.get("cardBrand"));
  const count = activeCount + identityCount;
  return (
    <div className="filter-toolbar">
      {leading}
      <div className="scope-filter-actions">
        {identity}
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
                Filtros{count > 0 ? ` · ${count}` : ""}
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
          {(identityCount > 0 ||
            (showClear ?? (activeCount > 0 || filters.size > 0))) && (
            <Toolbar.Link href={action}>Limpar</Toolbar.Link>
          )}
        </Toolbar>
      </div>
      <IdentityFilterChips
        identities={identities}
        params={filters}
      />
      {!!context && <span className="sr-only">{context}</span>}
    </div>
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
