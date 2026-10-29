import { Tooltip } from "@cloudflare/kumo/components/tooltip";
import { type MouseEvent, type ReactNode, useCallback, useState } from "react";

import { navigateWorkspace } from "./account-navigation";
import { BackofficeDialog } from "./backoffice-dialog";

export interface AvatarPart {
  content: ReactNode;
  href?: string | undefined;
  key: string;
  label: string;
  selected?: boolean | undefined;
}

// Only the exposed arcs of each 32 px circle belong to the union's outline.
// Adjacent centers are 22 px apart; no stroke crosses an overlap.
function contour(index: number, total: number) {
  if (total === 1) {
    return "M 0 16 A 16 16 0 1 1 32 16 A 16 16 0 1 1 0 16";
  }
  const rise = Math.sqrt(16 ** 2 - 11 ** 2);
  const top = 16 - rise;
  const bottom = 16 + rise;
  if (index === 0) {
    return `M 27 ${top} A 16 16 0 1 0 27 ${bottom}`;
  }
  if (index === total - 1) {
    return `M 5 ${top} A 16 16 0 1 1 5 ${bottom}`;
  }
  return `M 5 ${top} A 16 16 0 0 1 27 ${top} M 27 ${bottom} A 16 16 0 0 1 5 ${bottom}`;
}

export function AvatarStack({
  items,
  label,
  className = "",
  decorative = false,
}: {
  items: AvatarPart[];
  label: string;
  className?: string;
  decorative?: boolean;
}) {
  const interactive = !decorative && items.some((item) => item.href);
  // A stray tap on an avatar must not reshape the page: filtering asks first.
  const [pending, setPending] = useState<AvatarPart | null>(null);
  const close = useCallback(() => setPending(null), []);
  const confirm = useCallback(() => {
    if (pending?.href) {
      navigateWorkspace(new URL(pending.href, location.href));
    }
    setPending(null);
  }, [pending]);
  const ask = useCallback(
    (event: MouseEvent<HTMLAnchorElement>) => {
      if (
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey
      ) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      const { key } = event.currentTarget.dataset;
      setPending(items.find((item) => item.key === key) ?? null);
    },
    [items],
  );
  const parts = items.map((item, index) => {
    const contents = (
      <>
        {item.content}
        <svg
          aria-hidden="true"
          className="avatar-contour"
          height={32}
          viewBox="0 0 32 32"
          width={32}
        >
          <path d={contour(index, items.length)} />
        </svg>
      </>
    );
    return item.href && interactive ? (
      <Tooltip
        content={item.label}
        key={item.key}
        render={
          <a
            aria-current={item.selected ? "true" : undefined}
            aria-label={item.label}
            className="avatar-part avatar-filter-link"
            data-key={item.key}
            href={item.href}
            onClick={ask}
          >
            {contents}
          </a>
        }
      />
    ) : (
      <span
        aria-hidden="true"
        className="avatar-part"
        key={item.key}
      >
        {contents}
      </span>
    );
  });
  const stack = interactive ? (
    <span
      className={`avatar-stack ${className}`}
      data-count={items.length}
    >
      {parts}
    </span>
  ) : (
    <span
      aria-hidden={decorative || undefined}
      aria-label={label}
      className={`avatar-stack ${className}`}
      data-count={items.length}
      role="img"
    >
      {parts}
    </span>
  );
  if (interactive) {
    return (
      <>
        {stack}
        {!!pending && (
          <BackofficeDialog
            busy={false}
            close={close}
            dirty={false}
            open
            presentation="confirmation"
            primaryAction={{
              children: pending.selected ? "Remover filtro" : "Filtrar",
              onClick: confirm,
              type: "button",
            }}
            title={`${pending.label}?`}
          >
            {null}
          </BackofficeDialog>
        )}
      </>
    );
  }
  return decorative ? (
    stack
  ) : (
    <Tooltip
      content={label}
      render={stack}
    />
  );
}
