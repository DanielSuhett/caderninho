import { Empty, Select } from "@cloudflare/kumo";

import type { PortalResponse, WorkspaceCatalog } from "../../contracts";

export function ScopeFields({
  snapshot,
  catalog,
  params,
  person = true,
}: {
  snapshot: PortalResponse;
  catalog: WorkspaceCatalog;
  params: URLSearchParams;
  person?: boolean;
}) {
  return (
    <>
      <Select
        className="w-full"
        defaultValue={params.get("space") ?? "personal"}
        items={[...catalog.spaces.map((s) => ({ label: s.name, value: s.id }))]}
        label="Grupo"
        name="space"
      />
      {person ? (
        <Select
          className="w-full"
          defaultValue={params.get("person") ?? ""}
          items={[
            { label: "Todas as pessoas", value: "" },
            ...snapshot.people.map((p) => ({ label: p.name, value: p.id })),
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
