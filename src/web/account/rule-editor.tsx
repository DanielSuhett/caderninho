import { Banner } from "@cloudflare/kumo/components/banner";
import { Input } from "@cloudflare/kumo/components/input";
import { Select } from "@cloudflare/kumo/components/select";
import { Switch } from "@cloudflare/kumo/components/switch";
import { PlusIcon, TrashIcon } from "@phosphor-icons/react";
import {
  type ChangeEvent,
  type FormEvent,
  type MouseEvent,
  memo,
  useCallback,
  useEffect,
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
import { UiButton } from "../ui";
import type { OrganizationApi } from "./account-api";
import { BackofficeDialog } from "./backoffice-dialog";
import { CategoryLabel } from "./category-appearance";
import { DisclosureItem } from "./disclosure-item";
import { RuleComposition } from "./rule-composition";
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
type FieldEvent = ChangeEvent<HTMLInputElement>;
function initialLegacyText(rule?: Rule) {
  return rule?.filter ? rule.text : "";
}
function initialCategory(rule: Rule | undefined, catalog: WorkspaceCatalog) {
  return (
    rule?.categoryId ??
    catalog.categories.find((c) => !c.hidden && c.kind === "expense")?.id ??
    ""
  );
}
export function RuleEditor({
  open,
  api,
  snapshot,
  catalog,
  accounts,
  spaceId,
  rule,
  close,
  saved,
}: {
  open: boolean;
  api: OrganizationApi;
  snapshot: PortalResponse;
  catalog: WorkspaceCatalog;
  accounts: { id: string; name: string; personName: string }[];
  spaceId: string;
  rule?: Rule;
  close: () => void;
  saved: () => void;
}) {
  const [fields, setFields] = useState({
    category: initialCategory(rule, catalog),
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
  const inFlight = useRef<AbortController | null>(null);
  const receipt = useRef({ key: "", payload: "" });
  const formId = useId();
  useEffect(() => () => inFlight.current?.abort(), []);
  const draft = useMemo(
    () =>
      parseRuleDraft({
        accountId: fields.legacyAccount || null,
        alternatives,
        csrf: snapshot.csrf,
        currency: fields.currency,
        direction: fields.legacyDirection || null,
        spaceId,
        text: fields.legacyText,
      }),
    [
      alternatives,
      fields.currency,
      fields.legacyAccount,
      fields.legacyDirection,
      fields.legacyText,
      snapshot.csrf,
      spaceId,
    ],
  );
  const onField = useCallback((event: FieldEvent) => {
    const { name, value } = event.currentTarget;
    setDirty(true);
    setFields((previous) => ({ ...previous, [name]: value }));
  }, []);
  const selectField = useCallback((name: string, value: string | null) => {
    setDirty(true);
    setFields((previous) => ({ ...previous, [name]: value ?? "" }));
  }, []);
  const onCategory = useCallback(
    (value: string | null) => selectField("category", value),
    [selectField],
  );
  const onCurrency = useCallback(
    (value: string | null) => selectField("currency", value),
    [selectField],
  );
  const onLegacyAccount = useCallback(
    (value: string | null) => selectField("legacyAccount", value),
    [selectField],
  );
  const onLegacyDirection = useCallback(
    (value: string | null) => selectField("legacyDirection", value),
    [selectField],
  );
  const onEnabled = useCallback((checked: boolean) => {
    setDirty(true);
    setEnabled(checked);
  }, []);
  const onCondition = useCallback(
    (alternative: string, condition: string, part: string, value: string) => {
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
    },
    [],
  );
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
            id: randomId(),
            operator: "contains",
            value: term,
          },
          { ...preset.direction, id: randomId() },
        ],
        id: randomId(),
      })),
    );
  }, []);
  const addAlternative = useCallback(() => {
    setDirty(true);
    setAlternatives((previous) => [
      ...previous,
      { conditions: [conditionDraft()], id: randomId() },
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
        receipt.current = { key: randomId(), payload };
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
      actionHint={
        <p className="muted">
          Salvar vale para as próximas importações e não reclassifica o
          histórico.
        </p>
      }
      busy={busy}
      close={close}
      dirty={dirty}
      open={open}
      primaryAction={{
        children: submitLabel,
        disabled: !draft.success,
        form: formId,
        type: "submit",
      }}
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
          <legend className="sr-only">Identificação e classificação</legend>
          <Input
            label="Nome da regra"
            maxLength={240}
            name="name"
            onChange={onField}
            required
            value={fields.name}
          />
          <div className="editor-grid">
            <Select
              className="w-full"
              items={[
                ...catalog.categories
                  .filter((c) => !c.hidden || c.id === fields.category)
                  .map((c) => ({
                    label: <CategoryLabel category={c} />,
                    value: c.id,
                  })),
              ]}
              label="Categoria"
              name="category"
              onValueChange={onCategory}
              value={fields.category}
            />
            <Input
              description={<small>Menor número vence.</small>}
              label="Prioridade"
              max={1000}
              min={0}
              name="priority"
              onChange={onField}
              required
              type="number"
              value={fields.priority}
            />
          </div>
          <div className="check-field">
            <Switch
              checked={enabled}
              label="Regra ativa nas próximas importações"
              onCheckedChange={onEnabled}
            />
          </div>
        </fieldset>
        <fieldset disabled={busy}>
          <legend>Condições: todas por alternativa</legend>
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
          <p className="muted">Presets substituem as condições e usam BRL.</p>
          <Select
            className="w-full"
            description={
              <small>
                Obrigatória ao comparar valores. Valor absoluto não distingue
                entrada de saída.
              </small>
            }
            items={[
              { label: "Todas as moedas", value: "" },
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
              ].map((value) => ({ label: value, value })),
            ]}
            label="Moeda das condições"
            name="currency"
            onValueChange={onCurrency}
            value={fields.currency}
          />
          {!!(
            rule?.accountId ||
            rule?.direction ||
            (rule?.filter && rule.text)
          ) && (
            <div className="editor-grid">
              <Select
                className="w-full"
                items={[
                  { label: "Todas", value: "" },
                  ...accounts.map((account) => ({
                    label: (
                      <>
                        {account.name} · {account.personName}
                      </>
                    ),
                    value: account.id,
                  })),
                ]}
                label="Conta obrigatória"
                name="legacyAccount"
                onValueChange={onLegacyAccount}
                value={fields.legacyAccount}
              />
              <Select
                className="w-full"
                items={[
                  { label: "Todos", value: "" },
                  { label: "Saída", value: "DEBIT" },
                  { label: "Entrada", value: "CREDIT" },
                ]}
                label="Movimento obrigatório"
                name="legacyDirection"
                onValueChange={onLegacyDirection}
                value={fields.legacyDirection}
              />
              {!!(rule?.filter && rule.text) && (
                <Input
                  label="Descrição obrigatória"
                  name="legacyText"
                  onChange={onField}
                  value={fields.legacyText}
                />
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
                <h3>Alternativa {index + 1}</h3>
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
                  <ConditionSelect
                    alternative={alternative.id}
                    change={onCondition}
                    condition={condition.id}
                    items={[
                      ...conditionFields.map((field) => ({
                        label: field.label,
                        value: field.value,
                      })),
                    ]}
                    label="Campo"
                    part="field"
                    value={condition.field}
                  />
                  <ConditionSelect
                    alternative={alternative.id}
                    change={onCondition}
                    condition={condition.id}
                    items={[
                      ...(condition.field === "description"
                        ? [
                            { label: "contém", value: "contains" },
                            { label: "não contém", value: "not_contains" },
                            { label: "é igual a", value: "equals" },
                            { label: "começa com", value: "starts_with" },
                          ]
                        : [
                            { label: "é igual a", value: "equals" },
                            ...(["date", "amount"].includes(condition.field)
                              ? [
                                  { label: "maior ou igual", value: "gte" },
                                  { label: "menor ou igual", value: "lte" },
                                ]
                              : []),
                          ]),
                    ]}
                    label="Operador"
                    part="operator"
                    value={condition.operator}
                  />
                  <ConditionValue
                    accounts={accounts}
                    alternative={alternative.id}
                    change={onCondition}
                    condition={condition}
                    label={
                      condition.field === "amount"
                        ? `Valor em ${fields.currency || "moeda a escolher"}`
                        : "Valor"
                    }
                    snapshot={snapshot}
                  />
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
        <RuleDraftComposition
          accounts={accounts}
          catalog={catalog}
          category={fields.category}
          draft={draft}
          enabled={enabled}
          people={snapshot.people}
        />
        {!!message && (
          <Banner
            className="feedback"
            description={message}
            role="alert"
            variant="error"
          />
        )}
      </form>
      <DraftFeedback
        dirty={dirty}
        draft={draft}
      />
      <RulePreview
        accounts={accounts}
        api={api}
        input={open && draft.success ? draft.data : null}
      />
    </BackofficeDialog>
  );
}
function ConditionSelect({
  alternative,
  condition,
  part,
  change,
  ...props
}: {
  alternative: string;
  condition: string;
  part: string;
  change: (
    alternative: string,
    condition: string,
    part: string,
    value: string,
  ) => void;
  items: { label: string; value: string }[];
  label: string;
  value: string;
}) {
  const select = useCallback(
    (value: string | null) => change(alternative, condition, part, value ?? ""),
    [alternative, condition, part, change],
  );
  return (
    <Select
      className="w-full"
      {...props}
      onValueChange={select}
    />
  );
}

function ConditionValue({
  label,
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
  label: React.ReactNode;
  change: (
    alternative: string,
    condition: string,
    part: string,
    value: string,
  ) => void;
}) {
  const onInput = useCallback(
    (event: FieldEvent) =>
      change(alternative, condition.id, "value", event.currentTarget.value),
    [alternative, condition.id, change],
  );
  const onSelect = useCallback(
    (value: string | null) =>
      change(alternative, condition.id, "value", value ?? ""),
    [alternative, condition.id, change],
  );
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
      <Select
        className="w-full"
        data-alternative={alternative}
        data-condition={condition.id}
        data-part="value"
        id={`condition-${condition.id}`}
        items={[
          { label: "Selecione", value: "" },
          ...choices.map((choice) => ({
            label: choice.name,
            value: choice.id,
          })),
        ]}
        label={label}
        onValueChange={onSelect}
        required
        value={condition.value}
      />
    );
  }
  return (
    <Input
      data-alternative={alternative}
      data-condition={condition.id}
      data-part="value"
      id={`condition-${condition.id}`}
      inputMode={condition.field === "amount" ? "decimal" : "text"}
      label={label}
      maxLength={160}
      onChange={onInput}
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
    <Banner
      className="feedback"
      description={message}
      role="status"
      variant="alert"
    />
  );
}

const RuleDraftComposition = memo(function RuleDraftDiagram({
  accounts,
  category,
  catalog,
  draft,
  enabled,
  people,
}: {
  accounts: { id: string; name: string; personName: string }[];
  category: string;
  catalog: WorkspaceCatalog;
  draft: ReturnType<typeof parseRuleDraft>;
  enabled: boolean;
  people: PortalResponse["people"];
}) {
  return (
    <DisclosureItem summary="Visualizar composição">
      {draft.success ? (
        <RuleComposition
          accounts={accounts}
          category={
            catalog.categories.find((item) => item.id === category)?.name ?? ""
          }
          categoryAppearance={catalog.categories.find(
            (item) => item.id === category,
          )}
          enabled={enabled}
          people={people}
          rule={draft.data}
        />
      ) : (
        <p className="muted">
          Complete as condições para visualizar a composição.
        </p>
      )}
    </DisclosureItem>
  );
});
