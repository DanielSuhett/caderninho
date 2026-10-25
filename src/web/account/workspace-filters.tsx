import { Empty } from "@cloudflare/kumo/components/empty";
import { Select } from "@cloudflare/kumo/components/select";

import type { PortalResponse, WorkspaceCatalog } from "../../contracts";
import { PersonIdentity } from "./person-identity";

export function ScopeFields({
  snapshot,
  catalog,
  params,
  person = true,
  compact = false,
}: {
  snapshot: PortalResponse;
  catalog: Pick<WorkspaceCatalog, "spaces">;
  params: URLSearchParams;
  person?: boolean;
  compact?: boolean;
}) {
  return (
    <>
      {compact && catalog.spaces.length < 2 ? (
        <input
          name="space"
          type="hidden"
          value={params.get("space") ?? "personal"}
        />
      ) : (
        <Select
          className="w-full"
          defaultValue={params.get("space") ?? "personal"}
          items={[
            ...catalog.spaces.map((s) => ({ label: s.name, value: s.id })),
          ]}
          label="Grupo"
          name="space"
        />
      )}
      {person ? (
        <Select
          className="w-full"
          defaultValue={params.get("person") ?? ""}
          items={[
            { label: "Todas as pessoas", value: "" },
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
