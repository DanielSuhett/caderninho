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
      <label>
        Grupo
        <select
          defaultValue={params.get("space") ?? "personal"}
          name="space"
        >
          {catalog.spaces.map((s) => (
            <option
              key={s.id}
              value={s.id}
            >
              {s.name}
            </option>
          ))}
        </select>
      </label>
      {person ? (
        <label>
          Pessoa
          <select
            defaultValue={params.get("person") ?? ""}
            name="person"
          >
            <option value="">Todas as pessoas</option>
            {snapshot.people.map((p) => (
              <option
                key={p.id}
                value={p.id}
              >
                {p.name}
              </option>
            ))}
          </select>
        </label>
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
    <div className="empty-state">
      <h2>{title}</h2>
      <p>{children}</p>
    </div>
  );
}
