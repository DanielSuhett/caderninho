import { Banner } from "@cloudflare/kumo/components/banner";
import { Input } from "@cloudflare/kumo/components/input";
import {
  type ChangeEvent,
  type ComponentProps,
  type FormEvent,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

import {
  type PortalCards,
  PortalMutationSchema,
  type PortalResponse,
} from "../../contracts";
import { minor } from "../../domain";
import { tryCatch } from "../../shared";
import { formatBalance } from "../money";
import { randomId } from "../random-id";
import { UiButton } from "../ui";
import type { OrganizationApi } from "./account-api";
import { BackofficeDialog } from "./backoffice-dialog";
import { CardsDashboard } from "./cards-dashboard";

const decimalLimit = /^\d+(?:[.,]\d+)?$/;

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
  const [value, setValue] = useState(() =>
    account.creditLimitMinor === null
      ? ""
      : formatBalance(account.creditLimitMinor, account.currency)
          .replace(` ${account.currency}`, "")
          .replaceAll(".", ""),
  );
  const [restore, setRestore] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const formId = useId();
  const request = useRef<AbortController | null>(null);
  const receipt = useRef({ key: "", payload: "" });
  const changeValue = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setValue(event.currentTarget.value);
    setDirty(true);
  }, []);
  const toggleRestore = useCallback(() => {
    setRestore((previous) => !previous);
    setDirty(true);
  }, []);
  useEffect(() => () => request.current?.abort(), []);
  const submit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (request.current) {
        return;
      }
      if (!(restore || decimalLimit.test(value))) {
        setMessage(
          "Informe um limite positivo ou zero, sem separador de milhar.",
        );
        return;
      }
      const { data: amount, error: amountError } = await tryCatch(() =>
        Promise.resolve(
          restore ? null : minor(value.replace(",", "."), account.currency),
        ),
      );
      if (amountError) {
        setMessage("Confira as casas decimais do limite e a moeda do cartão.");
        return;
      }
      const fields = {
        creditLimitMinor: amount,
        expected_revision: revision,
        id: account.id,
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
          tool: "update_account_settings",
        },
        csrf: snapshot.csrf,
      });
      if (!parsed.success) {
        setMessage("O limite excede o tamanho permitido. Confira o valor.");
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
          "Não foi possível confirmar o limite. Atualize Cartões antes de repetir; uma resposta perdida pode ter sido salva.",
        );
        return;
      }
      setDirty(false);
      saved();
    },
    [account, api, restore, revision, saved, snapshot.csrf, spaceId, value],
  );
  return (
    <BackofficeDialog
      busy={busy}
      close={close}
      dirty={dirty}
      open={open}
      presentation="compact-editor"
      primaryAction={{
        children: busy ? "Salvando…" : "Salvar limite",
        disabled: !dirty,
        form: formId,
        type: "submit",
      }}
      title={`Limite de ${account.name}`}
    >
      <p>Altera apenas o limite no Caderninho.</p>
      <form
        className="card-limit-form"
        id={formId}
        onSubmit={submit}
      >
        <Input
          disabled={busy || restore}
          inputMode="decimal"
          label={`Limite total (${account.currency})`}
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
        {!!restore && <p>Ao salvar, o limite volta a acompanhar o banco.</p>}
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

export function CardsWithLimitEditor({
  api,
  snapshot,
  spaceId,
  revision,
  saved,
  ...props
}: Omit<ComponentProps<typeof CardsDashboard>, "onEditLimit"> & {
  api: Pick<OrganizationApi, "planning">;
  snapshot: PortalResponse;
  spaceId: string;
  revision: number | undefined;
  saved: () => void;
}) {
  const [editing, setEditing] = useState<{
    account: PortalCards["accounts"][number];
    revision: number;
  } | null>(null);
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState(0);
  const close = useCallback(() => setOpen(false), []);
  const onSaved = useCallback(() => {
    setOpen(false);
    saved();
  }, [saved]);
  const edit = useCallback(
    (account: PortalCards["accounts"][number]) => {
      if (revision === undefined) {
        return;
      }
      setEditing({ account, revision });
      setSession((value) => value + 1);
      setOpen(true);
    },
    [revision],
  );
  const selectedAccount = editing?.account ?? props.data.accounts.at(0);
  return (
    <>
      <CardsDashboard
        {...props}
        onEditLimit={revision === undefined ? undefined : edit}
      />
      {!!selectedAccount && revision !== undefined && (
        <CardLimitEditor
          account={selectedAccount}
          api={api}
          close={close}
          key={session}
          open={open}
          revision={editing?.revision ?? revision}
          saved={onSaved}
          snapshot={snapshot}
          spaceId={spaceId}
        />
      )}
    </>
  );
}
