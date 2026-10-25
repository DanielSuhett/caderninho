import { Banner, Grid, Input, Select } from "@cloudflare/kumo";
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
import { randomId } from "../random-id";
import type { OrganizationApi } from "./account-api";
import { BackofficeDialog } from "./backoffice-dialog";

type Space = WorkspaceCatalog["spaces"][number];
export function GroupEditor({
  open,
  api,
  snapshot,
  space,
  close,
  saved,
}: {
  open: boolean;
  api: OrganizationApi;
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
        receipt.current = { key: randomId(), payload };
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
  const onType = useCallback((value: string | null) => {
    setDirty(true);
    setType(value ?? "personal");
  }, []);
  const onCurrency = useCallback((value: string | null) => {
    setDirty(true);
    setCurrency(value ?? "BRL");
  }, []);
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
      open={open}
      presentation="compact-editor"
      primaryAction={{ children: submitLabel, form: id, type: "submit" }}
      title={space ? "Editar grupo" : "Novo grupo"}
    >
      <form
        className="backoffice-form"
        id={id}
        onChange={markDirty}
        onSubmit={submit}
      >
        <fieldset disabled={busy}>
          <legend className="sr-only">Organização financeira</legend>
          <Input
            label="Nome do grupo"
            maxLength={240}
            onChange={onName}
            placeholder="Ex.: Casa em comum"
            required
            value={name}
          />
          <Grid
            gap="sm"
            variant="2up"
          >
            <Select
              className="w-full"
              items={[
                { label: "Pessoal", value: "personal" },
                { label: "Família", value: "family" },
                { label: "Profissional", value: "business" },
              ]}
              label="Tipo"
              onValueChange={onType}
              value={type}
            />
            <Input
              label="Início do mês"
              max={28}
              min={1}
              onChange={onDay}
              required
              type="number"
              value={day}
            />
          </Grid>
          <Select
            className="w-full"
            description={
              !!space && (
                <small>
                  A moeda é definida na criação; os valores existentes não serão
                  convertidos.
                </small>
              )
            }
            disabled={!!space}
            items={[
              ...[
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
              ].map((code) => ({ label: code, value: code })),
            ]}
            label="Moeda"
            onValueChange={onCurrency}
            value={currency}
          />
          <p className="muted">
            Grupos organizam dados; não alteram titulares nem permissões.
          </p>
          {!!message && (
            <Banner
              className="feedback"
              description={message}
              role="alert"
              variant="default"
            />
          )}
        </fieldset>
      </form>
    </BackofficeDialog>
  );
}
export function DeleteOrganizationItem({
  open,
  api,
  snapshot,
  item,
  kind,
  spaceId,
  close,
  deleted,
}: {
  open: boolean;
  api: OrganizationApi;
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
  const [key] = useState(() => randomId());
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
  const itemLabel = kind === "rule" ? "regra" : "grupo";
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
      open={open}
      presentation="confirmation"
      primaryAction={{
        children: busy ? "Excluindo…" : `Excluir ${itemLabel}`,
        disabled: protectedSpace,
        onClick: remove,
        type: "button",
        variant: "destructive",
      }}
      title={`Excluir ${itemLabel}`}
    >
      <p>
        Excluir <strong>{item.name}</strong>?
      </p>
      <p>{explanation}</p>
      {!!message && (
        <Banner
          className="feedback"
          description={message}
          role="alert"
          variant="error"
        />
      )}
    </BackofficeDialog>
  );
}
