import { PlusIcon } from "@phosphor-icons/react";

import { UiButton, UiLink } from "../ui";

export interface ScopeItem {
  href: string;
  id: string;
  name: string;
}

// One choice of owner (person, group) with its actions in the panel below.
export function ScopePicker({
  items,
  currentId,
  label,
  create,
}: {
  items: ScopeItem[];
  currentId: string;
  label: string;
  create?: { label: string; onClick: () => void } | undefined;
}) {
  return (
    <nav
      aria-label={label}
      className="scope-picker"
    >
      {items.map((item) => (
        <UiLink
          aria-current={item.id === currentId ? "page" : undefined}
          href={item.href}
          key={item.id}
          variant={item.id === currentId ? "secondary" : "outline"}
        >
          {item.name}
        </UiLink>
      ))}
      {!!create && (
        <UiButton
          onClick={create.onClick}
          type="button"
          variant="ghost"
        >
          <PlusIcon size={20} />
          {create.label}
        </UiButton>
      )}
    </nav>
  );
}
