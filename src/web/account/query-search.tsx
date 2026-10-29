import { InputGroup } from "@cloudflare/kumo/components/input-group";
import { MagnifyingGlassIcon } from "@phosphor-icons/react";
import type { ComponentProps } from "react";

import { UiButton } from "../ui";

function SearchField({
  label,
  ...props
}: ComponentProps<typeof InputGroup.Input> & { label: string }) {
  return (
    <InputGroup label={label}>
      <InputGroup.Addon>
        <MagnifyingGlassIcon
          aria-hidden
          size={16}
        />
      </InputGroup.Addon>
      <InputGroup.Input
        aria-label={label}
        {...props}
        type="search"
      />
    </InputGroup>
  );
}

// A GET search preserves applied scope/filters and starts again without a cursor.
export function QuerySearch({
  action,
  params,
  name,
  label,
  compact = false,
}: {
  action: string;
  params: URLSearchParams;
  name: "text" | "q";
  label: string;
  compact?: boolean;
}) {
  return (
    <form
      action={action}
      className="query-search"
      data-compact={compact}
      method="get"
    >
      {[...params.entries()]
        .filter(([key]) => key !== name && key !== "cursor")
        .map(([key, value]) => (
          <input
            key={key}
            name={key}
            type="hidden"
            value={value}
          />
        ))}
      {compact ? (
        <InputGroup>
          <InputGroup.Input
            aria-keyshortcuts="/"
            aria-label={label}
            defaultValue={params.get(name) ?? ""}
            enterKeyHint="search"
            maxLength={240}
            name={name}
            placeholder={label}
            type="search"
          />
          <InputGroup.Addon align="end">
            <InputGroup.Button
              icon={MagnifyingGlassIcon}
              tooltip="Buscar"
              type="submit"
            />
          </InputGroup.Addon>
        </InputGroup>
      ) : (
        <>
          <SearchField
            defaultValue={params.get(name) ?? ""}
            label={label}
            maxLength={240}
            name={name}
            placeholder="Ex.: mercado"
          />
          <UiButton
            type="submit"
            variant="secondary"
          >
            Buscar
          </UiButton>
        </>
      )}
    </form>
  );
}
