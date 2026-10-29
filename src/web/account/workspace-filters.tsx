import { Empty } from "@cloudflare/kumo/components/empty";

import type { PortalResponse, WorkspaceCatalog } from "../../contracts";
import { FieldSelect } from "./field-select";
import { PersonIdentity } from "./person-identity";

export function ScopeFields({
  snapshot,
  catalog,
  params,
  person = true,
  space = true,
  identityFilters = true,
}: {
  snapshot: PortalResponse;
  catalog: Pick<WorkspaceCatalog, "spaces">;
  params: URLSearchParams;
  person?: boolean;
  // Pages that choose the group elsewhere only keep it as a hidden field.
  space?: boolean;
  identityFilters?: boolean;
}) {
  const identityNames = identityFilters ? ["institutionId", "cardBrand"] : [];
  return (
    <>
      {identityNames
        .filter((name) => !!params.get(name))
        .map(
          (name) =>
            !!params.get(name) && (
              <input
                key={name}
                name={name}
                type="hidden"
                value={params.get(name) ?? ""}
              />
            ),
        )}
      {!space ||
      (catalog.spaces.length < 2 &&
        (!params.get("space") ||
          catalog.spaces.some((s) => s.id === params.get("space")))) ? (
        <input
          name="space"
          type="hidden"
          value={params.get("space") ?? "personal"}
        />
      ) : (
        <FieldSelect
          className="w-full"
          defaultValue={params.get("space") ?? "personal"}
          items={[
            ...(params.get("space") &&
            !catalog.spaces.some((s) => s.id === params.get("space"))
              ? [
                  {
                    label: "Grupo indisponível",
                    value: params.get("space") ?? "",
                  },
                ]
              : []),
            ...catalog.spaces.map((s) => ({ label: s.name, value: s.id })),
          ]}
          label="Grupo"
          name="space"
        />
      )}
      {person && (snapshot.people.length > 1 || !!params.get("person")) ? (
        <FieldSelect
          className="w-full"
          defaultValue={params.get("person") ?? ""}
          items={[
            { label: "Todas as pessoas", value: "" },
            ...(params.get("person") &&
            !snapshot.people.some((p) => p.id === params.get("person"))
              ? [
                  {
                    label: "Pessoa indisponível",
                    value: params.get("person") ?? "",
                  },
                ]
              : []),
            ...snapshot.people.map((p) => ({
              label: (
                <PersonIdentity
                  compact
                  person={p}
                />
              ),
              value: p.id,
            })),
          ]}
          label="Pessoa"
          name="person"
        />
      ) : (
        <input
          name="person"
          type="hidden"
          value={params.get("person") ?? ""}
        />
      )}
    </>
  );
}
export function EmptyView({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Empty
      contents={<p>{children}</p>}
      size="sm"
      title={title}
    />
  );
}
