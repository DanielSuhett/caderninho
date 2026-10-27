import { Banner } from "@cloudflare/kumo/components/banner";
import { ClipboardText } from "@cloudflare/kumo/components/clipboard-text";
import { Input } from "@cloudflare/kumo/components/input";
import { Loader } from "@cloudflare/kumo/components/loader";
import { Select } from "@cloudflare/kumo/components/select";
import {
  ArrowRightIcon,
  GearIcon,
  PencilSimpleIcon,
  PlusIcon,
  QuestionIcon,
  UserPlusIcon,
} from "@phosphor-icons/react";
import { type FormEvent, type MouseEvent, useCallback, useState } from "react";

import type { HouseholdCommand, PortalResponse } from "../../contracts";
import { UiButton, UiIconButton, UiLink } from "../ui";
import type { createAccountApi } from "./account-api";
import type { ManagementOutcome } from "./account-feedback";
import { AccountIdentity } from "./account-identity";
import { workspaceHref } from "./account-navigation";
import { BackofficeDialog } from "./backoffice-dialog";
import type { ConnectionActivity } from "./connection-journey";
import { DisclosureItem } from "./disclosure-item";
import { HouseholdPanel } from "./household-view";
import { PersonEditor } from "./person-editor";
import { PersonIdentity } from "./person-identity";
import { bankAppearance, SetupBanks } from "./setup-banks";
import { SetupImport } from "./setup-import";
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

export function DashboardView(props: DashboardProps) {
  const { snapshot, busy, activity } = props;
  const model = usePeopleSetup(props);
  const [help, setHelp] = useState(false);
  const [settings, setSettings] = useState(false);
  const [revoke, setRevoke] = useState(false);
  const toggleHelp = useCallback(() => setHelp((value) => !value), []);
  const toggleSettings = useCallback(() => setSettings((value) => !value), []);
  const showRevoke = useCallback(() => setRevoke(true), []);
  const closeRevoke = useCallback(() => setRevoke(false), []);
  const confirmRevoke = useCallback(() => {
    props.command("disconnect-assistants");
    setRevoke(false);
  }, [props.command]);
  const people = useCallback(() => model.go(SetupStep.people), [model.go]);
  const importing = useCallback(
    () => model.go(SetupStep.importing),
    [model.go],
  );
  const assistant = useCallback(() => {
    if (
      snapshot.connections.some(
        (connection) =>
          !connection.importStatus ||
          connection.importStatus === "pending" ||
          connection.importStatus === "running",
      )
    ) {
      model.go(SetupStep.importing);
      return;
    }
    model.go(SetupStep.assistant);
  }, [model.go, snapshot.connections]);
  const finishImport = useCallback(
    () => model.go(SetupStep.assistant),
    [model.go],
  );
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
    assistant: "Consultar",
    credentials: "Seu acesso Pluggy",
    import: "Importar",
    people: "Pessoas",
    person: model.person ? "Nome e foto" : "Outra pessoa",
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
      <nav
        aria-label="Primeiros passos"
        className="setup-navigation"
      >
        <UiButton
          aria-current={
            model.step !== SetupStep.importing &&
            model.step !== SetupStep.assistant
              ? "step"
              : undefined
          }
          onClick={people}
          type="button"
          variant="outline"
        >
          Pessoas
        </UiButton>
        <UiButton
          aria-current={model.step === SetupStep.importing ? "step" : undefined}
          disabled={!snapshot.connections.length || busy}
          onClick={importing}
          type="button"
          variant="outline"
        >
          Importar
        </UiButton>
        <UiButton
          aria-current={model.step === SetupStep.assistant ? "step" : undefined}
          disabled={!snapshot.connections.length || busy}
          onClick={assistant}
          type="button"
          variant="outline"
        >
          Consultar
        </UiButton>
      </nav>
      <WorkspaceHeading title={labels[model.step]}>
        {model.step === SetupStep.people && (
          <SetupActions
            help={help}
            model={model}
            props={props}
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
          {model.selectedId === "new" && (
            <p>Cada pessoa conecta a própria conta Meu Pluggy.</p>
          )}
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
            Configure o acesso de {model.person?.name}. Ele será reutilizado
            para os próximos bancos.
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
          props={props}
          settings={settings}
          showRevoke={showRevoke}
        />
      )}
      {model.step === SetupStep.importing && (
        <SetupImport
          busy={busy}
          command={props.command}
          complete={finishImport}
          readError={props.readError}
          refresh={props.refresh}
          snapshot={snapshot}
        />
      )}
      {model.step === SetupStep.assistant && (
        <AssistantSetup snapshot={snapshot} />
      )}
      {model.step === SetupStep.people && (
        <UiLink
          className="setup-defer"
          href={workspaceHref("/account/transactions")}
          variant="ghost"
        >
          Continuar depois
        </UiLink>
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
    <section
      aria-label="Conectar assistente"
      className="setup-form"
    >
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
      <UiLink
        href={workspaceHref("/account")}
        variant="primary"
      >
        Abrir meu painel
      </UiLink>
    </section>
  );
}

function PeopleBanks({
  props,
  model,
  help,
  settings,
  assign,
  showRevoke,
}: {
  props: DashboardProps;
  model: ReturnType<typeof usePeopleSetup>;
  help: boolean;
  settings: boolean;
  assign: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  showRevoke: () => void;
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

  return (
    <>
      <div className="setup-person-bar">
        <fieldset
          aria-label="Pessoas"
          className="setup-person-picker"
        >
          {snapshot.people.length === 1 && model.person ? (
            <PersonIdentity person={model.person} />
          ) : (
            snapshot.people.map((person) => (
              <UiButton
                aria-pressed={model.selectedId === person.id}
                key={person.id}
                onClick={model.selectPerson}
                type="button"
                value={person.id}
                variant={
                  model.selectedId === person.id ? "secondary" : "outline"
                }
              >
                <PersonIdentity
                  compact
                  person={person}
                />
              </UiButton>
            ))
          )}
        </fieldset>
        <UiIconButton
          disabled={busy || !model.person}
          label="Editar nome e foto"
          onClick={model.editPerson}
        >
          <PencilSimpleIcon size={20} />
        </UiIconButton>
      </div>
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
      <SetupBanks
        connections={model.connections}
        csrf={snapshot.csrf}
        institutions={props.institutions}
        manage={props.manage}
      />
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

function SetupActions({
  props,
  model,
  help,
  settings,
  toggleHelp,
  toggleSettings,
}: {
  props: DashboardProps;
  model: ReturnType<typeof usePeopleSetup>;
  help: boolean;
  settings: boolean;
  toggleHelp: () => void;
  toggleSettings: () => void;
}) {
  const { snapshot, busy } = props;
  return (
    <fieldset
      aria-label="Ações de pessoas e bancos"
      className="setup-actions"
    >
      <UiIconButton
        disabled={busy}
        label="Adicionar banco"
        onClick={model.addBank}
      >
        <PlusIcon size={20} />
      </UiIconButton>
      {!!snapshot.connections.length && (
        <UiIconButton
          disabled={busy}
          label="Adicionar outra pessoa"
          onClick={model.addPerson}
        >
          <UserPlusIcon size={20} />
        </UiIconButton>
      )}
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
      {!!snapshot.connections.length && (
        <UiIconButton
          disabled={busy}
          label="Concluir pessoas e importar"
          onClick={model.finishPeople}
          variant="primary"
        >
          <ArrowRightIcon size={20} />
        </UiIconButton>
      )}
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
