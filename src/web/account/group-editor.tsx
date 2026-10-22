import {
  type ChangeEvent,
  type FormEvent,
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
import { UiButton } from "../ui";
import type { createAccountApi } from "./account-api";
import { BackofficeDialog } from "./backoffice-dialog";

type Space = WorkspaceCatalog["spaces"][number];
export function GroupEditor({
  api,
  snapshot,
  space,
  close,
  saved,
}: {
  api: ReturnType<typeof createAccountApi>;
  snapshot: PortalResponse;
  space?: Space;
  close: () => void;
  saved: () => void;
}) {
  const [name, setName] = useState(space?.name ?? "");
  const [type, setType] = useState<string>(space?.type ?? "personal");
  const [currency, setCurrency] = useState(space?.currency ?? "BRL");
  const [day, setDay] = useState(String(space?.monthStartDay ?? 1));
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
      const fields = {
        monthStartDay: Number(day),
        name,
        type,
        ...(space
          ? { id: space.id, spaceId: space.id, tool: "update_space" }
          : { currency, spaceId: "personal", tool: "create_space" }),
      };
      const payload = JSON.stringify(fields);
      if (receipt.current.payload !== payload) {
        receipt.current = { key: crypto.randomUUID(), payload };
      }
      const input = PortalMutationSchema.safeParse({
        command: {
          ...fields,
          confirmed: true,
          idempotency_key: receipt.current.key,
        },
        csrf: snapshot.csrf,
      });
      if (!input.success) {
        setMessage("Confira o nome, o tipo, a moeda e o dia entre 1 e 28.");
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
        setMessage(
          "Não foi possível salvar. Seu rascunho foi preservado; tente novamente.",
        );
        return;
      }
      saved();
    },
    [api, currency, day, name, saved, snapshot.csrf, space, type],
  );
  const markDirty = useCallback(() => setDirty(true), []);
  const onName = useCallback(
    (event: ChangeEvent<HTMLInputElement>) =>
      setName(event.currentTarget.value),
    [],
  );
  const onType = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) =>
      setType(event.currentTarget.value),
    [],
  );
  const onCurrency = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) =>
      setCurrency(event.currentTarget.value),
    [],
  );
  const onDay = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => setDay(event.currentTarget.value),
    [],
  );
  let submitLabel = space ? "Salvar alterações" : "Criar grupo";
  if (busy) {
    submitLabel = "Salvando…";
  }
  return (
    <BackofficeDialog
      busy={busy}
      close={close}
      dirty={dirty}
      footer={
        <UiButton
          disabled={busy}
          form={id}
          type="submit"
        >
          {submitLabel}
        </UiButton>
      }
      title={space ? "Editar grupo" : "Novo grupo"}
    >
      <form
        className="backoffice-form"
        id={id}
        onChange={markDirty}
        onSubmit={submit}
      >
        <fieldset disabled={busy}>
          <legend>Organização financeira</legend>
          <label>
            Nome do grupo
            <input
              maxLength={240}
              onChange={onName}
              placeholder="Ex.: Casa em comum"
              required
              value={name}
            />
          </label>
          <div className="editor-grid">
            <label>
              Tipo
              <select
                onChange={onType}
                value={type}
              >
                <option value="personal">Pessoal</option>
                <option value="family">Família</option>
                <option value="business">Profissional</option>
              </select>
            </label>
            <label>
              Início do mês
              <input
                max={28}
                min={1}
                onChange={onDay}
                required
                type="number"
                value={day}
              />
            </label>
          </div>
          <label>
            Moeda
            <select
              disabled={!!space}
              onChange={onCurrency}
              value={currency}
            >
              {[
                "BRL",
                "USD",
                "EUR",
                "GBP",
                "ARS",
                "AUD",
                "BHD",
                "CAD",
                "CHF",
                "CLP",
                "JPY",
                "KWD",
              ].map((code) => (
                <option key={code}>{code}</option>
              ))}
            </select>
            {!!space && (
              <small>
                A moeda é definida na criação; os valores existentes não serão
                convertidos.
              </small>
            )}
          </label>
          <p className="muted">
            O grupo organiza dados da mesma instalação. Ele não cria usuários,
            permissões nem altera a titularidade das contas.
          </p>
          {!!message && (
            <p
              className="notice"
              role="alert"
            >
              {message}
            </p>
          )}
        </fieldset>
      </form>
    </BackofficeDialog>
  );
}
export function DeleteOrganizationItem({
  api,
  snapshot,
  item,
  kind,
  spaceId,
  close,
  deleted,
}: {
  api: ReturnType<typeof createAccountApi>;
  snapshot: PortalResponse;
  item: { id: string; name: string };
  kind: "rule" | "space";
  spaceId: string;
  close: () => void;
  deleted: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const request = useRef<AbortController | null>(null);
  const [key] = useState(() => crypto.randomUUID());
  useEffect(() => () => request.current?.abort(), []);
  const remove = useCallback(async () => {
    if (request.current) {
      return;
    }
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    const command = {
      confirmed: true,
      id: item.id,
      idempotency_key: key,
      spaceId,
      tool: kind === "rule" ? "delete_rule" : "delete_space",
    } as const;
    const { data: _data, error } = await tryCatch(() =>
      api.planning(command, snapshot.csrf, controller.signal),
    );
    if (controller.signal.aborted) {
      return;
    }
    request.current = null;
    setBusy(false);
    if (error) {
      setMessage(
        kind === "space"
          ? "Não foi possível excluir. Grupos com contas, regras, categorias personalizadas ou outros vínculos precisam ser esvaziados antes. Atualize a lista e confira os vínculos."
          : "Não foi possível excluir. Atualize a lista antes de tentar novamente.",
      );
      return;
    }
    deleted();
  }, [api, deleted, item.id, key, kind, snapshot.csrf, spaceId]);
  const protectedSpace = kind === "space" && item.id === "personal";
  let explanation =
    "Somente grupos vazios podem ser excluídos. Contas, transações e outros vínculos nunca serão apagados por esta ação.";
  if (protectedSpace) {
    explanation =
      "O grupo Pessoal é a base da instalação e não pode ser excluído.";
  }
  if (kind === "rule") {
    explanation =
      "A regra deixará de classificar novas importações. Categorias já aplicadas ao histórico serão preservadas.";
  }
  return (
    <BackofficeDialog
      busy={busy}
      close={close}
      dirty={false}
      footer={
        !protectedSpace && (
          <UiButton
            disabled={busy}
            onClick={remove}
            tone="danger"
            type="button"
          >
            {busy ? "Excluindo…" : "Confirmar exclusão"}
          </UiButton>
        )
      }
      title={`Excluir ${kind === "rule" ? "regra" : "grupo"}`}
    >
      <p>
        Excluir <strong>{item.name}</strong>?
      </p>
      <p>{explanation}</p>
      {!!message && (
        <p
          className="notice"
          data-tone="error"
          role="alert"
        >
          {message}
        </p>
      )}
    </BackofficeDialog>
  );
}
