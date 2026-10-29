import { Banner } from "@cloudflare/kumo/components/banner";
import { ClipboardText } from "@cloudflare/kumo/components/clipboard-text";
import { Dialog } from "@cloudflare/kumo/components/dialog";
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
import { WorkspaceDialog } from "./workspace-dialog";
import { WorkspaceHeading } from "./workspace-ui";

export interface DashboardProps {
  activity: ConnectionActivity | null;
  busy: boolean;
  cancel: () => void;
  command: (action: string, ids?: string[]) => void;
  connect: (profileId: string, id?: string) => void;
  history: ReturnType<typeof createAccountApi>["history"];
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
  const openHelp = useCallback(() => setHelp(true), []);
  const openSettings = useCallback(() => setSettings(true), []);
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
        {model.step === SetupStep.people && <PageTools openHelp={openHelp} />}
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
          onHelpChange={setHelp}
          onSettingsChange={setSettings}
          openBank={openBank}
          openPerson={openPerson}
          openSettings={openSettings}
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
  onHelpChange,
  onSettingsChange,
  openSettings,
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
  onHelpChange: (open: boolean) => void;
  onSettingsChange: (open: boolean) => void;
  openSettings: () => void;
  assign: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  showRevoke: () => void;
  openBank: () => void;
  openPerson: () => void;
  resume: () => void;
}) {
  const { snapshot, busy } = props;
  const reconnect = useCallback(
    (event: MouseEvent<HTMLElement>) =>
      props.connect(
        event.currentTarget.dataset.profile ?? "default",
        event.currentTarget.dataset.connection,
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
      <Dialog.Root
        onOpenChange={onHelpChange}
        open={help}
      >
        <WorkspaceDialog title="Como conectar bancos">
          <ol className="connection-help">
            <li>
              Crie ou acesse sua conta no{" "}
              <a
                href="https://meu.pluggy.ai/"
                rel="noreferrer"
                target="_blank"
              >
                Meu Pluggy
              </a>
              .
            </li>
            <li>Use Adicionar banco e autorize um banco por vez.</li>
            <li>Outra pessoa precisa da própria conta Meu Pluggy.</li>
            <li>Abra um banco na lista para ver as sincronizações dele.</li>
          </ol>
        </WorkspaceDialog>
      </Dialog.Root>
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
              <UiIconButton
                aria-haspopup="dialog"
                label={`Ajustes de ${holder.name}`}
                onClick={openSettings}
              >
                <GearIcon size={20} />
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
            history={props.history}
            institutions={props.institutions}
            manage={props.manage}
            reconnect={reconnect}
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
      <Dialog.Root
        onOpenChange={onSettingsChange}
        open={settings}
      >
        <WorkspaceDialog
          size="xl"
          title={holder ? `Ajustes de ${holder.name}` : "Ajustes avançados"}
        >
          <div className="setup-settings">
            <section
              aria-labelledby="settings-access"
              className="settings-section"
            >
              <h3 id="settings-access">Acesso Meu Pluggy</h3>
              <HouseholdPanel
                busy={busy}
                manage={props.manage}
                personId={holder?.id ?? ""}
                snapshot={snapshot}
              />
            </section>
            <section
              aria-labelledby="settings-holders"
              className="settings-section"
            >
              <h3 id="settings-holders">Bancos</h3>
              {!model.connections.length && (
                <p className="ledger-muted">Nenhum banco conectado.</p>
              )}
              {model.connections.map((connection) => (
                <DisclosureItem
                  key={connection.id}
                  summary={
                    <AccountIdentity account={bankAppearance(connection)} />
                  }
                >
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
                    <UiButton
                      disabled={busy}
                      type="submit"
                    >
                      Salvar titular
                    </UiButton>
                  </form>
                </DisclosureItem>
              ))}
            </section>
            <section
              aria-labelledby="settings-assistants"
              className="settings-section"
            >
              <h3 id="settings-assistants">Assistentes</h3>
              <div className="settings-row">
                <span className="ledger-muted">
                  Remove o acesso do ChatGPT, do Claude e de outros clientes.
                </span>
                <UiButton
                  disabled={busy}
                  onClick={showRevoke}
                  tone="danger"
                  type="button"
                >
                  Revogar todos
                </UiButton>
              </div>
            </section>
          </div>
        </WorkspaceDialog>
      </Dialog.Root>
    </>
  );
}

function PageTools({ openHelp }: { openHelp: () => void }) {
  return (
    <fieldset
      aria-label="Ajuda"
      className="setup-actions"
    >
      <UiIconButton
        aria-haspopup="dialog"
        label="Como conectar bancos"
        onClick={openHelp}
      >
        <QuestionIcon size={20} />
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
