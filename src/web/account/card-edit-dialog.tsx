// Loaded on the first card edit: the form validates input with Zod.
import { Banner } from "@cloudflare/kumo/components/banner";
import { Input } from "@cloudflare/kumo/components/input";
import { Select } from "@cloudflare/kumo/components/select";
import { Switch } from "@cloudflare/kumo/components/switch";
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
  type PortalCard,
  PortalMutationSchema,
  type PortalResponse,
} from "../../contracts";
import { tryCatch } from "../../shared";
import { randomId } from "../random-id";
import type { OrganizationApi } from "./account-api";
import { BackofficeDialog } from "./backoffice-dialog";
import { cardLabel } from "./card-presentation";

export function CardEditor({
  card,
  revision,
  open,
  api,
  snapshot,
  spaceId,
  close,
  saved,
}: {
  card: PortalCard;
  revision: number;
  open: boolean;
  api: Pick<OrganizationApi, "planning">;
  snapshot: PortalResponse;
  spaceId: string;
  close: () => void;
  saved: () => void;
}) {
  const [name, setName] = useState(card.identified ? card.name : "");
  const [hidden, setHidden] = useState(card.hidden);
  const [personId, setPersonId] = useState(
    card.personInherited ? "" : card.personId,
  );
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const formId = useId();
  const request = useRef<AbortController | null>(null);
  const receipt = useRef({ key: "", payload: "" });
  const changeName = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setName(event.currentTarget.value);
    setDirty(true);
  }, []);
  const changePerson = useCallback((value: string | null) => {
    setPersonId(value ?? "");
    setDirty(true);
  }, []);
  const changeHidden = useCallback((checked: boolean) => {
    setHidden(checked);
    setDirty(true);
  }, []);
  useEffect(() => () => request.current?.abort(), []);
  const submit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (request.current) {
        return;
      }
      const trimmed = name.trim();
      if (!trimmed && card.identified) {
        setMessage("Informe um nome para o cartão.");
        return;
      }
      const fields = {
        expected_revision: revision,
        hidden,
        id: card.id,
        personId: personId || null,
        spaceId,
        ...(trimmed && { name: trimmed }),
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
          tool: "update_card",
        },
        csrf: snapshot.csrf,
      });
      if (!parsed.success) {
        setMessage("O nome deve ter de 1 a 240 caracteres.");
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
          "Não foi possível confirmar a alteração. Atualize Cartões antes de repetir; uma resposta perdida pode ter sido salva.",
        );
        return;
      }
      setDirty(false);
      saved();
    },
    [
      api,
      card.id,
      card.identified,
      hidden,
      name,
      personId,
      revision,
      saved,
      snapshot.csrf,
      spaceId,
    ],
  );
  return (
    <BackofficeDialog
      busy={busy}
      close={close}
      dirty={dirty}
      open={open}
      presentation="compact-editor"
      primaryAction={{
        children: busy ? "Salvando…" : "Salvar cartão",
        disabled: !dirty,
        form: formId,
        type: "submit",
      }}
      title={cardLabel(card)}
    >
      <p>Altera apenas nome, pessoa e exibição no Caderninho.</p>
      <form
        className="card-limit-form"
        id={formId}
        onSubmit={submit}
      >
        <Input
          disabled={busy}
          label="Nome do cartão"
          maxLength={240}
          onChange={changeName}
          placeholder={card.number ? `Final ${card.number}` : "Cartão"}
          value={name}
        />
        <Select
          disabled={busy}
          items={[
            { label: "Titular da conta", value: "" },
            ...snapshot.people.map((person) => ({
              label: person.name,
              value: person.id,
            })),
          ]}
          label="Pessoa do cartão"
          onValueChange={changePerson}
          value={personId}
        />
        <Switch
          checked={hidden}
          disabled={busy}
          label="Ocultar este cartão"
          onCheckedChange={changeHidden}
        />
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
