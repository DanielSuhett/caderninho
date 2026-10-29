import { Banner } from "@cloudflare/kumo/components/banner";
import { Input } from "@cloudflare/kumo/components/input";
import { Loader } from "@cloudflare/kumo/components/loader";
import { Radio } from "@cloudflare/kumo/components/radio";
import { Select } from "@cloudflare/kumo/components/select";
import { Switch } from "@cloudflare/kumo/components/switch";
import { ArrowLeftIcon } from "@phosphor-icons/react";
import {
  type ChangeEvent,
  type FormEvent,
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
  type RuleJob,
  type RulePreviewInput,
  type RulePreviewResult,
  type WorkspaceCatalog,
} from "../../contracts";
import { RuleJobStatus, RuleOperator, ruleJobActive } from "../../domain";
import { HttpRequestError, tryCatch } from "../../shared";
import { randomId } from "../random-id";
import { UiButton } from "../ui";
import type { OrganizationApi } from "./account-api";
import { BackofficeDialog } from "./backoffice-dialog";
import { CategoryLabel } from "./category-appearance";
import { DisclosureItem } from "./disclosure-item";
import { RuleComposition } from "./rule-composition";
import { RuleConditionsBuilder } from "./rule-conditions";
import {
  type DraftAlternative,
  parseRuleDraft,
  rulePresets,
} from "./rule-draft";
import { useRuleJobPolling } from "./rule-jobs";
import { ruleSummary } from "./rule-presentation";
import { RulePreview } from "./rule-preview";
import {
  CounterpartyKey,
  initialJourney,
  type JourneyDraft,
  journeyAlternatives,
  journeySubject,
  RuleJourney,
  type RuleSeed,
  RuleStep,
  ruleStepLabels,
  ruleSteps,
} from "./rule-wizard";

type Rule = WorkspaceCatalog["rules"][number];
type Accounts = { id: string; name: string; personName: string }[];

const Phase = {
  done: "done",
  editing: "editing",
  reapplying: "reapplying",
  saving: "saving",
} as const;
type Phase = (typeof Phase)[keyof typeof Phase];

const journeys = [
  {
    description: "Quem recebeu o pagamento, pelo CNPJ/CPF ou pelo nome.",
    label: "Pelo beneficiário",
    value: RuleJourney.counterparty,
  },
  {
    description: "Um texto que aparece no extrato.",
    label: "Pela descrição",
    value: RuleJourney.description,
  },
  {
    description: "Supermercados, assinaturas, salário e PIX enviados.",
    label: "Modelo pronto",
    value: RuleJourney.preset,
  },
  {
    description: "Combine descrição, valor, data, conta e pessoa com E/OU.",
    label: "Regra avançada",
    value: RuleJourney.advanced,
  },
];
const descriptionOperators: { label: string; value: string }[] = [
  { label: "Contém", value: RuleOperator.contains },
  { label: "É igual a", value: RuleOperator.equals },
  { label: "Começa com", value: RuleOperator.starts_with },
];
const count = new Intl.NumberFormat("pt-BR");

interface RuleSettings {
  category: string;
  enabled: boolean;
  name: string;
  priority: string;
}
type ChangeSettings = (patch: Partial<RuleSettings>) => void;
type EditJourney = (next: (previous: JourneyDraft) => JourneyDraft) => void;
interface SaveValues {
  accountId: null;
  categoryId: string;
  direction: null;
  enabled: boolean;
  filter: NonNullable<RulePreviewInput["filter"]>;
  name: string;
  priority: number;
  spaceId: string;
  text: "";
}

const reapplyFailures = {
  busy: "A regra foi salva. Já há uma atualização de regras em andamento; reaplique quando ela terminar.",
  failed:
    "A regra foi salva, mas a reclassificação não terminou. Reaplique as regras pela página de regras.",
  start:
    "A regra foi salva, mas a reclassificação não começou. Reaplique as regras pela página de regras.",
};

// Saving and reclassifying are one action: the rule is written first, then the
// space's history is reapplied as a background job the dialog follows.
function useRuleSave({
  api,
  csrf,
  rule,
  spaceId,
}: {
  api: OrganizationApi;
  csrf: string;
  rule: Rule | undefined;
  spaceId: string;
}) {
  const [phase, setPhase] = useState<Phase>(Phase.editing);
  const [job, setJob] = useState<RuleJob | null>(null);
  const [message, setMessage] = useState("");
  const inFlight = useRef<AbortController | null>(null);
  const receipt = useRef({ key: "", payload: "" });
  useEffect(() => () => inFlight.current?.abort(), []);
  const settled = useRef((next: RuleJob) => {
    setPhase(Phase.done);
    if (next.status === RuleJobStatus.failed) {
      setMessage(reapplyFailures.failed);
    }
  });
  useRuleJobPolling({ api, job, settled, update: setJob });

  const reapply = useCallback(
    async (signal: AbortSignal) => {
      setPhase(Phase.reapplying);
      const { data, error } = await tryCatch(() =>
        api.ruleJobs({ action: "reapply", csrf, spaceId }, signal),
      );
      if (signal.aborted) {
        return;
      }
      if (error) {
        setPhase(Phase.done);
        const busy =
          error instanceof HttpRequestError && error.failure.status === 409;
        setMessage(busy ? reapplyFailures.busy : reapplyFailures.start);
        return;
      }
      setJob(data);
      if (!ruleJobActive(data)) {
        settled.current(data);
      }
    },
    [api, csrf, spaceId],
  );

  const save = useCallback(
    async (values: SaveValues, reclassify: boolean) => {
      if (inFlight.current) {
        return false;
      }
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
        csrf,
      });
      if (!parsed.success) {
        setMessage("Confira nome, categoria e prioridade antes de salvar.");
        return false;
      }
      const controller = new AbortController();
      inFlight.current = controller;
      setPhase(Phase.saving);
      setMessage("");
      const { error } = await tryCatch(() =>
        api.planning(parsed.data.command, csrf, controller.signal),
      );
      if (controller.signal.aborted) {
        return false;
      }
      if (error) {
        inFlight.current = null;
        setPhase(Phase.editing);
        setMessage(
          "Não foi possível salvar. O rascunho foi mantido; tente novamente.",
        );
        return false;
      }
      if (reclassify) {
        await reapply(controller.signal);
      } else {
        setPhase(Phase.done);
      }
      inFlight.current = null;
      return true;
    },
    [api, csrf, reapply, rule],
  );
  return { job, message, phase, save };
}

export function RuleEditor({
  open,
  api,
  snapshot,
  catalog,
  accounts,
  spaceId,
  rule,
  seed,
  close,
  saved,
}: {
  open: boolean;
  api: OrganizationApi;
  snapshot: PortalResponse;
  catalog: WorkspaceCatalog;
  accounts: Accounts;
  spaceId: string;
  rule?: Rule;
  seed?: RuleSeed | undefined;
  close: () => void;
  saved: () => void;
}) {
  const steps = useMemo(() => ruleSteps(!!rule), [rule]);
  const [step, setStep] = useState<RuleStep>(steps[0] ?? RuleStep.conditions);
  const [journey, setJourney] = useState(() => initialJourney(rule, seed));
  const [currency, setCurrency] = useState(rule?.filter?.currency ?? "");
  const [settings, setSettings] = useState<RuleSettings>(() => ({
    category: rule?.categoryId ?? seed?.category ?? "",
    enabled: rule?.enabled ?? true,
    name: rule?.name ?? "",
    priority: String(rule?.priority ?? 100),
  }));
  const [reclassify, setReclassify] = useState(true);
  const [sample, setSample] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const saving = useRuleSave({ api, csrf: snapshot.csrf, rule, spaceId });
  const { phase, job } = saving;
  const formId = useId();

  const alternatives = useMemo(() => journeyAlternatives(journey), [journey]);
  const draft = useMemo(
    () =>
      parseRuleDraft({
        accountId: null,
        alternatives,
        csrf: snapshot.csrf,
        currency,
        direction: null,
        spaceId,
        text: "",
      }),
    [alternatives, currency, snapshot.csrf, spaceId],
  );
  const categoryRow = catalog.categories.find(
    (c) => c.id === settings.category,
  );
  const suggestedName = [categoryRow?.name, journeySubject(journey, sample)]
    .filter(Boolean)
    .join(": ")
    .slice(0, 240);
  const ruleName = settings.name || suggestedName;
  const applies = reclassify && settings.enabled;

  const edit = useCallback<EditJourney>((next) => {
    setDirty(true);
    setJourney(next);
  }, []);
  const changeSettings = useCallback<ChangeSettings>((patch) => {
    setDirty(true);
    setSettings((previous) => ({ ...previous, ...patch }));
  }, []);
  const changeCurrency = useCallback((value: string) => {
    setDirty(true);
    setCurrency(value);
  }, []);
  const onPreview = useCallback(
    (result: RulePreviewResult) =>
      setSample(
        result.samples.find((row) => row.counterparty)?.counterparty ?? null,
      ),
    [],
  );

  const finish = useCallback(() => {
    if (job) {
      api.invalidate();
    }
    saved();
  }, [api, job, saved]);
  const dismiss = useCallback(() => {
    if (phase === Phase.editing) {
      close();
      return;
    }
    finish();
  }, [close, finish, phase]);

  const index = steps.indexOf(step);
  const back = useCallback(() => {
    const previous = steps[index - 1];
    if (previous) {
      setStep(previous);
    }
  }, [index, steps]);
  const save = useCallback(async () => {
    if (!draft.data?.filter) {
      return;
    }
    const done = await saving.save(
      {
        accountId: null,
        categoryId: settings.category,
        direction: null,
        enabled: settings.enabled,
        filter: draft.data.filter,
        name: ruleName,
        priority: Number(settings.priority),
        spaceId,
        text: "",
      },
      applies,
    );
    if (done) {
      setDirty(false);
    }
  }, [applies, draft, ruleName, saving, settings, spaceId]);
  const submit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (phase !== Phase.editing) {
        finish();
        return;
      }
      const next = steps[index + 1];
      if (next) {
        setStep(next);
        return;
      }
      save().catch(() => undefined);
    },
    [finish, index, phase, save, steps],
  );

  const named = !!settings.category && !!ruleName.trim();
  const ready: Record<RuleStep, boolean> = {
    apply: draft.success && named,
    category: named,
    conditions: draft.success,
    start: true,
  };
  const blocked =
    phase === Phase.saving || (phase === Phase.editing && !ready[step]);
  return (
    <BackofficeDialog
      busy={phase === Phase.saving}
      close={dismiss}
      dirty={dirty}
      open={open}
      primaryAction={{
        children: primaryLabel({
          editing: !!rule,
          phase,
          reclassify: applies,
          step,
        }),
        disabled: blocked,
        form: formId,
        type: "submit",
      }}
      showCancel={phase === Phase.editing}
      title={rule ? "Editar regra" : "Nova regra"}
    >
      <form
        className="backoffice-form rule-wizard"
        id={formId}
        onSubmit={submit}
      >
        {phase === Phase.editing ? (
          <>
            <WizardHead
              back={back}
              step={step}
              steps={steps}
            />
            <StepBody
              accounts={accounts}
              api={api}
              catalog={catalog}
              changeCurrency={changeCurrency}
              changeSettings={changeSettings}
              currency={currency}
              draft={draft}
              edit={edit}
              journey={journey}
              onPreview={onPreview}
              open={open}
              reclassify={reclassify}
              ruleName={ruleName}
              setReclassify={setReclassify}
              settings={settings}
              snapshot={snapshot}
              spaceName={
                catalog.spaces.find((s) => s.id === spaceId)?.name ?? ""
              }
              step={step}
              suggestedName={suggestedName}
            />
          </>
        ) : (
          <SaveProgress
            job={job}
            phase={phase}
            ruleName={ruleName}
          />
        )}
        {!!saving.message && (
          <Banner
            className="feedback"
            description={saving.message}
            role="alert"
            variant={phase === Phase.editing ? "error" : "alert"}
          />
        )}
      </form>
    </BackofficeDialog>
  );
}

function WizardHead({
  back,
  step,
  steps,
}: {
  back: () => void;
  step: RuleStep;
  steps: RuleStep[];
}) {
  return (
    <header className="rule-wizard-head">
      {steps.indexOf(step) > 0 && (
        <UiButton
          icon={ArrowLeftIcon}
          onClick={back}
          type="button"
          variant="ghost"
        >
          Voltar
        </UiButton>
      )}
      <ol
        aria-label="Etapas"
        className="wizard-steps rule-wizard-steps"
      >
        {steps.map((item) => (
          <li
            aria-current={item === step ? "step" : undefined}
            key={item}
          >
            {ruleStepLabels[item]}
          </li>
        ))}
      </ol>
    </header>
  );
}

function StepBody(props: {
  accounts: Accounts;
  api: OrganizationApi;
  catalog: WorkspaceCatalog;
  changeCurrency: (value: string) => void;
  changeSettings: ChangeSettings;
  currency: string;
  draft: ReturnType<typeof parseRuleDraft>;
  edit: EditJourney;
  journey: JourneyDraft;
  onPreview: (result: RulePreviewResult) => void;
  open: boolean;
  reclassify: boolean;
  ruleName: string;
  setReclassify: (value: boolean) => void;
  settings: RuleSettings;
  snapshot: PortalResponse;
  spaceName: string;
  step: RuleStep;
  suggestedName: string;
}) {
  const { draft, settings } = props;
  switch (props.step) {
    case RuleStep.start:
      return (
        <StartStep
          edit={props.edit}
          journey={props.journey}
        />
      );
    case RuleStep.conditions:
      return (
        <>
          <ConditionsStep
            accounts={props.accounts}
            currency={props.currency}
            edit={props.edit}
            journey={props.journey}
            setCurrency={props.changeCurrency}
            snapshot={props.snapshot}
          />
          <RulePreview
            accounts={props.accounts}
            api={props.api}
            input={props.open && draft.success ? draft.data : null}
            loaded={props.onPreview}
          />
        </>
      );
    case RuleStep.category:
      return (
        <CategoryStep
          catalog={props.catalog}
          change={props.changeSettings}
          settings={settings}
          suggestedName={props.suggestedName}
        />
      );
    default:
      return draft.success && draft.data.filter ? (
        <ApplyStep
          accounts={props.accounts}
          catalog={props.catalog}
          filter={draft.data.filter}
          people={props.snapshot.people}
          reclassify={props.reclassify}
          ruleName={props.ruleName}
          setReclassify={props.setReclassify}
          settings={settings}
          spaceName={props.spaceName}
        />
      ) : null;
  }
}

function primaryLabel({
  editing,
  phase,
  reclassify,
  step,
}: {
  editing: boolean;
  phase: Phase;
  reclassify: boolean;
  step: RuleStep;
}) {
  if (phase === Phase.saving) {
    return "Salvando…";
  }
  if (phase === Phase.reapplying) {
    return "Continuar em segundo plano";
  }
  if (phase === Phase.done) {
    return "Concluir";
  }
  if (step !== RuleStep.apply) {
    return "Continuar";
  }
  if (reclassify) {
    return "Salvar e reclassificar";
  }
  return editing ? "Salvar alterações" : "Criar regra";
}

function StartStep({
  journey,
  edit,
}: {
  journey: JourneyDraft;
  edit: (next: (previous: JourneyDraft) => JourneyDraft) => void;
}) {
  const choose = useCallback(
    (value: unknown) => {
      const next = journeys.find((row) => row.value === value)?.value;
      if (next) {
        edit((previous) => ({ ...previous, journey: next }));
      }
    },
    [edit],
  );
  return (
    <Radio.Group
      appearance="card"
      className="rule-journeys"
      legend="Como reconhecer as transações?"
      onValueChange={choose}
      value={journey.journey}
    >
      {journeys.map((row) => (
        <Radio.Item
          description={row.description}
          key={row.value}
          label={row.label}
          value={row.value}
        />
      ))}
    </Radio.Group>
  );
}

function ConditionsStep({
  accounts,
  currency,
  edit,
  journey,
  setCurrency,
  snapshot,
}: {
  accounts: Accounts;
  currency: string;
  edit: EditJourney;
  journey: JourneyDraft;
  setCurrency: (value: string) => void;
  snapshot: PortalResponse;
}) {
  const editAlternatives = useCallback(
    (next: (previous: DraftAlternative[]) => DraftAlternative[]) =>
      edit((previous) => ({
        ...previous,
        alternatives: next(previous.alternatives),
      })),
    [edit],
  );
  const toAdvanced = useCallback(
    () =>
      edit((previous) => ({
        ...previous,
        alternatives: journeyAlternatives(previous),
        journey: RuleJourney.advanced,
      })),
    [edit],
  );
  const onDebit = useCallback(
    (checked: boolean) =>
      edit((previous) => ({ ...previous, debitOnly: checked })),
    [edit],
  );
  if (journey.journey === RuleJourney.advanced) {
    return (
      <RuleConditionsBuilder
        accounts={accounts}
        alternatives={journey.alternatives}
        change={editAlternatives}
        currency={currency}
        setCurrency={setCurrency}
        snapshot={snapshot}
      />
    );
  }
  const debit = (
    <div className="check-field">
      <Switch
        checked={journey.debitOnly}
        label="Só saídas de dinheiro"
        onCheckedChange={onDebit}
      />
    </div>
  );
  const refine = (
    <UiButton
      className="rule-refine"
      onClick={toAdvanced}
      type="button"
      variant="ghost"
    >
      Refinar com mais condições
    </UiButton>
  );
  if (journey.journey === RuleJourney.preset) {
    return (
      <>
        <PresetChoice
          edit={edit}
          journey={journey}
        />
        {!!journey.preset && refine}
      </>
    );
  }
  if (journey.journey === RuleJourney.description) {
    return (
      <>
        <DescriptionFields
          edit={edit}
          journey={journey}
        />
        {debit}
        {refine}
      </>
    );
  }
  return (
    <>
      <CounterpartyFields
        edit={edit}
        journey={journey}
      />
      {debit}
      {refine}
    </>
  );
}

function CounterpartyFields({
  journey,
  edit,
}: {
  journey: JourneyDraft;
  edit: (next: (previous: JourneyDraft) => JourneyDraft) => void;
}) {
  const { counterparty } = journey;
  const onKey = useCallback(
    (value: unknown) => {
      const key =
        value === CounterpartyKey.name
          ? CounterpartyKey.name
          : CounterpartyKey.document;
      edit((previous) => ({
        ...previous,
        counterparty: { ...previous.counterparty, key },
      }));
    },
    [edit],
  );
  const onValue = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const { value } = event.currentTarget;
      edit((previous) => ({
        ...previous,
        counterparty: {
          ...previous.counterparty,
          [previous.counterparty.key]: value,
        },
      }));
    },
    [edit],
  );
  const byDocument = counterparty.key === CounterpartyKey.document;
  return (
    <>
      <Radio.Group
        legend="Identificar por"
        onValueChange={onKey}
        orientation="horizontal"
        value={counterparty.key}
      >
        <Radio.Item
          label="CNPJ ou CPF"
          value={CounterpartyKey.document}
        />
        <Radio.Item
          label="Nome"
          value={CounterpartyKey.name}
        />
      </Radio.Group>
      <Input
        autoFocus
        inputMode={byDocument ? "numeric" : "text"}
        label={byDocument ? "CNPJ ou CPF do beneficiário" : "Nome contém"}
        maxLength={160}
        onChange={onValue}
        placeholder={byDocument ? "00.000.000/0000-00" : "Ex.: PJBANK"}
        required
        value={byDocument ? counterparty.document : counterparty.name}
      />
    </>
  );
}

function DescriptionFields({
  journey,
  edit,
}: {
  journey: JourneyDraft;
  edit: (next: (previous: JourneyDraft) => JourneyDraft) => void;
}) {
  const onOperator = useCallback(
    (value: string | null) =>
      edit((previous) => ({
        ...previous,
        description: {
          ...previous.description,
          operator: value ?? RuleOperator.contains,
        },
      })),
    [edit],
  );
  const onText = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const { value } = event.currentTarget;
      edit((previous) => ({
        ...previous,
        description: { ...previous.description, text: value },
      }));
    },
    [edit],
  );
  return (
    <div className="rule-description-fields">
      <Select
        className="w-full"
        items={descriptionOperators}
        label="A descrição"
        onValueChange={onOperator}
        value={journey.description.operator}
      />
      <Input
        autoFocus
        label="Texto"
        maxLength={160}
        onChange={onText}
        placeholder="Ex.: netflix"
        required
        value={journey.description.text}
      />
    </div>
  );
}

function PresetChoice({
  journey,
  edit,
}: {
  journey: JourneyDraft;
  edit: (next: (previous: JourneyDraft) => JourneyDraft) => void;
}) {
  const choose = useCallback(
    (value: unknown) => {
      const preset = rulePresets.find((row) => row.name === value);
      if (preset) {
        edit((previous) => ({ ...previous, preset: preset.name }));
      }
    },
    [edit],
  );
  return (
    <Radio.Group
      appearance="card"
      className="rule-journeys"
      legend="Modelo"
      onValueChange={choose}
      value={journey.preset}
    >
      {rulePresets.map((preset) => (
        <Radio.Item
          description={`Descrição com ${preset.terms.map((term) => `“${term}”`).join(" ou ")}`}
          key={preset.name}
          label={preset.name}
          value={preset.name}
        />
      ))}
    </Radio.Group>
  );
}

function CategoryStep({
  catalog,
  change,
  settings,
  suggestedName,
}: {
  catalog: WorkspaceCatalog;
  change: ChangeSettings;
  settings: RuleSettings;
  suggestedName: string;
}) {
  const onCategory = useCallback(
    (value: string | null) => change({ category: value ?? "" }),
    [change],
  );
  const onName = useCallback(
    (event: ChangeEvent<HTMLInputElement>) =>
      change({ name: event.currentTarget.value }),
    [change],
  );
  const onPriority = useCallback(
    (event: ChangeEvent<HTMLInputElement>) =>
      change({ priority: event.currentTarget.value }),
    [change],
  );
  const onEnabled = useCallback(
    (checked: boolean) => change({ enabled: checked }),
    [change],
  );
  return (
    <>
      <Select
        className="w-full"
        items={catalog.categories
          .filter((c) => !c.hidden || c.id === settings.category)
          .map((c) => ({
            label: <CategoryLabel category={c} />,
            value: c.id,
          }))}
        label="Classificar como"
        onValueChange={onCategory}
        placeholder="Escolha uma categoria"
        required
        value={settings.category}
      />
      <Input
        label="Nome da regra"
        maxLength={240}
        onChange={onName}
        placeholder={suggestedName || "Ex.: Aluguel"}
        value={settings.name}
      />
      <DisclosureItem summary="Mais opções">
        <div className="editor-grid">
          <Input
            description={
              <small>Quando duas regras servem, o menor número vence.</small>
            }
            label="Prioridade"
            max={1000}
            min={0}
            onChange={onPriority}
            required
            type="number"
            value={settings.priority}
          />
          <div className="check-field">
            <Switch
              checked={settings.enabled}
              label="Regra ativa"
              onCheckedChange={onEnabled}
            />
          </div>
        </div>
      </DisclosureItem>
    </>
  );
}

function ApplyStep({
  accounts,
  catalog,
  filter,
  people,
  reclassify,
  ruleName,
  setReclassify,
  settings,
  spaceName,
}: {
  accounts: Accounts;
  catalog: WorkspaceCatalog;
  filter: NonNullable<RulePreviewInput["filter"]>;
  people: PortalResponse["people"];
  reclassify: boolean;
  ruleName: string;
  setReclassify: (value: boolean) => void;
  settings: RuleSettings;
  spaceName: string;
}) {
  const { enabled } = settings;
  const row = catalog.categories.find((c) => c.id === settings.category);
  const rule = useMemo(
    () => ({ accountId: null, direction: null, filter, text: "" }),
    [filter],
  );
  return (
    <>
      <section className="rule-review">
        <h3>{ruleName}</h3>
        <p>{ruleSummary({ rule })}</p>
        <p className="rule-review-outcome">
          <CategoryLabel
            category={row}
            label={row?.name ?? ""}
          />
        </p>
      </section>
      {enabled ? (
        <div className="check-field">
          <Switch
            checked={reclassify}
            label={`Reclassificar o histórico de ${spaceName}`}
            onCheckedChange={setReclassify}
          />
        </div>
      ) : null}
      {enabled && reclassify ? (
        <p className="muted">Categorias escolhidas à mão são mantidas.</p>
      ) : null}
      <DisclosureItem summary="Ver composição">
        <RuleComposition
          accounts={accounts}
          category={row?.name ?? ""}
          categoryAppearance={row}
          enabled={enabled}
          people={people}
          rule={rule}
        />
      </DisclosureItem>
    </>
  );
}

function SaveProgress({
  job,
  phase,
  ruleName,
}: {
  job: RuleJob | null;
  phase: Phase;
  ruleName: string;
}) {
  const changed = job?.applied.changed ?? 0;
  const label =
    changed === 1 ? "transação reclassificada" : "transações reclassificadas";
  if (phase === Phase.saving) {
    return (
      <div
        className="rule-progress"
        role="status"
      >
        <Loader />
        <p>Salvando a regra…</p>
      </div>
    );
  }
  if (phase === Phase.reapplying) {
    return (
      <div
        className="rule-progress"
        role="status"
      >
        <Loader />
        <p>Reclassificando o histórico…</p>
        {!!changed && (
          <p className="muted">
            {count.format(changed)} {label} até agora
          </p>
        )}
      </div>
    );
  }
  return (
    <div
      className="rule-progress rule-progress-done"
      role="status"
    >
      <p className="rule-progress-title">{ruleName} salva</p>
      {job?.status === RuleJobStatus.succeeded && (
        <p>
          <strong className="rule-progress-count">
            {count.format(changed)}
          </strong>{" "}
          {label}
        </p>
      )}
    </div>
  );
}
