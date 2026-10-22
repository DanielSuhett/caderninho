import { PlusIcon, TrashIcon } from "@phosphor-icons/react";
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
import { tryCatch } from "../../shared";
import { UiButton } from "../ui";
import type { createAccountApi } from "./account-api";
import { BackofficeDialog } from "./backoffice-dialog";
import {
  conditionDraft,
  conditionFields,
  type DraftCondition,
  initialAlternatives,
  parseRuleDraft,
  rulePresets,
} from "./rule-draft";
import { RulePreview } from "./rule-preview";

type Rule = WorkspaceCatalog["rules"][number];
type FieldEvent = ChangeEvent<HTMLInputElement | HTMLSelectElement>;
function initialLegacyText(rule?: Rule) {
  return rule?.filter ? rule.text : "";
}
export function RuleEditor({
  api,
  snapshot,
  catalog,
  accounts,
  spaceId,
  rule,
  close,
  saved,
}: {
  api: ReturnType<typeof createAccountApi>;
  snapshot: PortalResponse;
  catalog: WorkspaceCatalog;
  accounts: { id: string; name: string; personName: string }[];
  spaceId: string;
  rule?: Rule;
  close: () => void;
  saved: () => void;
}) {
  const [fields, setFields] = useState({
    category:
      rule?.categoryId ??
      catalog.categories.find((c) => c.kind === "expense")?.id ??
      "",
    currency: rule?.filter?.currency ?? "",
    legacyAccount: rule?.accountId ?? "",
    legacyDirection: rule?.direction ?? "",
    legacyText: initialLegacyText(rule),
    name: rule?.name ?? "",
    priority: String(rule?.priority ?? 100),
  });
  const [enabled, setEnabled] = useState(rule?.enabled ?? true);
  const [alternatives, setAlternatives] = useState(() =>
    initialAlternatives(rule),
  );
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [previewStatus, setPreviewStatus] = useState("Complete as condições");
  const inFlight = useRef<AbortController | null>(null);
  const receipt = useRef({ key: "", payload: "" });
  const formId = useId();
  useEffect(() => () => inFlight.current?.abort(), []);
  const draft = parseRuleDraft({
    accountId: fields.legacyAccount || null,
    alternatives,
    csrf: snapshot.csrf,
    currency: fields.currency,
    direction: fields.legacyDirection || null,
    spaceId,
    text: fields.legacyText,
  });
  const onField = useCallback((event: FieldEvent) => {
    const { name, value } = event.currentTarget;
    setDirty(true);
    setFields((previous) => ({ ...previous, [name]: value }));
  }, []);
  const onEnabled = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setDirty(true);
    setEnabled(event.currentTarget.checked);
  }, []);
  const onCondition = useCallback((event: FieldEvent) => {
    const { value, dataset } = event.currentTarget;
    const { alternative, condition, part } = dataset;
    setDirty(true);
    setAlternatives((previous) =>
      previous.map((a) =>
        a.id === alternative
          ? {
              ...a,
              conditions: a.conditions.map((c) => {
                if (c.id !== condition) {
                  return c;
                }
                if (part === "field") {
                  return { ...conditionDraft(value), id: c.id };
                }
                if (part === "operator") {
                  return { ...c, operator: value };
                }
                return { ...c, value };
              }),
            }
          : a,
      ),
    );
  }, []);
  const onPreset = useCallback((event: MouseEvent<HTMLButtonElement>) => {
    const preset = rulePresets.find(
      (p) => p.name === event.currentTarget.dataset.preset,
    );
    if (!preset) {
      return;
    }
    setDirty(true);
    setFields((previous) => ({
      ...previous,
      currency: "BRL",
      legacyAccount: "",
      legacyDirection: "",
      legacyText: "",
    }));
    setAlternatives(
      preset.terms.map((term) => ({
        conditions: [
          {
            field: "description",
            id: crypto.randomUUID(),
            operator: "contains",
            value: term,
          },
          { ...preset.direction, id: crypto.randomUUID() },
        ],
        id: crypto.randomUUID(),
      })),
    );
  }, []);
  const addAlternative = useCallback(() => {
    setDirty(true);
    setAlternatives((previous) => [
      ...previous,
      { conditions: [conditionDraft()], id: crypto.randomUUID() },
    ]);
  }, []);
  const removeAlternative = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      const id = event.currentTarget.dataset.alternative;
      setDirty(true);
      setAlternatives((previous) => previous.filter((a) => a.id !== id));
    },
    [],
  );
  const addCondition = useCallback((event: MouseEvent<HTMLButtonElement>) => {
    const id = event.currentTarget.dataset.alternative;
    setDirty(true);
    setAlternatives((previous) =>
      previous.map((a) =>
        a.id === id
          ? { ...a, conditions: [...a.conditions, conditionDraft()] }
          : a,
      ),
    );
  }, []);
  const removeCondition = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      const { alternative, condition } = event.currentTarget.dataset;
      setDirty(true);
      setAlternatives((previous) =>
        previous.map((a) =>
          a.id === alternative
            ? {
                ...a,
                conditions: a.conditions.filter((c) => c.id !== condition),
              }
            : a,
        ),
      );
    },
    [],
  );
  const submit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (inFlight.current) {
        return;
      }
      const parsedDraft = parseRuleDraft({
        accountId: fields.legacyAccount || null,
        alternatives,
        csrf: snapshot.csrf,
        currency: fields.currency,
        direction: fields.legacyDirection || null,
        spaceId,
        text: fields.legacyText,
      });
      if (!parsedDraft.success) {
        setMessage(
          "Complete todas as condições e escolha uma moeda ao comparar valores.",
        );
        return;
      }
      const values = {
        accountId: parsedDraft.data.accountId,
        categoryId: fields.category,
        direction: parsedDraft.data.direction,
        enabled,
        filter: parsedDraft.data.filter,
        name: fields.name,
        priority: Number(fields.priority),
        spaceId,
        text: parsedDraft.data.text,
      };
      const payload = JSON.stringify(values);
      if (receipt.current.payload !== payload) {
        receipt.current = { key: crypto.randomUUID(), payload };
      }
      const parsed = PortalMutationSchema.safeParse({
        command: {
          ...values,
          confirmed: true,
          idempotency_key: receipt.current.key,
          ...(rule
            ? { id: rule.id, tool: "update_rule" }
            : { tool: "create_rule" }),
        },
        csrf: snapshot.csrf,
      });
      if (!parsed.success) {
        setMessage("Confira nome, categoria e prioridade antes de salvar.");
        return;
      }
      const controller = new AbortController();
      inFlight.current = controller;
      setBusy(true);
      setMessage("");
      const { data: _data, error } = await tryCatch(() =>
        api.planning(parsed.data.command, snapshot.csrf, controller.signal),
      );
      if (controller.signal.aborted) {
        return;
      }
      inFlight.current = null;
      setBusy(false);
      if (error) {
        setMessage(
          "Não foi possível salvar. O rascunho foi mantido; confira o grupo e tente novamente.",
        );
        return;
      }
      saved();
    },
    [alternatives, api, enabled, fields, rule, saved, snapshot.csrf, spaceId],
  );
  let submitLabel = rule ? "Salvar alterações" : "Criar regra";
  if (busy) {
    submitLabel = "Salvando…";
  }
  return (
    <BackofficeDialog
      busy={busy}
      close={close}
      dirty={dirty}
      footer={
        <div className="editor-submit">
          <small>
            <strong className="preview-count">{previewStatus}</strong>Salvar não
            reclassifica o histórico.
          </small>
          <UiButton
            disabled={busy || !draft.success}
            form={formId}
            type="submit"
          >
            {submitLabel}
          </UiButton>
        </div>
      }
      title={rule ? "Editar regra" : "Nova regra"}
    >
      <form
        className="backoffice-form"
        id={formId}
        onSubmit={submit}
      >
        <p className="muted">
          Grupo: {catalog.spaces.find((s) => s.id === spaceId)?.name}
        </p>
        <fieldset disabled={busy}>
          <legend>Identificação e classificação</legend>
          <label>
            Nome da regra
            <input
              maxLength={240}
              name="name"
              onChange={onField}
              required
              value={fields.name}
            />
          </label>
          <div className="editor-grid">
            <label>
              Categoria
              <select
                name="category"
                onChange={onField}
                value={fields.category}
              >
                {catalog.categories.map((c) => (
                  <option
                    key={c.id}
                    value={c.id}
                  >
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Prioridade
              <input
                max={1000}
                min={0}
                name="priority"
                onChange={onField}
                required
                type="number"
                value={fields.priority}
              />
              <small>Menor número vence.</small>
            </label>
          </div>
          <label className="check-field">
            <input
              checked={enabled}
              onChange={onEnabled}
              type="checkbox"
            />
            Regra ativa nas próximas importações
          </label>
        </fieldset>
        <fieldset disabled={busy}>
          <legend>Condições</legend>
          <div className="preset-actions">
            {rulePresets.map((preset) => (
              <UiButton
                data-preset={preset.name}
                key={preset.name}
                onClick={onPreset}
                type="button"
                variant="secondary"
              >
                {preset.name}
              </UiButton>
            ))}
          </div>
          <p className="muted">
            Presets substituem as condições e usam BRL. Nome e categoria são
            preservados.
          </p>
          <label>
            Moeda das condições
            <select
              name="currency"
              onChange={onField}
              value={fields.currency}
            >
              <option value="">Todas as moedas</option>
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
              ].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
            <small>
              Obrigatória ao comparar valores. Valor absoluto não distingue
              entrada de saída.
            </small>
          </label>
          {!!(
            rule?.accountId ||
            rule?.direction ||
            (rule?.filter && rule.text)
          ) && (
            <div className="editor-grid">
              <label>
                Conta obrigatória
                <select
                  name="legacyAccount"
                  onChange={onField}
                  value={fields.legacyAccount}
                >
                  <option value="">Todas</option>
                  {accounts.map((account) => (
                    <option
                      key={account.id}
                      value={account.id}
                    >
                      {account.name} · {account.personName}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Movimento obrigatório
                <select
                  name="legacyDirection"
                  onChange={onField}
                  value={fields.legacyDirection}
                >
                  <option value="">Todos</option>
                  <option value="DEBIT">Saída</option>
                  <option value="CREDIT">Entrada</option>
                </select>
              </label>
              {!!(rule?.filter && rule.text) && (
                <label>
                  Descrição obrigatória
                  <input
                    name="legacyText"
                    onChange={onField}
                    value={fields.legacyText}
                  />
                </label>
              )}
            </div>
          )}
          {alternatives.map((alternative, index) => (
            <div
              className="condition-alternative"
              key={alternative.id}
            >
              {index > 0 && <p className="condition-or">OU</p>}
              <div className="condition-heading">
                <h3>Todas estas condições</h3>
                {alternatives.length > 1 && (
                  <UiButton
                    data-alternative={alternative.id}
                    onClick={removeAlternative}
                    type="button"
                    variant="secondary"
                  >
                    Remover alternativa
                  </UiButton>
                )}
              </div>
              {alternative.conditions.map((condition) => (
                <div
                  className="condition-row"
                  key={condition.id}
                >
                  <label>
                    Campo
                    <select
                      data-alternative={alternative.id}
                      data-condition={condition.id}
                      data-part="field"
                      onChange={onCondition}
                      value={condition.field}
                    >
                      {conditionFields.map((field) => (
                        <option
                          key={field.value}
                          value={field.value}
                        >
                          {field.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Operador
                    <select
                      data-alternative={alternative.id}
                      data-condition={condition.id}
                      data-part="operator"
                      onChange={onCondition}
                      value={condition.operator}
                    >
                      {condition.field === "description" ? (
                        <>
                          <option value="contains">contém</option>
                          <option value="not_contains">não contém</option>
                          <option value="equals">é igual a</option>
                          <option value="starts_with">começa com</option>
                        </>
                      ) : (
                        <>
                          <option value="equals">é igual a</option>
                          {["date", "amount"].includes(condition.field) && (
                            <>
                              <option value="gte">maior ou igual</option>
                              <option value="lte">menor ou igual</option>
                            </>
                          )}
                        </>
                      )}
                    </select>
                  </label>
                  <label htmlFor={`condition-${condition.id}`}>
                    {condition.field === "amount"
                      ? `Valor em ${fields.currency || "moeda a escolher"}`
                      : "Valor"}
                    <ConditionValue
                      accounts={accounts}
                      alternative={alternative.id}
                      change={onCondition}
                      condition={condition}
                      snapshot={snapshot}
                    />
                  </label>
                  <UiButton
                    aria-label="Remover condição"
                    className="icon-button"
                    data-alternative={alternative.id}
                    data-condition={condition.id}
                    disabled={alternative.conditions.length === 1}
                    onClick={removeCondition}
                    type="button"
                    variant="secondary"
                  >
                    <TrashIcon size={18} />
                  </UiButton>
                </div>
              ))}
              <UiButton
                data-alternative={alternative.id}
                disabled={alternative.conditions.length >= 8}
                onClick={addCondition}
                type="button"
                variant="secondary"
              >
                <PlusIcon size={18} />
                Adicionar condição
              </UiButton>
            </div>
          ))}
          <UiButton
            disabled={alternatives.length >= 4}
            onClick={addAlternative}
            type="button"
            variant="secondary"
          >
            <PlusIcon size={18} />
            Adicionar alternativa
          </UiButton>
        </fieldset>
        {!!message && (
          <p
            className="notice"
            data-tone="error"
            role="alert"
          >
            {message}
          </p>
        )}
      </form>
      <DraftFeedback
        dirty={dirty}
        draft={draft}
      />
      <RulePreview
        accounts={accounts}
        api={api}
        input={draft.success ? draft.data : null}
        onStatus={setPreviewStatus}
      />
    </BackofficeDialog>
  );
}
function ConditionValue({
  alternative,
  condition,
  accounts,
  snapshot,
  change,
}: {
  alternative: string;
  condition: DraftCondition;
  accounts: { id: string; name: string; personName: string }[];
  snapshot: PortalResponse;
  change: (event: FieldEvent) => void;
}) {
  const options: Record<string, { id: string; name: string }[]> = {
    accountId: accounts.map((account) => ({
      id: account.id,
      name: `${account.name} · ${account.personName}`,
    })),
    direction: [
      { id: "DEBIT", name: "Saída" },
      { id: "CREDIT", name: "Entrada" },
    ],
    personId: snapshot.people,
    status: [
      { id: "POSTED", name: "Confirmada" },
      { id: "PENDING", name: "Pendente" },
    ],
  };
  const choices = options[condition.field];
  if (choices) {
    return (
      <select
        data-alternative={alternative}
        data-condition={condition.id}
        data-part="value"
        id={`condition-${condition.id}`}
        onChange={change}
        required
        value={condition.value}
      >
        <option value="">Selecione</option>
        {choices.map((choice) => (
          <option
            key={choice.id}
            value={choice.id}
          >
            {choice.name}
          </option>
        ))}
      </select>
    );
  }
  return (
    <input
      data-alternative={alternative}
      data-condition={condition.id}
      data-part="value"
      id={`condition-${condition.id}`}
      inputMode={condition.field === "amount" ? "decimal" : "text"}
      maxLength={160}
      onChange={change}
      placeholder={
        condition.field === "amount" ? "Ex.: 150,00" : "Texto literal"
      }
      required
      type={condition.field === "date" ? "date" : "text"}
      value={condition.value}
    />
  );
}

function DraftFeedback({
  draft,
  dirty,
}: {
  draft: ReturnType<typeof parseRuleDraft>;
  dirty: boolean;
}) {
  if (draft.success || !dirty) {
    return null;
  }
  const message = draft.error.issues.some((issue) =>
    issue.message.includes("moeda"),
  )
    ? "Escolha uma moeda para comparar valores."
    : "Complete todas as condições com valores válidos para consultar e salvar.";
  return (
    <p
      className="notice"
      data-tone="warning"
      role="status"
    >
      {message}
    </p>
  );
}
