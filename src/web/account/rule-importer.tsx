import { Banner } from "@cloudflare/kumo/components/banner";
import { Link } from "@cloudflare/kumo/components/link";
import { UploadSimpleIcon } from "@phosphor-icons/react";
import { type ChangeEvent, useCallback, useRef, useState } from "react";

import type { RuleJob, WorkspaceCatalog } from "../../contracts";
import { HttpRequestError, tryCatch } from "../../shared";
import { UiButton } from "../ui";
import type { OrganizationApi } from "./account-api";
import { BackofficeDialog } from "./backoffice-dialog";
import { type RuleJobFile, readRuleJobFile } from "./rule-import-file";

const count = new Intl.NumberFormat("pt-BR");

// Uploads the file in idempotent chunks and hands the job to the Worker. A retry
// after a network failure reuses the same job; repeated chunks are ignored.
async function upload(input: {
  api: OrganizationApi;
  csrf: string;
  file: RuleJobFile;
  job: RuleJob | null;
  progress: (sent: number) => void;
  remember: (job: RuleJob) => void;
  spaceId: string;
  signal: AbortSignal;
}) {
  const { api, csrf, file, signal } = input;
  const job =
    input.job ??
    (await api.ruleJobs(
      {
        action: "create_import",
        chunks: file.chunks.length,
        csrf,
        pack: {
          categories: file.categories,
          id: file.id,
          version: file.version,
        },
        received: file.rules,
        spaceId: input.spaceId,
      },
      signal,
    ));
  input.remember(job);
  async function send(seq: number): Promise<void> {
    const rules = file.chunks[seq];
    if (!rules) {
      return;
    }
    await api.ruleJobs(
      { action: "append", csrf, id: job.id, rules, seq },
      signal,
    );
    input.progress(seq + 1);
    return send(seq + 1);
  }
  await send(0);
  return api.ruleJobs({ action: "start", csrf, id: job.id }, signal);
}

export function RuleImporter({
  api,
  catalog,
  csrf,
  spaceId,
  close,
  started,
  open,
}: {
  api: OrganizationApi;
  catalog: WorkspaceCatalog;
  csrf: string;
  spaceId: string;
  close: () => void;
  started: (job: RuleJob) => void;
  open: boolean;
}) {
  const [file, setFile] = useState<RuleJobFile | null>(null);
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState<"read" | "upload" | null>(null);
  const [sent, setSent] = useState(0);
  const [message, setMessage] = useState("");
  const job = useRef<RuleJob | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const openFile = useCallback(() => fileInput.current?.click(), []);
  const chooseFile = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const selected = event.currentTarget.files?.[0];
      if (!selected) {
        return;
      }
      job.current = null;
      setFile(null);
      setSent(0);
      setMessage("");
      setFileName(selected.name);
      setBusy("read");
      const { data, error } = await tryCatch(() => readRuleJobFile(selected));
      setBusy(null);
      if (error) {
        setMessage(error.message);
        return;
      }
      setFile(data);
    },
    [],
  );
  const submit = useCallback(async () => {
    if (!file || busy) {
      return;
    }
    setMessage("");
    setBusy("upload");
    const { data, error } = await tryCatch(() =>
      upload({
        api,
        csrf,
        file,
        job: job.current,
        progress: setSent,
        remember: (created) => {
          job.current = created;
        },
        signal: new AbortController().signal,
        spaceId,
      }),
    );
    setBusy(null);
    if (error) {
      setMessage(
        error instanceof HttpRequestError && error.failure.status === 409
          ? "Já existe uma atualização de regras em andamento. Aguarde ela terminar."
          : "O envio foi interrompido. Tente novamente: as partes já enviadas não serão repetidas.",
      );
      return;
    }
    started(data);
    close();
  }, [api, busy, close, csrf, file, spaceId, started]);
  const space = catalog.spaces.find((s) => s.id === spaceId)?.name ?? spaceId;
  return (
    <BackofficeDialog
      busy={busy === "upload"}
      close={close}
      dirty={!!file}
      open={open}
      primaryAction={{
        children:
          busy === "upload"
            ? `Enviando ${count.format(sent)} de ${count.format(file?.chunks.length ?? 0)}…`
            : "Importar",
        disabled: !!busy || !file,
        onClick: submit,
      }}
      title="Importar regras"
    >
      <div className="backoffice-form rule-import-review">
        <p>
          As regras entram em {space} e o histórico é recategorizado em segundo
          plano. Regras inválidas são ignoradas e listadas; categorias ajustadas
          manualmente são preservadas.
        </p>
        <div className="rule-import-file">
          <input
            accept=".json,application/json"
            aria-label="Arquivo JSON de regras"
            disabled={!!busy}
            hidden
            onChange={chooseFile}
            ref={fileInput}
            type="file"
          />
          <UiButton
            disabled={!!busy}
            onClick={openFile}
            type="button"
            variant="outline"
          >
            <UploadSimpleIcon size={18} />
            Escolher arquivo JSON
          </UiButton>
        </div>
        <Link
          download
          href="/rule-packs/brasil.json"
        >
          Baixar JSON Brasil de exemplo
        </Link>
        {!!message && (
          <Banner
            description={message}
            title="Confira a importação"
            variant="error"
          />
        )}
        {busy === "read" && <p role="status">Lendo {fileName}…</p>}
        {!!file && (
          <p role="status">
            {fileName}: {count.format(file.rules)}{" "}
            {file.rules === 1 ? "regra" : "regras"}.
          </p>
        )}
      </div>
    </BackofficeDialog>
  );
}
