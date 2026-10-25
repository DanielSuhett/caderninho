import { Badge } from "@cloudflare/kumo/components/badge";
import { Banner } from "@cloudflare/kumo/components/banner";
import { ClipboardText } from "@cloudflare/kumo/components/clipboard-text";
import { Link } from "@cloudflare/kumo/components/link";
import { Select } from "@cloudflare/kumo/components/select";
import { type FormEvent, type MouseEvent, useCallback, useState } from "react";

import type { HouseholdCommand, PortalResponse } from "../../contracts";
import { UiButton } from "../ui";
import type { ManagementOutcome } from "./account-feedback";
import { BackofficeDialog } from "./backoffice-dialog";
import {
  type ConnectionActivity,
  ConnectionJourney,
  importFailureMessage,
} from "./connection-journey";
import { ConnectionWizard } from "./connection-wizard";
import { DisclosureItem } from "./disclosure-item";
import { HouseholdPanel } from "./household-view";
import { dayLabel } from "./workspace-resource";
import {
  RefreshButton,
  WorkspaceFilters,
  WorkspaceHeading,
} from "./workspace-ui";

const importLabels = {
  failed: "Precisa de atenção",
  pending: "Na fila",
  running: "Importando",
  succeeded: "Atualizada",
};
function timestamp(value: string | null) {
  if (value?.length === 10) {
    return dayLabel(value);
  }
  return value
    ? new Date(value).toLocaleString("pt-BR")
    : "Ainda não importada";
}
function DashboardMessage({
  message,
  readError,
  partial,
}: {
  message: string;
  readError: boolean;
  partial: boolean;
}) {
  const content =
    message ||
    (readError &&
      "Não foi possível atualizar o status. Os dados salvos continuam disponíveis.") ||
    (partial && (
      <>
        Histórico parcial.{" "}
        <Link href="/account/connections">Conferir conexões</Link>.
      </>
    ));
  if (!content) {
    return null;
  }
  return (
    <Banner
      className="feedback"
      description={content}
      role="status"
      variant={readError ? "error" : "secondary"}
    />
  );
}

export function DashboardView(props: {
  snapshot: PortalResponse;
  section: "overview" | "connections";
  busy: boolean;
  message: string;
  activity: ConnectionActivity | null;
  observedAt: string | null;
  readError: boolean;
  cancel: () => void;
  refresh: () => void;
  personId: string;
  connect: (profileId: string, id?: string) => void;
  command: (action: string, ids?: string[]) => void;
  manage: (input: HouseholdCommand) => Promise<ManagementOutcome>;
}) {
  const {
    snapshot,
    busy,
    personId,
    command,
    manage,
    connect: openConnection,
  } = props;
  const [revokeAll, setRevokeAll] = useState(false);
  const askRevokeAll = useCallback(() => setRevokeAll(true), []);
  const cancelRevokeAll = useCallback(() => setRevokeAll(false), []);
  const confirmRevokeAll = useCallback(() => {
    command("disconnect-assistants");
    setRevokeAll(false);
  }, [command]);
  const [managementOpen, setManagementOpen] = useState(
    props.section === "connections",
  );
  const [wizardOpen, setWizardOpen] = useState(!snapshot.configured);
  const startWizard = useCallback(() => setWizardOpen(true), []);
  const closeWizard = useCallback(() => setWizardOpen(false), []);
  const hasResult = snapshot.connections.some(
    (c) => c.hasTransactions || c.lastSuccessAt,
  );
  const visible = snapshot.connections.filter(
    (c) => !personId || c.personId === personId,
  );
  const readyProfiles = new Set(
    snapshot.profiles.filter((p) => p.enabled && p.configured).map((p) => p.id),
  );
  const importable = visible.filter((c) =>
    readyProfiles.has(c.profileId ?? "default"),
  );
  const assign = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const form = event.currentTarget;
      const { id } = form.dataset;
      if (!id) {
        return;
      }
      await manage({
        action: "assign_connection",
        connectionId: id,
        csrf: snapshot.csrf,
        personId: String(new FormData(form).get("personId")),
      });
    },
    [manage, snapshot.csrf],
  );

  const action = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      const { value } = event.currentTarget;
      command(
        value,
        value === "sync" ? importable.map((c) => c.id) : undefined,
      );
    },
    [command, importable],
  );
  const reconnect = useCallback(
    (event: MouseEvent<HTMLButtonElement>) =>
      openConnection(
        event.currentTarget.dataset.profile ?? "default",
        event.currentTarget.value,
      ),
    [openConnection],
  );
  return (
    <div className="finance-dashboard">
      <BackofficeDialog
        busy={busy}
        close={cancelRevokeAll}
        dirty={false}
        open={revokeAll}
        presentation="confirmation"
        primaryAction={{
          children: "Confirmar revogação",
          onClick: confirmRevokeAll,
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

      <WorkspaceHeading
        title={props.section === "overview" ? "Visão geral" : "Conexões"}
      >
        {props.section === "connections" && (
          <UiButton
            disabled={busy}
            onClick={startWizard}
            type="button"
            variant="primary"
          >
            Adicionar conexão
          </UiButton>
        )}
        <RefreshButton
          disabled={busy}
          label="Atualizar status da importação"
          onClick={props.refresh}
        />
      </WorkspaceHeading>
      {!!wizardOpen && (
        <ConnectionWizard
          activity={props.activity}
          busy={busy}
          cancel={props.cancel}
          close={closeWizard}
          connect={openConnection}
          manage={manage}
          message={props.message}
          personId={personId}
          snapshot={snapshot}
        />
      )}
      {!wizardOpen && (props.section === "connections" || !hasResult) && (
        <ConnectionJourney
          activity={props.activity}
          cancel={props.cancel}
          connect={openConnection}
          manage={startWizard}
          observedAt={props.observedAt}
          readError={props.readError}
          snapshot={snapshot}
        />
      )}
      {hasResult && (props.section === "overview" || managementOpen) && (
        <WorkspaceFilters
          action={
            props.section === "overview" ? "/account" : "/account/connections"
          }
          context={
            snapshot.people.find((p) => p.id === personId)?.name ??
            "Todas as pessoas"
          }
        >
          <Select
            className="w-full"
            defaultValue={personId}
            items={[
              { label: "Todas as pessoas", value: "" },
              ...snapshot.people.map((p) => ({ label: p.name, value: p.id })),
            ]}
            label="Pessoa"
            name="person"
          />
          <input
            name="space"
            type="hidden"
            value={
              new URLSearchParams(location.search).get("space") ?? "personal"
            }
          />
        </WorkspaceFilters>
      )}
      <DashboardMessage
        message={props.message}
        partial={props.section === "overview" && visible.some((c) => c.partial)}
        readError={props.section === "overview" && hasResult && props.readError}
      />
      {props.section === "connections" && (
        <>
          <DisclosureItem
            className="journey-management"
            onOpenChange={setManagementOpen}
            open={managementOpen}
            summary={<>Gerenciar conexões e perfis</>}
          >
            <section aria-labelledby="connections-heading">
              <div className="section-heading">
                <h2
                  id="connections-heading"
                  tabIndex={-1}
                >
                  Conexões e atualização
                </h2>
                <UiButton
                  disabled={busy || !importable.length}
                  onClick={action}
                  type="button"
                  value="sync"
                  variant="secondary"
                >
                  Importar esta visão
                </UiButton>
              </div>
              {importable.length < visible.length && (
                <Banner
                  className="feedback"
                  description={
                    <>
                      Perfis pausados ou sem credenciais ficam fora desta
                      importação. Seus dados continuam visíveis.
                    </>
                  }
                  variant="alert"
                />
              )}
              <div className="connection-list">
                {visible.map((c) => (
                  <article
                    className="connection-row"
                    key={c.id}
                  >
                    <div>
                      <Badge
                        variant={
                          (
                            {
                              failed: "error",
                              pending: "warning",
                              running: "info",
                              succeeded: "success",
                            } as const
                          )[c.importStatus ?? "pending"]
                        }
                      >
                        {c.importStatus
                          ? importLabels[c.importStatus]
                          : "Não importada"}
                      </Badge>
                      <h3>
                        {c.personName}{" "}
                        <span className="muted">/ {c.profileName}</span>
                      </h3>
                      <p>
                        {Object.values(c.accounts)
                          .map((a) => a.name)
                          .join(" · ") ||
                          "Conexão aguardando primeira importação"}
                      </p>
                      <p className="muted">
                        Última importação: {timestamp(c.lastSuccessAt)}
                        <br />
                        Nova importação a partir de:{" "}
                        {c.nextEligibleAt
                          ? timestamp(c.nextEligibleAt)
                          : "Disponível agora"}
                      </p>
                      {!!c.importError && (
                        <Banner
                          className="feedback"
                          description={
                            <>
                              {importFailureMessage(c.importError)}
                              <br />
                              Código: {c.importError}.
                            </>
                          }
                          variant="error"
                        />
                      )}
                    </div>
                    <div className="connection-actions">
                      <UiButton
                        data-profile={c.profileId ?? "default"}
                        disabled={
                          busy || !readyProfiles.has(c.profileId ?? "default")
                        }
                        onClick={reconnect}
                        type="button"
                        value={c.id}
                        variant="secondary"
                      >
                        Reautorizar conexão
                      </UiButton>
                      <DisclosureItem summary={<>Alterar titular</>}>
                        <form
                          data-id={c.id}
                          onSubmit={assign}
                        >
                          <Select
                            className="w-full"
                            defaultValue={c.personId ?? "self"}
                            id={`owner-${c.id}`}
                            items={[
                              ...snapshot.people.map((p) => ({
                                label: p.name,
                                value: p.id,
                              })),
                            ]}
                            label="Pessoa desta conexão"
                            name="personId"
                          />
                          <p className="muted">
                            Reatribui o histórico desta conexão. Não altera o
                            titular na instituição nem as credenciais.
                          </p>
                          <UiButton
                            disabled={busy}
                            type="submit"
                          >
                            Salvar titular
                          </UiButton>
                        </form>
                      </DisclosureItem>
                    </div>
                  </article>
                ))}
              </div>
            </section>
            <DisclosureItem summary={<>Editar titulares e credenciais</>}>
              <HouseholdPanel
                busy={busy}
                manage={props.manage}
                snapshot={snapshot}
              />
            </DisclosureItem>
          </DisclosureItem>
          <DisclosureItem
            className="journey-assistants"
            summary={<>Conectar meu assistente MCP</>}
          >
            <p>
              Autorizar um assistente dá acesso aos dados de toda a instalação.
            </p>
            <ClipboardText
              className="mcp-address"
              labels={{ copyAction: "Copiar URL MCP" }}
              text={`${snapshot.origin}/mcp`}
              tooltip={{
                copiedText: "URL MCP copiada.",
                text: "Copiar URL MCP",
              }}
            />
            <p className="muted">
              Se a cópia não estiver disponível, selecione a URL acima.
            </p>
            <DisclosureItem summary={<>Gerenciar acesso dos assistentes</>}>
              <p>
                A revogação exige uma nova autorização. Contas e histórico
                permanecem salvos.
              </p>
              <UiButton
                disabled={busy}
                onClick={askRevokeAll}
                tone="danger"
                type="button"
                value="disconnect-assistants"
                variant="secondary"
              >
                Revogar todos os assistentes
              </UiButton>
            </DisclosureItem>
          </DisclosureItem>
        </>
      )}
      {props.section === "overview" && !hasResult && (
        <p>
          <Link href="/account/connections">
            Gerenciar pessoas e perfis Pluggy
          </Link>
        </p>
      )}
    </div>
  );
}
