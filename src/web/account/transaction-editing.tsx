import { Banner } from "@cloudflare/kumo/components/banner";
import { Select } from "@cloudflare/kumo/components/select";
import { useKumoToastManager } from "@cloudflare/kumo/components/toast";
import {
  type FormEvent,
  type ReactNode,
  useCallback,
  useId,
  useMemo,
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
import type { OrganizationApi } from "./account-api";
import { BackofficeDialog } from "./backoffice-dialog";
import { CategoryLabel } from "./category-appearance";
import { RuleEditor } from "./rule-editor";
import {
  type EditableTransaction,
  TransactionEditingContext,
} from "./transaction-actions";

type Action = "category" | "rule";

export function TransactionEditing({
  api,
  snapshot,
  catalog,
  accounts,
  revision,
  spaceId,
  saved,
  children,
}: {
  api: OrganizationApi;
  snapshot: PortalResponse;
  catalog: WorkspaceCatalog;
  accounts: {
    id: string;
    name: string;
    personId?: string;
    personName?: string;
  }[];
  revision: number | undefined;
  spaceId: string;
  saved?: () => void;
  children: ReactNode;
}) {
  const [selection, setSelection] = useState<{
    row: EditableTransaction;
    action: Action;
    revision: number;
  } | null>(null);
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState(0);
  const { add: notify } = useKumoToastManager();
  const choose = useCallback(
    (row: EditableTransaction, action: Action) => {
      if (revision === undefined) {
        return;
      }
      setSelection({ action, revision, row });
      setSession((value) => value + 1);
      setOpen(true);
    },
    [revision],
  );
  const close = useCallback(() => setOpen(false), []);
  const onSaved = useCallback(() => {
    setOpen(false);
    notify({
      title:
        selection?.action === "rule"
          ? "Regra criada para as próximas importações."
          : "Categoria salva.",
      variant: "success",
    });
    saved?.();
  }, [notify, saved, selection]);
  const seed = useMemo(
    () =>
      selection
        ? {
            accountId: selection.row.accountId,
            category: selection.row.category,
            currency: selection.row.currency,
            description: selection.row.description,
            direction: selection.row.direction,
          }
        : undefined,
    [selection],
  );
  const accountChoices = useMemo(
    () =>
      accounts.map((account) => ({
        id: account.id,
        name: account.name,
        personName:
          account.personName ??
          snapshot.people.find((person) => person.id === account.personId)
            ?.name ??
          "Pessoa indisponível",
      })),
    [accounts, snapshot.people],
  );
  return (
    <TransactionEditingContext.Provider
      value={revision === undefined ? null : choose}
    >
      {children}
      <TransactionCategoryEditor
        api={api}
        catalog={catalog}
        close={close}
        key={`category-${session}`}
        open={open && selection?.action === "category"}
        revision={selection?.revision}
        row={selection?.row}
        saved={onSaved}
        snapshot={snapshot}
        spaceId={spaceId}
      />
      <RuleEditor
        accounts={accountChoices}
        api={api}
        catalog={catalog}
        close={close}
        key={`rule-${session}`}
        open={open && selection?.action === "rule"}
        saved={onSaved}
        seed={seed}
        snapshot={snapshot}
        spaceId={spaceId}
      />
    </TransactionEditingContext.Provider>
  );
}

function TransactionCategoryEditor({
  row,
  revision,
  api,
  catalog,
  snapshot,
  spaceId,
  open,
  close,
  saved,
}: {
  row: EditableTransaction | undefined;
  revision: number | undefined;
  api: OrganizationApi;
  catalog: WorkspaceCatalog;
  snapshot: PortalResponse;
  spaceId: string;
  open: boolean;
  close: () => void;
  saved: () => void;
}) {
  const [category, setCategory] = useState(row?.category ?? "");
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const formId = useId();
  const receipt = useRef({ key: "", payload: "" });
  const request = useRef<AbortController | null>(null);
  const ids = useMemo(() => {
    if (!row) {
      return [];
    }
    return "installments" in row && row.installments.length
      ? row.installments.map((item) => item.id)
      : [row.id];
  }, [row]);
  const change = useCallback((value: string | null) => {
    setCategory(value ?? "");
    setDirty(true);
  }, []);
  const submit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (request.current || revision === undefined || !ids.length) {
        return;
      }
      const fields = {
        category: category || null,
        expected_revision: revision,
        ids,
        spaceId,
      };
      const payload = JSON.stringify(fields);
      if (receipt.current.payload !== payload) {
        receipt.current = { key: randomId(), payload };
      }
      const parsed = PortalMutationSchema.safeParse({
        command: {
          ...fields,
          confirmed: true,
          idempotency_key: receipt.current.key,
          tool: "batch_edit_transactions",
        },
        csrf: snapshot.csrf,
      });
      if (!parsed.success) {
        setMessage(
          "A seleção deve ter até 500 lançamentos e uma categoria deste grupo.",
        );
        return;
      }
      const controller = new AbortController();
      request.current = controller;
      setBusy(true);
      setMessage("");
      const { data: _data, error } = await tryCatch(() =>
        api.planning(parsed.data.command, snapshot.csrf, controller.signal),
      );
      request.current = null;
      setBusy(false);
      if (error) {
        setMessage(
          "Não foi possível confirmar a categoria. Atualize a lista antes de repetir; os dados podem ter mudado.",
        );
        return;
      }
      setDirty(false);
      saved();
    },
    [api, category, ids, revision, saved, snapshot.csrf, spaceId],
  );
  return (
    <BackofficeDialog
      busy={busy}
      close={close}
      dirty={dirty}
      open={open}
      presentation="compact-editor"
      primaryAction={{
        children: busy ? "Salvando…" : "Salvar categoria",
        disabled: !dirty || ids.length > 500,
        form: formId,
        type: "submit",
      }}
      title="Categorizar transação"
    >
      <form
        className="transaction-category-form"
        id={formId}
        onSubmit={submit}
      >
        <p className="transaction-editor-description">
          {row?.description || "Sem descrição"}
        </p>
        <Select
          className="w-full"
          disabled={busy}
          items={[
            { label: "Sem categoria", value: "" },
            ...catalog.categories
              .filter((item) => !item.hidden || item.id === row?.category)
              .map((item) => ({
                label: <CategoryLabel category={item} />,
                value: item.id,
              })),
          ]}
          label="Categoria"
          onValueChange={change}
          value={category}
        />
        {ids.length > 1 && (
          <p className="muted">
            Aplica às {ids.length} parcelas recebidas desta compra. Parcelas
            futuras ainda não recebidas precisam de uma regra.
          </p>
        )}
        {!!message && (
          <Banner
            description={message}
            role="alert"
            variant="error"
          />
        )}
      </form>
    </BackofficeDialog>
  );
}
