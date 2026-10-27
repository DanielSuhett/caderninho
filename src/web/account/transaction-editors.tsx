import { Banner } from "@cloudflare/kumo/components/banner";
import { Select } from "@cloudflare/kumo/components/select";
import {
  type FormEvent,
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
import type { EditableTransaction } from "./transaction-actions";

type Action = "category" | "rule";

// Editors load on the first edit: their forms validate input with Zod.
export function TransactionEditors({
  accounts,
  action,
  api,
  catalog,
  close,
  open,
  revision,
  row,
  saved,
  session,
  snapshot,
  spaceId,
}: {
  accounts: { id: string; name: string; personName: string }[];
  action: Action;
  api: OrganizationApi;
  catalog: WorkspaceCatalog;
  close: () => void;
  open: boolean;
  revision: number;
  row: EditableTransaction;
  saved: () => void;
  session: number;
  snapshot: PortalResponse;
  spaceId: string;
}) {
  const seed = useMemo(
    () => ({
      accountId: row.accountId,
      category: row.category,
      currency: row.currency,
      description: row.description,
      direction: row.direction,
    }),
    [row],
  );
  return (
    <>
      <TransactionCategoryEditor
        api={api}
        catalog={catalog}
        close={close}
        key={`category-${session}`}
        open={open && action === "category"}
        revision={revision}
        row={row}
        saved={saved}
        snapshot={snapshot}
        spaceId={spaceId}
      />
      <RuleEditor
        accounts={accounts}
        api={api}
        catalog={catalog}
        close={close}
        key={`rule-${session}`}
        open={open && action === "rule"}
        saved={saved}
        seed={seed}
        snapshot={snapshot}
        spaceId={spaceId}
      />
    </>
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
