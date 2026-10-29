import { Badge } from "@cloudflare/kumo/components/badge";
import { Banner } from "@cloudflare/kumo/components/banner";
import { Input } from "@cloudflare/kumo/components/input";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Select } from "@cloudflare/kumo/components/select";
import { Switch } from "@cloudflare/kumo/components/switch";
import { Table } from "@cloudflare/kumo/components/table";
import { PencilSimpleIcon } from "@phosphor-icons/react";
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
import { CategoryKind } from "../../domain";
import { tryCatch } from "../../shared";
import { randomId } from "../random-id";
import type { OrganizationApi } from "./account-api";
import { BackofficeDialog } from "./backoffice-dialog";
import { CategorySymbol, categoryIconOptions } from "./category-appearance";
import { InfoTip } from "./info-tip";
import { RowMenu } from "./row-menu";

type Category = WorkspaceCatalog["categories"][number];

function categoryCommand({
  row,
  name,
  color,
  icon,
}: {
  row: Category;
  name: string;
  color: string;
  icon: Category["icon"];
}) {
  return {
    color,
    icon,
    id: row.id,
    tool: "update_category" as const,
    ...(!row.system && { name }),
  };
}
function CategoryEditor({
  row,
  api,
  snapshot,
  spaceId,
  close,
  saved,
  open,
}: {
  row: Category;
  api: OrganizationApi;
  snapshot: PortalResponse;
  spaceId: string;
  close: () => void;
  saved: () => void;
  open: boolean;
}) {
  const [name, setName] = useState(row.name);
  const [color, setColor] = useState(row.color ?? "#64748b");
  const [icon, setIcon] = useState<Category["icon"]>(row.icon ?? "shopping");
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
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
      const fields = categoryCommand({ color, icon, name, row });
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
    [api, color, icon, name, row, saved, snapshot.csrf, spaceId],
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
  const fixed = row.system;
  return (
    <BackofficeDialog
      busy={busy}
      close={close}
      dirty={dirty}
      open={open}
      presentation="compact-editor"
      primaryAction={{
        children: busy ? "Salvando…" : "Salvar",
        form: id,
        type: "submit",
      }}
      title="Editar categoria"
    >
      <form
        className="backoffice-form"
        id={id}
        onChange={markDirty}
        onSubmit={submit}
      >
        <fieldset disabled={busy}>
          <legend className="sr-only">Organização das categorias</legend>
          <Input
            label="Nome"
            maxLength={240}
            onChange={onName}
            readOnly={fixed}
            required
            value={name}
          />
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
  // Toggles apply at once; the override holds the choice until the catalog reloads.
  const [overrides, setOverrides] = useState<ReadonlyMap<string, boolean>>(
    new Map(),
  );
  const [failed, setFailed] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState(0);
  const close = useCallback(() => {
    setOpen(false);
  }, []);
  const savedEditor = useCallback(() => {
    close();
    saved();
  }, [close, saved]);
  const edit = useCallback(
    (event: MouseEvent<HTMLElement>) => {
      const row = catalog.categories.find(
        (category) => category.id === event.currentTarget.dataset.id,
      );
      if (row) {
        setEditing(row);
        setSession((value) => value + 1);
        setOpen(true);
      }
    },
    [catalog.categories],
  );
  const isFixed = (category: Category) =>
    overrides.get(category.id) ?? category.fixedCost;
  const setFixed = useCallback(
    async (category: Category, fixed: boolean) => {
      setFailed(false);
      setOverrides((current) => new Map(current).set(category.id, fixed));
      const input = PortalMutationSchema.safeParse({
        command: {
          confirmed: true,
          fixedCost: fixed,
          id: category.id,
          idempotency_key: randomId(),
          spaceId,
          tool: "update_category",
        },
        csrf: snapshot.csrf,
      });
      if (!input.success) {
        return;
      }
      const { error } = await tryCatch(() =>
        api.planning(
          input.data.command,
          snapshot.csrf,
          new AbortController().signal,
        ),
      );
      if (error) {
        setFailed(true);
        setOverrides((current) => {
          const next = new Map(current);
          next.delete(category.id);
          return next;
        });
        return;
      }
      api.invalidate();
    },
    [api, snapshot.csrf, spaceId],
  );
  const visible = catalog.categories
    .filter((category) => !category.hidden)
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  const expenses = visible.filter(
    (category) => category.kind === CategoryKind.expense,
  );
  const others = visible.filter(
    (category) => category.kind !== CategoryKind.expense,
  );
  const fixedCount = expenses.filter(isFixed).length;
  return (
    <section
      aria-labelledby="category-map-heading"
      className="category-organization"
    >
      <header className="category-map-header">
        <h3 id="category-map-heading">
          Categorias <Badge variant="secondary">{visible.length}</Badge>
        </h3>
        <span className="category-fixed-count">
          {fixedCount} em custo fixo
          <InfoTip label="Custo fixo">
            O custo fixo soma o que se repete todo mês e é a base da reserva de
            emergência.
          </InfoTip>
        </span>
      </header>
      {!!failed && (
        <Banner variant="error">
          Não foi possível salvar a mudança. Tente de novo.
        </Banner>
      )}
      <LayerCard className="ledger-surface">
        <Table
          aria-labelledby="category-map-heading"
          className="ledger-table category-table"
          layout="fixed"
        >
          <colgroup>
            <col />
            <col className="category-fixed-column" />
            <col className="ledger-actions" />
          </colgroup>
          <Table.Header>
            <Table.Row>
              <Table.Head>Categoria</Table.Head>
              <Table.Head>Custo fixo</Table.Head>
              <Table.Head>
                <span className="sr-only">Ações</span>
              </Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {[...expenses, ...others].map((category) => (
              <Table.Row key={category.id}>
                <Table.Cell>
                  <span className="ledger-primary category-row">
                    <CategorySymbol
                      color={category.color}
                      icon={category.icon}
                    />
                    {category.name}
                  </span>
                </Table.Cell>
                <Table.Cell>
                  {category.kind === CategoryKind.expense ? (
                    <FixedCostSwitch
                      category={category}
                      checked={isFixed(category)}
                      onChange={setFixed}
                    />
                  ) : (
                    <span className="ledger-muted">
                      {category.kind === CategoryKind.income
                        ? "Receita"
                        : "Transferência"}
                    </span>
                  )}
                </Table.Cell>
                <Table.Cell className="ledger-actions">
                  <RowMenu
                    items={[
                      {
                        "data-id": category.id,
                        icon: <PencilSimpleIcon size={16} />,
                        key: "edit",
                        label: "Editar categoria",
                        onClick: edit,
                      },
                    ]}
                    label={`Ações de ${category.name}`}
                  />
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      </LayerCard>
      {!!editing && (
        <CategoryEditor
          api={api}
          close={close}
          key={session}
          open={open}
          row={editing}
          saved={savedEditor}
          snapshot={snapshot}
          spaceId={spaceId}
        />
      )}
    </section>
  );
}

function FixedCostSwitch({
  category,
  checked,
  onChange,
}: {
  category: Category;
  checked: boolean;
  onChange: (category: Category, fixed: boolean) => Promise<void>;
}) {
  const change = useCallback(
    (value: boolean) => {
      onChange(category, value).then(
        () => undefined,
        () => undefined,
      );
    },
    [category, onChange],
  );
  return (
    <Switch
      aria-label={`${category.name} no custo fixo`}
      checked={checked}
      onCheckedChange={change}
    />
  );
}
