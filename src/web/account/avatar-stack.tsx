import { Tooltip } from "@cloudflare/kumo/components/tooltip";
import type { ReactNode } from "react";

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
            href={item.href}
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
  return interactive || decorative ? (
    stack
  ) : (
    <Tooltip
      content={label}
      render={stack}
    />
  );
}
