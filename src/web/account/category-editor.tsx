import { Banner } from "@cloudflare/kumo/components/banner";
import { Input } from "@cloudflare/kumo/components/input";
import { Select } from "@cloudflare/kumo/components/select";
import {
  type ChangeEvent,
  type FormEvent,
  type MouseEvent,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

import {
  PortalMutationSchema,
  type PortalResponse,
  type WorkspaceCatalog,
} from "../../contracts";
import { tryCatch } from "../../shared";
import { randomId } from "../random-id";
import { UiButton } from "../ui";
import type { OrganizationApi } from "./account-api";
import { BackofficeDialog } from "./backoffice-dialog";
import { CategorySymbol, categoryIconOptions } from "./category-appearance";

type Category = WorkspaceCatalog["categories"][number];
type Group = WorkspaceCatalog["categoryGroups"][number];
type Selection =
  | { kind: "category"; row: Category }
  | { kind: "group"; row?: Group };

function categoryCommand({
  selection,
  removing,
  name,
  color,
  icon,
  groupId,
}: {
  selection: Selection;
  removing: boolean;
  name: string;
  color: string;
  icon: Category["icon"];
  groupId: string;
}): Record<string, unknown> {
  if (selection.kind === "category") {
    return {
      color,
      groupId: groupId || null,
      icon,
      id: selection.row.id,
      tool: "update_category",
      ...(!selection.row.system && { name }),
    };
  }
  if (removing && selection.row) {
    return { id: selection.row.id, tool: "delete_category_group" };
  }
  return {
    tool: selection.row ? "update_category_group" : "create_category_group",
    ...(selection.row && { id: selection.row.id }),
    color,
    icon,
    name,
  };
}
function editorTitle(selection: Selection, removing: boolean) {
  if (removing) {
    return "Remover grupo de categorias";
  }
  if (selection.kind === "category") {
    return "Editar categoria";
  }
  return selection.row
    ? "Editar grupo de categorias"
    : "Novo grupo de categorias";
}
function CategoryEditor({
  selection,
  catalog,
  api,
  snapshot,
  spaceId,
  close,
  saved,
}: {
  selection: Selection;
  catalog: WorkspaceCatalog;
  api: OrganizationApi;
  snapshot: PortalResponse;
  spaceId: string;
  close: () => void;
  saved: () => void;
}) {
  const { row } = selection;
  const [name, setName] = useState(row?.name ?? "");
  const [color, setColor] = useState(row?.color ?? "#64748b");
  const [icon, setIcon] = useState<
    WorkspaceCatalog["categories"][number]["icon"]
  >(row?.icon ?? "shopping");
  const [groupId, setGroupId] = useState(
    selection.kind === "category" ? (selection.row.groupId ?? "") : "",
  );
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [removing, setRemoving] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const receipt = useRef({ key: "", payload: "" });
  const id = useId();
  useEffect(() => () => controller.current?.abort(), []);
  const submit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (controller.current) {
        return;
      }
      const fields = categoryCommand({
        color,
        groupId,
        icon,
        name,
        removing,
        selection,
      });
      const payload = JSON.stringify(fields);
      if (receipt.current.payload !== payload) {
        receipt.current = { key: randomId(), payload };
      }
      const input = PortalMutationSchema.safeParse({
        command: {
          ...fields,
          confirmed: true,
          idempotency_key: receipt.current.key,
          spaceId,
        },
        csrf: snapshot.csrf,
      });
      if (!input.success) {
        setMessage("Confira o nome, o ícone e a cor no formato #RRGGBB.");
        return;
      }
      const request = new AbortController();
      controller.current = request;
      setBusy(true);
      setMessage("");
      const { data: _data, error } = await tryCatch(() =>
        api.planning(input.data.command, snapshot.csrf, request.signal),
      );
      if (request.signal.aborted) {
        return;
      }
      controller.current = null;
      setBusy(false);
      if (error) {
        setMessage("Não foi possível salvar. Seu rascunho foi preservado.");
        return;
      }
      saved();
    },
    [
      api,
      color,
      groupId,
      icon,
      name,
      removing,
      saved,
      selection,
      snapshot.csrf,
      spaceId,
    ],
  );
  const markDirty = useCallback(() => {
    setDirty(true);
  }, []);
  const onName = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setName(event.currentTarget.value);
  }, []);
  const onColor = useCallback((event: FormEvent<HTMLInputElement>) => {
    setColor(event.currentTarget.value);
    setDirty(true);
  }, []);
  const onIcon = useCallback((value: Category["icon"] | null) => {
    setIcon(value ?? "shopping");
    setDirty(true);
  }, []);
  const onGroup = useCallback((value: string | null) => {
    setGroupId(value ?? "");
    setDirty(true);
  }, []);
  const remove = useCallback(() => {
    setRemoving(true);
  }, []);
  let actionLabel = removing ? "Remover grupo" : "Salvar";
  if (busy) {
    actionLabel = "Salvando…";
  }
  const fixed = selection.kind === "category" && selection.row.system;
  return (
    <BackofficeDialog
      busy={busy}
      close={close}
      dirty={dirty}
      open
      presentation={removing ? "confirmation" : "compact-editor"}
      primaryAction={{
        children: actionLabel,
        form: id,
        type: "submit",
      }}
      title={editorTitle(selection, removing)}
    >
      <form
        className="backoffice-form"
        id={id}
        onChange={markDirty}
        onSubmit={submit}
      >
        <fieldset disabled={busy}>
          <legend className="sr-only">Organização das categorias</legend>
          {removing ? (
            <p>
              Remover “{row?.name}”? As categorias ficam sem grupo. Suas
              transações e classificações são preservadas.
            </p>
          ) : (
            <>
              <Input
                label="Nome"
                maxLength={240}
                onChange={onName}
                readOnly={fixed}
                required
                value={name}
              />
              {!!fixed && (
                <p className="muted">
                  Categoria fixa de classificação. Configure sua aparência e
                  agrupamento.
                </p>
              )}
              <Select
                items={categoryIconOptions}
                label="Ícone"
                onValueChange={onIcon}
                value={icon}
              />
              <div className="category-color-fields">
                <Input
                  label="Escolher cor"
                  onChange={onColor}
                  onInput={onColor}
                  type="color"
                  value={color}
                />
                <Input
                  label="Cor hexadecimal"
                  maxLength={7}
                  onChange={onColor}
                  pattern="#[0-9a-fA-F]{6}"
                  placeholder="#64748b"
                  required
                  value={color}
                />
              </div>
              {selection.kind === "category" && (
                <Select
                  items={[
                    { label: "Sem grupo", value: "" },
                    ...catalog.categoryGroups.map((group) => ({
                      label: group.name,
                      value: group.id,
                    })),
                  ]}
                  label="Grupo de categorias"
                  onValueChange={onGroup}
                  value={groupId}
                />
              )}
              {selection.kind === "group" && row && (
                <UiButton
                  onClick={remove}
                  type="button"
                  variant="secondary"
                >
                  Remover grupo
                </UiButton>
              )}
            </>
          )}
          {!!message && <Banner variant="error">{message}</Banner>}
        </fieldset>
      </form>
    </BackofficeDialog>
  );
}

export function CategoryOrganization({
  catalog,
  api,
  snapshot,
  spaceId,
  saved,
}: {
  catalog: WorkspaceCatalog;
  api: OrganizationApi;
  snapshot: PortalResponse;
  spaceId: string;
  saved: () => void;
}) {
  const [selection, setSelection] = useState<Selection | null>(null);
  const close = useCallback(() => {
    setSelection(null);
  }, []);
  const savedEditor = useCallback(() => {
    close();
    saved();
  }, [close, saved]);
  const newGroup = useCallback(() => {
    setSelection({ kind: "group" });
  }, []);
  const edit = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      const { kind, id } = event.currentTarget.dataset;
      if (kind === "category") {
        const row = catalog.categories.find((category) => category.id === id);
        if (row) {
          setSelection({ kind: "category", row });
        }
        return;
      }
      const row = catalog.categoryGroups.find((group) => group.id === id);
      if (row) {
        setSelection({ kind: "group", row });
      }
    },
    [catalog.categories, catalog.categoryGroups],
  );
  const sections = [
    ...catalog.categoryGroups,
    { color: "#64748b", icon: "shopping" as const, id: "", name: "Sem grupo" },
  ];
  return (
    <section
      aria-label="Categorias e agrupadores"
      className="category-organization"
    >
      <div className="category-group-heading">
        <p>Grupos reúnem categorias dentro deste espaço financeiro.</p>
        <UiButton
          onClick={newGroup}
          type="button"
          variant="secondary"
        >
          Novo grupo de categorias
        </UiButton>
      </div>
      {sections.map((group) => {
        const categories = catalog.categories.filter(
          (category) =>
            (category.groupId ?? "") === group.id && !category.hidden,
        );
        if (!(group.id || categories.length)) {
          return null;
        }
        return (
          <section
            aria-label={group.name}
            key={group.id}
          >
            <div className="category-group-heading">
              <h3>
                <CategorySymbol
                  color={group.color}
                  icon={group.icon}
                />
                {group.name} <small>({categories.length})</small>
              </h3>
              {!!group.id && (
                <UiButton
                  aria-label={`Editar grupo ${group.name}`}
                  data-id={group.id}
                  data-kind="group"
                  onClick={edit}
                  type="button"
                  variant="secondary"
                >
                  Editar
                </UiButton>
              )}
            </div>
            {categories.length ? (
              <ul className="category-list">
                {categories.map((category) => (
                  <li key={category.id}>
                    <div className="category-label">
                      <CategorySymbol
                        color={category.color}
                        icon={category.icon}
                      />
                      <span>
                        <strong>{category.name}</strong>
                        <small>
                          {category.system
                            ? "Categoria fixa"
                            : "Categoria personalizada"}
                        </small>
                      </span>
                    </div>
                    <UiButton
                      aria-label={`Editar categoria ${category.name}`}
                      data-id={category.id}
                      data-kind="category"
                      onClick={edit}
                      type="button"
                      variant="secondary"
                    >
                      Editar
                    </UiButton>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">Nenhuma categoria neste grupo.</p>
            )}
          </section>
        );
      })}
      {!!selection && (
        <CategoryEditor
          api={api}
          catalog={catalog}
          close={close}
          saved={savedEditor}
          selection={selection}
          snapshot={snapshot}
          spaceId={spaceId}
        />
      )}
    </section>
  );
}
