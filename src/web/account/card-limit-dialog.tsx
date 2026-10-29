// Loaded on the first edit: the form validates input with Zod.
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
  type PortalCards,
  type PortalMutation,
  PortalMutationSchema,
  type PortalResponse,
} from "../../contracts";
import { minor } from "../../domain";
import { tryCatch } from "../../shared";
import { formatAmount } from "../money";
import { randomId } from "../random-id";
import { UiButton } from "../ui";
import type { OrganizationApi } from "./account-api";
import { BackofficeDialog } from "./backoffice-dialog";
import { cardDigitsLabel } from "./card-presentation";

const decimalLimit = /^\d+(?:[.,]\d+)?$/;

interface CardDraft {
  hidden: boolean;
  limit: string;
  name: string;
  personId: string;
}
type PlannedCommand = Record<string, unknown>;

function limitText(value: string | null, currency: string) {
  if (value === null) {
    return "";
  }
  return formatAmount(value, currency).replaceAll(".", "");
}

function cardDraft(card: PortalCard, currency: string): CardDraft {
  return {
    hidden: card.hidden,
    limit: limitText(card.creditLimitMinor, currency),
    name: card.identified ? card.name : "",
    personId: card.personInherited ? "" : card.personId,
  };
}

function parseLimit(
  value: string,
  currency: string,
): { amount: string | null } | { error: true } {
  const trimmed = value.trim();
  if (!trimmed) {
    return { amount: null };
  }
  if (!decimalLimit.test(trimmed)) {
    return { error: true };
  }
  try {
    return { amount: minor(trimmed.replace(",", "."), currency) };
  } catch {
    return { error: true };
  }
}

// Only changed cards become commands.
function cardCommand(
  card: PortalCard,
  draft: CardDraft | undefined,
  currency: string,
): { command: PlannedCommand } | { error: string } | null {
  if (
    !draft ||
    JSON.stringify(draft) === JSON.stringify(cardDraft(card, currency))
  ) {
    return null;
  }
  const name = draft.name.trim();
  if (!name && card.identified) {
    return { error: `Informe um nome para ${cardDigitsLabel(card)}.` };
  }
  const limit = parseLimit(draft.limit, currency);
  if ("error" in limit) {
    return {
      error: `Confira o sublimite de ${cardDigitsLabel(card)}: positivo ou zero, sem separador de milhar.`,
    };
  }
  return {
    command: {
      ...(!card.primary && { creditLimitMinor: limit.amount }),
      hidden: draft.hidden,
      id: card.id,
      personId: draft.personId || null,
      tool: "update_card",
      ...(name && { name }),
    },
  };
}

function CardFields({
  card,
  draft,
  people,
  busy,
  onChange,
}: {
  card: PortalCard;
  draft: CardDraft;
  people: PortalResponse["people"];
  busy: boolean;
  onChange: (id: string, patch: Partial<CardDraft>) => void;
}) {
  const changeName = useCallback(
    (event: ChangeEvent<HTMLInputElement>) =>
      onChange(card.id, { name: event.currentTarget.value }),
    [card.id, onChange],
  );
  const changeLimit = useCallback(
    (event: ChangeEvent<HTMLInputElement>) =>
      onChange(card.id, { limit: event.currentTarget.value }),
    [card.id, onChange],
  );
  const changePerson = useCallback(
    (value: string | null) => onChange(card.id, { personId: value ?? "" }),
    [card.id, onChange],
  );
  const changeHidden = useCallback(
    (checked: boolean) => onChange(card.id, { hidden: checked }),
    [card.id, onChange],
  );
  return (
    <fieldset className="card-edit-fields">
      <legend>{cardDigitsLabel(card)}</legend>
      <Input
        disabled={busy}
        label="Nome"
        maxLength={240}
        onChange={changeName}
        placeholder={card.number ? `Final ${card.number}` : "Cartão"}
        value={draft.name}
      />
      <Select
        disabled={busy}
        items={[
          { label: "Titular da conta", value: "" },
          ...people.map((person) => ({
            label: person.name,
            value: person.id,
          })),
        ]}
        label="Pessoa"
        onValueChange={changePerson}
        value={draft.personId}
      />
      {!card.primary && (
        <Input
          disabled={busy}
          inputMode="decimal"
          label="Sublimite"
          onChange={changeLimit}
          placeholder="Limite da conta"
          value={draft.limit}
        />
      )}
      <Switch
        checked={draft.hidden}
        disabled={busy}
        label="Ocultar"
        onCheckedChange={changeHidden}
      />
    </fieldset>
  );
}

// One editor per account: its limit and every card's name, owner, visibility
// and sublimit. Each change is its own command, sent in order on top of the
// revision the previous one produced.
export function CardLimitEditor({
  account,
  revision,
  open,
  api,
  snapshot,
  spaceId,
  close,
  saved,
}: {
  account: PortalCards["accounts"][number];
  revision: number;
  open: boolean;
  api: Pick<OrganizationApi, "planning">;
  snapshot: PortalResponse;
  spaceId: string;
  close: () => void;
  saved: () => void;
}) {
  const { currency } = account;
  const initialLimit = limitText(account.creditLimitMinor, currency);
  const [value, setValue] = useState(initialLimit);
  const [restore, setRestore] = useState(false);
  const [drafts, setDrafts] = useState(
    () =>
      new Map(
        account.cards.map((card) => [card.id, cardDraft(card, currency)]),
      ),
  );
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const formId = useId();
  const request = useRef<AbortController | null>(null);
  const receipts = useRef(new Map<string, { key: string; payload: string }>());
  const changeValue = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setValue(event.currentTarget.value);
    setDirty(true);
  }, []);
  const toggleRestore = useCallback(() => {
    setRestore((previous) => !previous);
    setDirty(true);
  }, []);
  const changeCard = useCallback((id: string, patch: Partial<CardDraft>) => {
    setDrafts((previous) => {
      const next = new Map(previous);
      const current = next.get(id);
      if (current) {
        next.set(id, { ...current, ...patch });
      }
      return next;
    });
    setDirty(true);
  }, []);
  useEffect(() => () => request.current?.abort(), []);
  const commands = useCallback(():
    | { error: string }
    | { result: PlannedCommand[] } => {
    const result: PlannedCommand[] = [];
    if (restore || value !== initialLimit) {
      const limit = restore ? { amount: null } : parseLimit(value, currency);
      if ("error" in limit || (!restore && limit.amount === null)) {
        return {
          error: "Informe um limite positivo ou zero, sem separador de milhar.",
        };
      }
      result.push({
        creditLimitMinor: limit.amount,
        id: account.id,
        tool: "update_account_settings",
      });
    }
    for (const card of account.cards) {
      const planned = cardCommand(card, drafts.get(card.id), currency);
      if (planned && "error" in planned) {
        return planned;
      }
      if (planned) {
        result.push(planned.command);
      }
    }
    return { result };
  }, [account, currency, drafts, initialLimit, restore, value]);
  const submit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (request.current) {
        return;
      }
      const planned = commands();
      if ("error" in planned) {
        setMessage(planned.error);
        return;
      }
      const parsed: PortalMutation[] = [];
      for (const [index, fields] of planned.result.entries()) {
        const payload = JSON.stringify(fields);
        const id = String(fields.id);
        const previous = receipts.current.get(id);
        const key = previous?.payload === payload ? previous.key : randomId();
        receipts.current.set(id, { key, payload });
        const command = PortalMutationSchema.safeParse({
          command: {
            ...fields,
            confirmed: true,
            expected_revision: revision + index,
            idempotency_key: key,
            spaceId,
          },
          csrf: snapshot.csrf,
        });
        if (!command.success) {
          setMessage("Confira nomes (1 a 240 caracteres) e valores.");
          return;
        }
        parsed.push(command.data.command);
      }
      const controller = new AbortController();
      request.current = controller;
      setBusy(true);
      setMessage("");
      // Commands run in order: each one expects the revision of the previous.
      const { error } = await tryCatch(() =>
        parsed.reduce<Promise<unknown>>(
          (chain, command) =>
            chain.then(() =>
              api.planning(command, snapshot.csrf, controller.signal),
            ),
          Promise.resolve(),
        ),
      );
      if (error) {
        request.current = null;
        setBusy(false);
        setMessage(
          "Não foi possível salvar tudo. Atualize Cartões antes de repetir; parte das alterações pode ter sido salva.",
        );
        return;
      }
      request.current = null;
      setBusy(false);
      setDirty(false);
      saved();
    },
    [api, commands, revision, saved, snapshot.csrf, spaceId],
  );
  return (
    <BackofficeDialog
      busy={busy}
      close={close}
      dirty={dirty}
      open={open}
      presentation="compact-editor"
      primaryAction={{
        children: busy ? "Salvando…" : "Salvar",
        disabled: !dirty,
        form: formId,
        type: "submit",
      }}
      title={account.cardNumber ? `•••• ${account.cardNumber}` : account.name}
    >
      <form
        className="card-limit-form"
        id={formId}
        onSubmit={submit}
      >
        <Input
          disabled={busy || restore}
          inputMode="decimal"
          label={`Limite total (${currency})`}
          onChange={changeValue}
          required={!restore}
          value={value}
        />
        {!!account.creditEstimated && !account.manual && (
          <UiButton
            disabled={busy}
            onClick={toggleRestore}
            type="button"
            variant="outline"
          >
            {restore ? "Definir outro limite" : "Usar limite do banco"}
          </UiButton>
        )}
        {account.cards.map((card) => {
          const draft = drafts.get(card.id);
          return draft ? (
            <CardFields
              busy={busy}
              card={card}
              draft={draft}
              key={card.id}
              onChange={changeCard}
              people={snapshot.people}
            />
          ) : null;
        })}
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
