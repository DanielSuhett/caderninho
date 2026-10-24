import { Banner, Select } from "@cloudflare/kumo";
import {
  type ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { z } from "zod/v4";

import {
  type RuleImportPackage,
  type RuleImportResult,
  RuleImportResultSchema,
  type WorkspaceCatalog,
} from "../../contracts";
import { HttpRequestError, tryCatch } from "../../shared";
import { UiButton } from "../ui";
import type { OrganizationApi } from "./account-api";
import { BackofficeDialog } from "./backoffice-dialog";
import { RuleComposition } from "./rule-composition";
import { readRuleImportFile } from "./rule-import-file";

const categoryKinds = {
  expense: "Despesa",
  income: "Renda",
  transfer: "Transferência",
};
const statuses = {
  blocked: "Categoria precisa ser resolvida",
  create: "Nova",
  existing: "Já existe; será preservada",
};
export function RuleImporter({
  api,
  catalog,
  accounts,
  people,
  csrf,
  spaceId,
  close,
  saved,
}: {
  api: OrganizationApi;
  catalog: WorkspaceCatalog;
  accounts: { id: string; name: string; personName: string }[];
  people: { id: string; name: string }[];
  csrf: string;
  spaceId: string;
  close: () => void;
  saved: () => void;
}) {
  const [pack, setPack] = useState<RuleImportPackage | null>(null);
  const [fileName, setFileName] = useState("");
  const [mappings, setMappings] = useState(() => new Map<string, string>());
  const [preview, setPreview] = useState<{
    key: string;
    data: RuleImportResult;
  } | null>(null);
  const [busy, setBusy] = useState<"read" | "preview" | "save" | null>(null);
  const [message, setMessage] = useState("");
  const inFlight = useRef<AbortController | null>(null);
  const receipt = useRef({ key: "", payload: "" });
  const fileInput = useRef<HTMLInputElement>(null);
  useEffect(() => () => inFlight.current?.abort(), []);
  const categoryIds = useMemo(
    () =>
      Object.fromEntries(
        [...mappings].toSorted(([a], [b]) => a.localeCompare(b)),
      ),
    [mappings],
  );
  const key = JSON.stringify({ categoryIds, pack, spaceId });
  const current = preview?.key === key;
  const blocked = preview?.data.categories.some(
    (c) => c.status === "ambiguous" || c.status === "invalid",
  );
  const chooseFile = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.currentTarget.files?.[0];
      if (!file || inFlight.current) {
        return;
      }
      setPack(null);
      setPreview(null);
      setMappings(new Map());
      setMessage("");
      setFileName(file.name);
      const controller = new AbortController();
      inFlight.current = controller;
      setBusy("read");
      const { data, error } = await tryCatch(() => readRuleImportFile(file));
      if (controller.signal.aborted) {
        return;
      }
      inFlight.current = null;
      setBusy(null);
      if (error) {
        setMessage(error.message);
        return;
      }
      setPack(data);
    },
    [],
  );
  const back = useCallback(() => {
    inFlight.current?.abort();
    inFlight.current = null;
    setBusy(null);
    setPack(null);
    setPreview(null);
    setMappings(new Map());
    setMessage("");
    setFileName("");
    if (fileInput.current) {
      fileInput.current.value = "";
      fileInput.current.focus();
    }
  }, []);
  const previewImport = useCallback(async () => {
    if (!pack || inFlight.current) {
      return;
    }
    const controller = new AbortController();
    inFlight.current = controller;
    setMessage("");
    setBusy("preview");
    const { data, error } = await tryCatch(
      async () =>
        z
          .object({ data: RuleImportResultSchema })
          .parse(
            await api.query(
              { categoryIds, pack, spaceId, tool: "preview_rule_import" },
              csrf,
              controller.signal,
              true,
            ),
          ).data,
    );
    if (controller.signal.aborted) {
      return;
    }
    inFlight.current = null;
    setBusy(null);
    if (error) {
      setMessage(
        "Não foi possível conferir. Verifique se as contas e pessoas referidas existem neste grupo e tente novamente.",
      );
      return;
    }
    setPreview({ data, key });
  }, [api, categoryIds, csrf, key, pack, spaceId]);
  const confirmImport = useCallback(async () => {
    if (
      !(pack && preview && current) ||
      blocked ||
      !preview.data.rulesCreated ||
      inFlight.current
    ) {
      return;
    }
    const controller = new AbortController();
    inFlight.current = controller;
    setMessage("");
    const values = {
      categoryIds,
      pack,
      revision: preview.data.revision,
      spaceId,
    };
    const payload = JSON.stringify(values);
    if (receipt.current.payload !== payload) {
      receipt.current = { key: crypto.randomUUID(), payload };
    }
    setBusy("save");
    const { data: _data, error } = await tryCatch(() =>
      api.planning(
        {
          ...values,
          confirmed: true,
          idempotency_key: receipt.current.key,
          tool: "import_rules",
        },
        csrf,
        controller.signal,
      ),
    );
    if (controller.signal.aborted) {
      return;
    }
    inFlight.current = null;
    setBusy(null);
    if (error) {
      if (error instanceof HttpRequestError && error.failure.status === 409) {
        setPreview((previous) => previous && { ...previous, key: "" });
        setMessage(
          "Os dados mudaram. Atualize a prévia antes de confirmar novamente.",
        );
      } else {
        setMessage(
          "Não foi possível confirmar o resultado. Tente confirmar novamente com o mesmo arquivo: a operação não será duplicada.",
        );
      }
      return;
    }
    saved();
  }, [api, blocked, categoryIds, csrf, current, pack, preview, saved, spaceId]);
  const onCategory = useCallback(
    (categoryKey: string, value: string | null) => {
      setMappings((previous) => {
        const next = new Map(previous);
        if (value) {
          next.set(categoryKey, value);
        } else {
          next.delete(categoryKey);
        }
        return next;
      });
    },
    [],
  );
  const label = importActionLabel({
    blocked,
    busy,
    current,
    hasPreview: !!preview,
  });
  return (
    <BackofficeDialog
      busy={busy === "save"}
      close={close}
      dirty={!!pack}
      open
      primaryAction={{
        children: label,
        disabled:
          !!busy ||
          !pack ||
          (current && !blocked && !preview?.data.rulesCreated),
        onClick: current && !blocked ? confirmImport : previewImport,
      }}
      title="Importar regras"
    >
      <div className="backoffice-form rule-import-review">
        <p>
          Grupo:{" "}
          <strong>
            {catalog.spaces.find((s) => s.id === spaceId)?.name ?? spaceId}
          </strong>
        </p>
        <p>
          JSON com até 100 regras, 50 categorias e 64 KiB. A importação não
          reclassifica o histórico.
        </p>
        <label className="rule-import-file">
          Arquivo JSON de regras
          <input
            accept=".json,application/json"
            aria-label="Arquivo JSON de regras"
            disabled={!!busy}
            onChange={chooseFile}
            ref={fileInput}
            type="file"
          />
        </label>
        <a
          download
          href="/rule-packs/brasil.json"
        >
          Baixar JSON Brasil de exemplo
        </a>
        {!!message && (
          <Banner
            description={message}
            title="Confira a importação"
            variant="error"
          />
        )}
        {!!pack && (
          <>
            <p>
              {fileName}: {pack.rules.length} regras e {pack.categories.length}{" "}
              categorias. Pacote {pack.id}, versão {pack.version}.
            </p>
            <UiButton
              disabled={busy === "save"}
              onClick={back}
              type="button"
            >
              Voltar ao arquivo
            </UiButton>
          </>
        )}
        {!!preview && (
          <section
            aria-label="Prévia da importação"
            aria-live="polite"
          >
            <h3>Prévia da importação</h3>
            <p>
              {preview.data.rulesCreated} regras novas;{" "}
              {preview.data.rulesExisting} já existentes;{" "}
              {preview.data.categoriesCreated} categorias novas.
            </p>
            {!(preview.data.rulesCreated || blocked) && (
              <p>Todas as regras já existem. Nenhuma alteração será gravada.</p>
            )}
            {!!blocked && (
              <p role="alert">
                Resolva as categorias indicadas e atualize a prévia.
              </p>
            )}
            <div className="rule-import-review">
              {preview.data.categories.map((category) => (
                <ImportCategory
                  busy={!!busy}
                  catalog={catalog}
                  category={category}
                  key={category.key}
                  onChange={onCategory}
                  value={mappings.get(category.key) ?? ""}
                />
              ))}
            </div>
            <details>
              <summary>
                Regras e categorias ({preview.data.rules.length})
              </summary>
              <ul>
                {preview.data.rules.map((rule) => {
                  const native = pack?.rules.find((r) => r.key === rule.key);
                  return (
                    <li key={rule.key}>
                      <details>
                        <summary>
                          <strong>{rule.name}</strong> → {rule.categoryName} ·
                          prioridade {rule.priority} ·{" "}
                          {rule.enabled ? "Ativa" : "Pausada"} ·{" "}
                          {statuses[rule.status]}
                        </summary>
                        <p className="muted">
                          Condições do arquivo; regras já existentes não serão
                          substituídas.
                        </p>
                        {!!native && (
                          <RuleComposition
                            accounts={accounts}
                            category={rule.categoryName}
                            enabled={native.enabled}
                            people={people}
                            rule={native}
                          />
                        )}
                      </details>
                    </li>
                  );
                })}
              </ul>
            </details>
            <p>
              Regras pessoais vêm primeiro. Regras já existentes, inclusive
              pausadas ou editadas, serão preservadas.
            </p>
            {!current && (
              <p role="status">
                Atualize a prévia para conferir suas escolhas.
              </p>
            )}
          </section>
        )}
      </div>
    </BackofficeDialog>
  );
}

const categoryStatuses = {
  ambiguous: "Nome ambíguo: selecione uma categoria",
  create: "Será criada",
  existing: "Categoria existente",
  invalid: "Selecione uma categoria compatível",
  unused: "Sem novas regras nesta categoria",
};
function ImportCategory({
  category,
  catalog,
  busy,
  onChange,
  value,
}: {
  category: RuleImportResult["categories"][number];
  catalog: WorkspaceCatalog;
  busy: boolean;
  onChange: (key: string, value: string | null) => void;
  value: string;
}) {
  const change = useCallback(
    (next: string | null) => onChange(category.key, next),
    [category.key, onChange],
  );
  return (
    <div>
      <p>
        <strong>{category.name}</strong> · {categoryKinds[category.kind]} ·{" "}
        {categoryStatuses[category.status]}
      </p>
      {category.status !== "unused" && (
        <Select
          disabled={busy}
          items={[
            { label: "Usar correspondência pelo nome", value: "" },
            ...catalog.categories
              .filter((c) => !c.hidden && c.kind === category.kind)
              .map((c) => ({ label: c.name, value: c.id })),
          ]}
          label={`Categoria para ${category.name}`}
          onValueChange={change}
          value={value}
        />
      )}
    </div>
  );
}

function importActionLabel(input: {
  busy: "read" | "preview" | "save" | null;
  current: boolean;
  blocked: boolean | undefined;
  hasPreview: boolean;
}) {
  if (input.busy === "preview") {
    return "Conferindo…";
  }
  if (input.busy === "save") {
    return "Importando…";
  }
  if (input.hasPreview && !input.current) {
    return "Atualizar prévia";
  }
  return input.current && !input.blocked
    ? "Confirmar importação"
    : "Conferir JSON";
}
