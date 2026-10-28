import { Banner } from "@cloudflare/kumo/components/banner";
import { ClipboardText } from "@cloudflare/kumo/components/clipboard-text";
import { Input } from "@cloudflare/kumo/components/input";
import { Loader } from "@cloudflare/kumo/components/loader";
import { Select } from "@cloudflare/kumo/components/select";
import {
  GearIcon,
  PencilSimpleIcon,
  PlusIcon,
  QuestionIcon,
  UserPlusIcon,
} from "@phosphor-icons/react";
import {
  type FormEvent,
  lazy,
  type MouseEvent,
  Suspense,
  useCallback,
  useEffect,
  useState,
} from "react";

import type { HouseholdCommand, PortalResponse } from "../../contracts";
import { tryCatch } from "../../shared";
import { UiButton, UiIconButton } from "../ui";
import type { createAccountApi } from "./account-api";
import type { ManagementOutcome } from "./account-feedback";
import { AccountIdentity } from "./account-identity";
import { BackofficeDialog } from "./backoffice-dialog";
import { pendingImports } from "./bank-wizard";
import type { ConnectionActivity } from "./connection-journey";
import { DisclosureItem } from "./disclosure-item";
import { HouseholdPanel } from "./household-view";
import { PersonEditor } from "./person-editor";
import { PersonIdentity } from "./person-identity";
import { bankAppearance, SetupBanks } from "./setup-banks";
import type { WizardStart } from "./use-bank-wizard";
import { SetupStep, usePeopleSetup } from "./use-people-setup";
import { WorkspaceHeading } from "./workspace-ui";

export interface DashboardProps {
  activity: ConnectionActivity | null;
  busy: boolean;
  cancel: () => void;
  command: (action: string, ids?: string[]) => void;
  connect: (profileId: string, id?: string) => void;
  institutions: ReturnType<typeof createAccountApi>["institutions"];
  manage: (input: HouseholdCommand) => Promise<ManagementOutcome>;
  message: string;
  observedAt: string | null;
  personId: string;
  readError: boolean;
  refresh: () => void;
  section: "overview" | "connections";
  snapshot: PortalResponse;
}

// The wizard downloads when it opens; a failed chunk says so instead of failing silently.
function WizardChunkFailure() {
  return (
    <Banner
      description="Não foi possível abrir o assistente. Recarregue a página e tente de novo."
      role="alert"
      variant="error"
    />
  );
}
const AddBankWizard = lazy(async () => {
  const { data, error } = await tryCatch(() => import("./add-bank-wizard"));
  return { default: error ? WizardChunkFailure : data.AddBankWizard };
});

// Deep links from the setup checklist open the matching wizard once.
function requestedWizard(snapshot: PortalResponse): WizardStart | null {
  const requested = new URLSearchParams(location.search).get("wizard");
  if (requested === "bank") {
    return { kind: "bank" };
  }
  if (requested === "import") {
    const pending = snapshot.people.find(
      (person) => pendingImports(snapshot, person.id) > 0,
    );
    return pending ? { kind: "resume", personId: pending.id } : null;
  }
  return null;
}

export function DashboardView(props: DashboardProps) {
  const { snapshot, busy, activity } = props;
  const model = usePeopleSetup(props);
  const [help, setHelp] = useState(false);
  const [settings, setSettings] = useState(false);
  const [revoke, setRevoke] = useState(false);
  const [wizard, setWizard] = useState<WizardStart | null>(() =>
    requestedWizard(snapshot),
  );
  // The request is consumed so a reload does not reopen the dialog.
  useEffect(() => {
    const url = new URL(location.href);
    if (url.searchParams.has("wizard")) {
      url.searchParams.delete("wizard");
      history.replaceState(history.state, "", url);
    }
  }, []);
  const openBank = useCallback(
    () =>
      setWizard({
        kind: "bank",
        ...(model.person && { personId: model.person.id }),
      }),
    [model.person],
  );
  const openPerson = useCallback(() => setWizard({ kind: "person" }), []);
  const closeWizard = useCallback(() => setWizard(null), []);
  const resumeWizard = useCallback(
    () =>
      model.person && setWizard({ kind: "resume", personId: model.person.id }),
    [model.person],
  );
  const toggleHelp = useCallback(() => setHelp((value) => !value), []);
  const toggleSettings = useCallback(() => setSettings((value) => !value), []);
  const showRevoke = useCallback(() => setRevoke(true), []);
  const closeRevoke = useCallback(() => setRevoke(false), []);
  const confirmRevoke = useCallback(() => {
    props.command("disconnect-assistants");
    setRevoke(false);
  }, [props.command]);
  const assign = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const form = event.currentTarget;
      const { id } = form.dataset;
      if (id) {
        await props.manage({
          action: "assign_connection",
          connectionId: id,
          csrf: snapshot.csrf,
          personId: String(new FormData(form).get("personId")),
        });
      }
    },
    [props.manage, snapshot.csrf],
  );
  const labels = {
    credentials: "Seu acesso Pluggy",
    people: "Conexões",
    person: "Nome e foto",
  };
  return (
    <div className="finance-dashboard setup-page">
      <BackofficeDialog
        busy={busy}
        close={closeRevoke}
        dirty={false}
        open={revoke}
        presentation="confirmation"
        primaryAction={{
          children: "Confirmar revogação",
          onClick: confirmRevoke,
          type: "button",
          variant: "destructive",
        }}
        title="Revogar todos os assistentes"
      >
        <p>
          Todos os assistentes precisarão de uma nova autorização. Os dados
          desta instalação serão preservados.
        </p>
      </BackofficeDialog>
      {!!wizard && (
        <Suspense fallback={null}>
          <AddBankWizard
            close={closeWizard}
            props={props}
            start={wizard}
          />
        </Suspense>
      )}
      <WorkspaceHeading title={labels[model.step]}>
        {model.step === SetupStep.people && (
          <PageTools
            help={help}
            settings={settings}
            toggleHelp={toggleHelp}
            toggleSettings={toggleSettings}
          />
        )}
      </WorkspaceHeading>
      <SetupNotice
        model={model}
        props={props}
      />
      <ConnectingBank
        activity={activity}
        cancel={props.cancel}
      />
      {model.step === SetupStep.person && (
        <section className="setup-form">
          <PersonEditor
            busy={busy}
            changed={model.markDirty}
            onCancel={model.cancelForm}
            onSubmit={model.savePerson}
            person={model.person ?? { id: "new", name: "" }}
          />
        </section>
      )}
      {model.step === SetupStep.credentials && (
        <form
          className="setup-form"
          onChangeCapture={model.markDirty}
          onSubmit={model.saveCredentials}
        >
          <p>
            Configure o acesso de {model.person?.name}. Ele será reutilizado nos
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
          <div className="draft-actions">
            <UiButton
              disabled={busy}
              onClick={model.cancelForm}
              type="button"
              variant="outline"
            >
              Cancelar
            </UiButton>
            <UiButton
              disabled={busy}
              type="submit"
              variant="primary"
            >
              {busy ? "Validando…" : "Validar e conectar banco"}
            </UiButton>
          </div>
          <a
            href="https://dashboard.pluggy.ai/"
            rel="noreferrer"
            target="_blank"
          >
            Obter credenciais na Pluggy
          </a>
        </form>
      )}
      {model.step === SetupStep.people && (
        <PeopleBanks
          assign={assign}
          help={help}
          model={model}
          openBank={openBank}
          openPerson={openPerson}
          props={props}
          resume={resumeWizard}
          settings={settings}
          showRevoke={showRevoke}
        />
      )}
    </div>
  );
}

function AssistantSetup({ snapshot }: { snapshot: PortalResponse }) {
  const [assistant, setAssistant] = useState("ChatGPT");
  const chooseAssistant = useCallback(
    (event: MouseEvent<HTMLButtonElement>) =>
      setAssistant(event.currentTarget.value),
    [],
  );
  return (
    <div className="setup-form">
      <div className="draft-actions">
        <UiButton
          aria-pressed={assistant === "ChatGPT"}
          onClick={chooseAssistant}
          type="button"
          value="ChatGPT"
          variant="outline"
        >
          ChatGPT
        </UiButton>
        <UiButton
          aria-pressed={assistant === "Claude"}
          onClick={chooseAssistant}
          type="button"
          value="Claude"
          variant="outline"
        >
          Claude
        </UiButton>
      </div>
      <p>
        Adicione um conector MCP nas configurações de apps do {assistant},
        usando OAuth e este endereço:
      </p>
      <ClipboardText
        className="mcp-address"
        labels={{ copyAction: "Copiar URL MCP" }}
        text={`${snapshot.origin}/mcp`}
        tooltip={{ copiedText: "URL MCP copiada.", text: "Copiar URL MCP" }}
      />
      <p>
        Autorize no seu Caderninho. O assistente terá acesso aos dados de toda
        esta instalação.
      </p>
    </div>
  );
}

function PeopleBanks({
  props,
  model,
  help,
  settings,
  assign,
  showRevoke,
  openBank,
  openPerson,
  resume,
}: {
  props: DashboardProps;
  model: ReturnType<typeof usePeopleSetup>;
  help: boolean;
  settings: boolean;
  assign: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  showRevoke: () => void;
  openBank: () => void;
  openPerson: () => void;
  resume: () => void;
}) {
  const { snapshot, busy } = props;
  const reconnect = useCallback(
    (event: MouseEvent<HTMLButtonElement>) =>
      props.connect(
        event.currentTarget.dataset.profile ?? "default",
        event.currentTarget.value,
      ),
    [props.connect],
  );
  const holder = model.person;
  const pending = holder ? pendingImports(snapshot, holder.id) : 0;
  return (
    <>
      <fieldset
        aria-label="Pessoas"
        className="setup-person-picker"
      >
        {snapshot.people.map((value) => (
          <UiButton
            aria-pressed={model.selectedId === value.id}
            key={value.id}
            onClick={model.selectPerson}
            type="button"
            value={value.id}
            variant={model.selectedId === value.id ? "secondary" : "outline"}
          >
            <PersonIdentity
              compact
              person={value}
            />
          </UiButton>
        ))}
        <UiButton
          disabled={busy}
          onClick={openPerson}
          type="button"
          variant="ghost"
        >
          <UserPlusIcon size={20} />
          Outra pessoa
        </UiButton>
      </fieldset>
      {help === true && (
        <p>
          Conecte seus bancos no{" "}
          <a
            href="https://meu.pluggy.ai/"
            rel="noreferrer"
            target="_blank"
          >
            Meu Pluggy
          </a>
          . Autorize um banco por vez usando o mesmo acesso. Outra pessoa
          precisa da própria conta Meu Pluggy.
        </p>
      )}
      {holder ? (
        <section
          aria-labelledby="person-banks-heading"
          className="entity-panel"
        >
          <header className="entity-panel-header">
            <h2 id="person-banks-heading">Bancos de {holder.name}</h2>
            <div className="entity-panel-actions">
              <UiIconButton
                disabled={busy}
                label="Editar nome e foto"
                onClick={model.editPerson}
              >
                <PencilSimpleIcon size={20} />
              </UiIconButton>
              <UiButton
                disabled={busy}
                onClick={openBank}
                type="button"
                variant={model.connections.length ? "secondary" : "primary"}
              >
                <PlusIcon size={20} />
                Adicionar banco
              </UiButton>
            </div>
          </header>
          {pending > 0 && (
            <div className="entity-panel-notice">
              <Banner
                description={
                  pending === 1
                    ? "1 banco precisa ser importado."
                    : `${pending} bancos precisam ser importados.`
                }
                variant="secondary"
              />
              <UiButton
                disabled={busy}
                onClick={resume}
                type="button"
              >
                Importar
              </UiButton>
            </div>
          )}
          <SetupBanks
            connections={model.connections}
            csrf={snapshot.csrf}
            institutions={props.institutions}
            manage={props.manage}
          />
        </section>
      ) : (
        <p className="muted">
          Adicione uma pessoa para conectar o primeiro banco.
        </p>
      )}
      {!!snapshot.connections.length && (
        <DisclosureItem
          defaultOpen={new URLSearchParams(location.search).has("assistant")}
          summary="Conectar ChatGPT ou Claude"
        >
          <AssistantSetup snapshot={snapshot} />
        </DisclosureItem>
      )}
      {settings === true && (
        <section
          aria-label="Ajustes avançados"
          className="setup-settings"
        >
          <HouseholdPanel
            busy={busy}
            manage={props.manage}
            snapshot={snapshot}
          />
          {snapshot.connections.map((connection) => (
            <DisclosureItem
              key={connection.id}
              summary={<AccountIdentity account={bankAppearance(connection)} />}
            >
              <UiButton
                data-profile={connection.profileId ?? "default"}
                disabled={busy}
                onClick={reconnect}
                type="button"
                value={connection.id}
              >
                Reautorizar banco
              </UiButton>
              <form
                data-id={connection.id}
                onSubmit={assign}
              >
                <Select
                  defaultValue={connection.personId ?? "self"}
                  items={snapshot.people.map((person) => ({
                    label: person.name,
                    value: person.id,
                  }))}
                  label="Pessoa desta conexão"
                  name="personId"
                />
                <p>
                  Altera a organização do histórico; não muda o titular no banco
                  ou as credenciais.
                </p>
                <UiButton
                  disabled={busy}
                  type="submit"
                >
                  Salvar titular
                </UiButton>
              </form>
            </DisclosureItem>
          ))}
          <UiButton
            disabled={busy}
            onClick={showRevoke}
            tone="danger"
            type="button"
          >
            Revogar todos os assistentes
          </UiButton>
        </section>
      )}
    </>
  );
}

function PageTools({
  help,
  settings,
  toggleHelp,
  toggleSettings,
}: {
  help: boolean;
  settings: boolean;
  toggleHelp: () => void;
  toggleSettings: () => void;
}) {
  return (
    <fieldset
      aria-label="Ajuda e ajustes"
      className="setup-actions"
    >
      <UiIconButton
        aria-expanded={help}
        label="Como conectar bancos"
        onClick={toggleHelp}
      >
        <QuestionIcon size={20} />
      </UiIconButton>
      <UiIconButton
        aria-expanded={settings}
        label="Ajustes de pessoas e credenciais"
        onClick={toggleSettings}
      >
        <GearIcon size={20} />
      </UiIconButton>
    </fieldset>
  );
}

function SetupNotice({
  props,
  model,
}: {
  props: DashboardProps;
  model: ReturnType<typeof usePeopleSetup>;
}) {
  const message =
    model.issue ||
    props.message ||
    (props.readError
      ? "Não foi possível atualizar o status. Os dados salvos continuam disponíveis."
      : "");
  if (!message) {
    return null;
  }
  return (
    <div
      ref={model.notice}
      tabIndex={-1}
    >
      <Banner
        description={message}
        role={model.issue ? "alert" : "status"}
        variant={model.issue || props.readError ? "error" : "secondary"}
      />
    </div>
  );
}
function ConnectingBank({
  activity,
  cancel,
}: {
  activity: ConnectionActivity | null;
  cancel: () => void;
}) {
  if (!activity) {
    return null;
  }
  return (
    <section
      className="setup-activity"
      role="status"
    >
      <Loader
        aria-label="Conectando banco"
        size="base"
      />
      <p>
        {
          {
            opening: "Abrindo Meu Pluggy…",
            registering: "Registrando banco…",
            widget: "Autorize o banco na janela do Meu Pluggy.",
          }[activity.stage]
        }
      </p>
      {activity.stage !== "registering" && (
        <UiButton
          onClick={cancel}
          type="button"
        >
          Fechar janela
        </UiButton>
      )}
    </section>
  );
}
