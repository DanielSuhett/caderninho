import { Badge } from "@cloudflare/kumo/components/badge";
import { Banner } from "@cloudflare/kumo/components/banner";
import { Input } from "@cloudflare/kumo/components/input";
import { Loader } from "@cloudflare/kumo/components/loader";
import { ArrowLeftIcon, UserPlusIcon } from "@phosphor-icons/react";
import type { ComponentProps, FormEvent, MouseEvent } from "react";

import type { ConnectionInfo, PortalResponse } from "../../contracts";
import type { Person } from "../../domain";
import { UiButton } from "../ui";
import { AccountAvatar } from "./account-identity";
import { BackofficeDialog } from "./backoffice-dialog";
import {
  BankPhase,
  bankPhase,
  ImportOutcome,
  journeyStages,
  stageOf,
  WizardStep,
} from "./bank-wizard";
import { importFailureMessage } from "./connection-journey";
import type { DashboardProps } from "./dashboard-view";
import { PersonEditor, personFormId } from "./person-editor";
import { PersonIdentity } from "./person-identity";
import { bankAppearance } from "./setup-banks";
import {
  type PersonDraft,
  useBankWizard,
  type WizardStart,
} from "./use-bank-wizard";

const credentialsFormId = "wizard-credentials";

const phaseBadges: Record<
  BankPhase,
  {
    label: string;
    variant: NonNullable<ComponentProps<typeof Badge>["variant"]>;
  }
> = {
  authorized: { label: "Autorizado", variant: "warning" },
  failed: { label: "Falha", variant: "error" },
  importing: { label: "Importando", variant: "info" },
  partial: { label: "Parcial", variant: "warning" },
  succeeded: { label: "Concluído", variant: "success" },
};

const phaseLabels = {
  accounts: "Identificando contas",
  bills: "Importando faturas",
  finish: "Concluindo",
  investments: "Importando investimentos",
  loans: "Importando empréstimos",
  transactions: "Importando transações",
};

export interface WizardViewProps {
  back: (() => void) | null;
  busy: boolean;
  created: boolean;
  draft: PersonDraft | null;
  importable: number;
  issue: string;
  journey: ConnectionInfo[];
  markDirty: () => void;
  message: string;
  onAddAnother: () => void;
  onOtherPerson: () => void;
  onSaveCredentials: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onSavePerson: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onSelect: (event: MouseEvent<HTMLButtonElement>) => void;
  outcome: ImportOutcome;
  person: Person | undefined;
  profile: PortalResponse["profiles"][number] | undefined;
  selected: string;
  snapshot: PortalResponse;
  step: WizardStep;
}

export function wizardTitle(step: WizardStep, outcome: ImportOutcome) {
  const titles: Record<WizardStep, string> = {
    authorize: "Autorizar banco",
    credentials: "Acesso Meu Pluggy",
    holder: "Quem é o titular?",
    importing: "Importação",
    person: "Nome e foto",
    review: "Bancos adicionados",
  };
  if (
    step === WizardStep.importing &&
    (outcome === ImportOutcome.done || outcome === ImportOutcome.partial)
  ) {
    return "Resultado da importação";
  }
  return titles[step];
}

function Progress({
  step,
  outcome,
}: {
  step: WizardStep;
  outcome: ImportOutcome;
}) {
  const current = stageOf(step, outcome);
  return (
    <ol
      aria-label="Etapas"
      className="wizard-steps"
    >
      {journeyStages.map((stage) => (
        <li
          aria-current={stage.id === current ? "step" : undefined}
          key={stage.id}
        >
          {stage.label}
        </li>
      ))}
    </ol>
  );
}

function Holder({ person }: { person: Person | undefined }) {
  if (!person) {
    return null;
  }
  return (
    <div className="wizard-holder">
      <PersonIdentity person={person} />
    </div>
  );
}

function HolderChoice({ props }: { props: WizardViewProps }) {
  return (
    <>
      <fieldset
        aria-label="Titular do banco"
        className="setup-person-picker"
      >
        {props.snapshot.people.map((person) => (
          <UiButton
            aria-pressed={props.selected === person.id}
            key={person.id}
            onClick={props.onSelect}
            type="button"
            value={person.id}
            variant={props.selected === person.id ? "secondary" : "outline"}
          >
            <PersonIdentity
              compact
              person={person}
            />
          </UiButton>
        ))}
        <UiButton
          onClick={props.onOtherPerson}
          type="button"
          variant="outline"
        >
          <UserPlusIcon size={20} />
          Outra pessoa
        </UiButton>
      </fieldset>
      <p>
        Cada pessoa usa o próprio acesso Meu Pluggy. Escolha quem é o titular do
        banco que será autorizado.
      </p>
    </>
  );
}

function CredentialsForm({ props }: { props: WizardViewProps }) {
  return (
    <form
      className="setup-form"
      id={credentialsFormId}
      onChangeCapture={props.markDirty}
      onSubmit={props.onSaveCredentials}
    >
      <p>
        Configure o acesso de {props.person?.name}. Ele será reutilizado nos
        próximos bancos; cada banco pede só uma autorização no Meu Pluggy.
      </p>
      <Input
        autoComplete="off"
        label="Client ID"
        maxLength={200}
        name="clientId"
        required
      />
      <Input
        autoComplete="new-password"
        label="Client Secret"
        maxLength={512}
        name="clientSecret"
        required
        type="password"
      />
      <a
        href="https://dashboard.pluggy.ai/"
        rel="noreferrer"
        target="_blank"
      >
        Obter credenciais na Pluggy
      </a>
    </form>
  );
}

function Authorize({ props }: { props: WizardViewProps }) {
  const paused = !!props.profile?.configured && !props.profile.enabled;
  return (
    <>
      <Holder person={props.person} />
      <p>
        Você vai autorizar um banco por vez no Meu Pluggy, usando o acesso já
        configurado de {props.person?.name}.
      </p>
      <p>
        Ao continuar, você autoriza o Caderninho a ler contas, saldos e
        lançamentos desse banco. Fechar a janela não revoga uma autorização já
        enviada.
      </p>
      {paused === true && (
        <Banner
          description="Este acesso Pluggy está pausado. Reative-o em Ajustes para conectar outro banco."
          role="alert"
          variant="error"
        />
      )}
    </>
  );
}

function BankList({ connections }: { connections: ConnectionInfo[] }) {
  return (
    <ul
      aria-label="Bancos desta jornada"
      className="setup-import-list wizard-banks"
    >
      {connections.map((connection) => {
        const appearance = bankAppearance(connection);
        const phase = bankPhase(connection);
        const badge = phaseBadges[phase];
        const step = connection.importCheckpoint?.phase;
        return (
          <li
            className="setup-import-item"
            key={connection.id}
          >
            <div className="setup-import-row">
              <AccountAvatar account={appearance} />
              <div>
                <strong>{appearance.name}</strong>
                <small>
                  {connection.personName}
                  {phase === BankPhase.importing &&
                    connection.importStatus === "running" &&
                    step &&
                    ` · ${phaseLabels[step]}`}
                  {phase === BankPhase.succeeded &&
                    !connection.hasTransactions &&
                    " · Nenhum lançamento encontrado"}
                </small>
              </div>
              <Badge variant={badge.variant}>{badge.label}</Badge>
            </div>
            {phase === BankPhase.failed && (
              <Banner
                description={
                  <>
                    {importFailureMessage(connection.importError)}
                    {!!connection.nextEligibleAt && (
                      <p>
                        Nova tentativa a partir de{" "}
                        {new Date(connection.nextEligibleAt).toLocaleString(
                          "pt-BR",
                        )}
                        .
                      </p>
                    )}
                  </>
                }
                variant="error"
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}

function Review({ props }: { props: WizardViewProps }) {
  return (
    <>
      <Holder person={props.person} />
      <BankList connections={props.journey} />
      <p>
        Os bancos abaixo foram autorizados. Nada é importado até você pedir.
      </p>
      <div>
        <UiButton
          disabled={props.busy}
          onClick={props.onAddAnother}
          type="button"
          variant="outline"
        >
          Adicionar outro banco
        </UiButton>
      </div>
    </>
  );
}

function ImportProgress({ props }: { props: WizardViewProps }) {
  const { outcome } = props;
  return (
    <>
      <Holder person={props.person} />
      {outcome === ImportOutcome.running && (
        <div
          className="setup-activity"
          role="status"
        >
          <Loader
            aria-label="Importação em andamento"
            size="base"
          />
          <p>Importando. Você pode fechar; a importação continua.</p>
        </div>
      )}
      {outcome === ImportOutcome.waiting && (
        <p role="status">
          {props.busy
            ? "Registrando o pedido de importação…"
            : "O pedido ainda não foi registrado. Importe novamente para continuar."}
        </p>
      )}
      {outcome === ImportOutcome.attention && (
        <Banner
          description="Os bancos concluídos e os dados parciais continuam disponíveis. Repita apenas o que falhou."
          title="A importação precisa de atenção"
          variant="alert"
        />
      )}
      {outcome === ImportOutcome.partial && (
        <Banner
          description="Parte do histórico foi importada. Os dados recebidos continuam disponíveis."
          variant="secondary"
        />
      )}
      {outcome === ImportOutcome.done && (
        <p role="status">
          Importação concluída para {props.journey.length}{" "}
          {props.journey.length === 1 ? "banco" : "bancos"}.
        </p>
      )}
      <BankList connections={props.journey} />
    </>
  );
}

export function WizardBody({ props }: { props: WizardViewProps }) {
  const { step } = props;
  const notice = props.issue || props.message;
  return (
    <div className="wizard">
      <Progress
        outcome={props.outcome}
        step={step}
      />
      {!!props.back && (
        <UiButton
          disabled={props.busy}
          onClick={props.back}
          type="button"
          variant="ghost"
        >
          <ArrowLeftIcon size={20} />
          Voltar
        </UiButton>
      )}
      {step === WizardStep.holder && <HolderChoice props={props} />}
      {step === WizardStep.person && (
        <PersonEditor
          busy={props.busy}
          changed={props.markDirty}
          formId={personFormId}
          onSubmit={props.onSavePerson}
          person={
            props.person ?? {
              id: "new",
              name: props.draft?.name ?? "",
              ...(props.draft?.photo && { photo: props.draft.photo }),
            }
          }
        />
      )}
      {step === WizardStep.credentials && <CredentialsForm props={props} />}
      {step === WizardStep.authorize && <Authorize props={props} />}
      {step === WizardStep.review && <Review props={props} />}
      {step === WizardStep.importing && <ImportProgress props={props} />}
      {!!notice && (
        <Banner
          description={notice}
          role={props.issue ? "alert" : "status"}
          variant={props.issue ? "error" : "secondary"}
        />
      )}
    </div>
  );
}

function primaryAction({
  props,
  actions,
}: {
  props: WizardViewProps;
  actions: {
    authorize: () => void;
    close: () => void;
    continueHolder: () => void;
    importBanks: () => void;
    refresh: () => void;
  };
}): ComponentProps<typeof UiButton> {
  const { outcome } = props;
  switch (props.step) {
    case WizardStep.holder:
      return {
        children: "Continuar",
        disabled: !props.selected,
        onClick: actions.continueHolder,
        type: "button",
      };
    case WizardStep.person:
      return {
        children: "Salvar e continuar",
        form: personFormId,
        type: "submit",
      };
    case WizardStep.credentials:
      return {
        children: "Validar e autorizar banco",
        form: credentialsFormId,
        type: "submit",
      };
    case WizardStep.authorize:
      return {
        children: "Abrir Meu Pluggy",
        disabled: !!props.profile && !props.profile.enabled,
        onClick: actions.authorize,
        type: "button",
      };
    case WizardStep.review:
      return {
        children: "Importar bancos adicionados",
        onClick: actions.importBanks,
        type: "button",
      };
    case WizardStep.importing:
      if (outcome === ImportOutcome.running) {
        return { children: "Fechar", onClick: actions.close, type: "button" };
      }
      if (outcome === ImportOutcome.done || outcome === ImportOutcome.partial) {
        return { children: "Concluir", onClick: actions.close, type: "button" };
      }
      if (props.importable) {
        return {
          children:
            outcome === ImportOutcome.waiting
              ? "Importar bancos adicionados"
              : "Tentar novamente",
          onClick: actions.importBanks,
          type: "button",
        };
      }
      return {
        children: "Atualizar status",
        onClick: actions.refresh,
        type: "button",
      };
    default:
      return { children: "Fechar", onClick: actions.close, type: "button" };
  }
}

export function AddBankWizard({
  props,
  start,
  close,
}: {
  props: DashboardProps;
  start: WizardStart;
  close: () => void;
}) {
  const model = useBankWizard(props, start);
  const view: WizardViewProps = {
    back: model.canBack ? model.back : null,
    busy: props.busy,
    created: model.created,
    draft: model.draft,
    importable: model.importable.length,
    issue: model.issue,
    journey: model.journey,
    markDirty: model.markDirty,
    message: props.message,
    onAddAnother: model.addAnother,
    onOtherPerson: model.otherPerson,
    onSaveCredentials: model.saveCredentials,
    onSavePerson: model.savePerson,
    onSelect: model.select,
    outcome: model.outcome,
    person: model.person,
    profile: model.profile,
    selected: model.selected,
    snapshot: props.snapshot,
    step: model.step,
  };
  return (
    <BackofficeDialog
      busy={props.busy}
      close={close}
      dirty={model.dirty}
      // The Meu Pluggy widget owns the screen while an authorization runs.
      open={!props.activity}
      presentation="compact-editor"
      primaryAction={primaryAction({
        actions: {
          authorize: model.authorize,
          close,
          continueHolder: model.continueHolder,
          importBanks: model.importBanks,
          refresh: props.refresh,
        },
        props: view,
      })}
      showCancel={
        model.step !== WizardStep.review && model.step !== WizardStep.importing
      }
      title={wizardTitle(model.step, model.outcome)}
    >
      <WizardBody props={view} />
    </BackofficeDialog>
  );
}
