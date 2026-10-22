import type { PortalResponse, WorkspaceCatalog } from "../../contracts";
import { UiButton } from "../ui";
import { scopedHref } from "./workspace-resource";

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
export function FilterActions() {
  return (
    <div className="filter-actions">
      <UiButton type="submit">Aplicar filtros</UiButton>
      <a
        href={scopedHref(
          location.pathname,
          new URLSearchParams(location.search),
        )}
      >
        Limpar filtros
      </a>
    </div>
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
