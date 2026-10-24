import {
  type FormEvent,
  type MouseEvent,
  type SyntheticEvent,
  useCallback,
  useState,
} from "react";

import type { HouseholdCommand, PortalResponse } from "../../contracts";
import { tryCatch } from "../../shared";
import { UiButton } from "../ui";
import { BankMark } from "./bank-mark";
import {
  type ConnectionActivity,
  ConnectionJourney,
  importFailureMessage,
} from "./connection-journey";
import { DisclosureItem } from "./disclosure-item";
import { HouseholdPanel } from "./household-view";
import { dayLabel } from "./workspace-resource";
import {
  FilterDrawer,
  RecordReference,
  RefreshButton,
  WorkspaceDetails,
  WorkspaceHeading,
  WorkspaceMetrics,
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
export function formatBalance(value: string | null, currency: string) {
  if (value === null) {
    return "Saldo indisponível";
  }
  const scale =
    new Intl.NumberFormat("pt-BR", {
      currency,
      style: "currency",
    }).resolvedOptions().maximumFractionDigits ?? 0;
  const negative = value.startsWith("-");
  const digits = value.replace("-", "").padStart(scale + 1, "0");
  const whole = scale ? digits.slice(0, -scale) : digits;
  const fraction = scale ? `,${digits.slice(-scale)}` : "";
  return `${negative ? "−" : ""}${BigInt(whole).toLocaleString("pt-BR")}${fraction} ${currency}`;
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
  return (
    <p
      aria-live="polite"
      className="dashboard-message"
      role="status"
    >
      {message ||
        (readError &&
          "Não foi possível atualizar o status. Os dados salvos continuam disponíveis.") ||
        (partial ? (
          <>
            Histórico parcial.{" "}
            <a href="/account/connections">Conferir conexões</a>.
          </>
        ) : null)}
    </p>
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
  manage: (input: HouseholdCommand) => void;
}) {
  const {
    snapshot,
    busy,
    personId,
    command,
    manage,
    connect: openConnection,
  } = props;
  const [managementOpen, setManagementOpen] = useState(!snapshot.configured);
  const [copyMessage, setCopyMessage] = useState("");
  const hasResult = snapshot.connections.some(
    (c) => c.hasTransactions || c.lastSuccessAt,
  );
  const openManagement = useCallback(() => {
    if (props.section === "overview") {
      location.assign("/account/connections");
      return;
    }
    setManagementOpen(true);
    requestAnimationFrame(() =>
      document
        .getElementById(
          snapshot.configured ? "connections-heading" : "household-heading",
        )
        ?.focus(),
    );
  }, [snapshot.configured, props.section]);
  const toggleManagement = useCallback(
    (event: SyntheticEvent<HTMLDetailsElement>) =>
      setManagementOpen(event.currentTarget.open),
    [],
  );
  const copyMcp = useCallback(async () => {
    const { data: _data, error } = await tryCatch(() =>
      navigator.clipboard.writeText(`${snapshot.origin}/mcp`),
    );
    setCopyMessage(
      error
        ? "Não foi possível copiar. Selecione a URL abaixo."
        : "URL MCP copiada.",
    );
  }, [snapshot.origin]);
  const onCopyMcp = useCallback(() => {
    copyMcp().then(
      () => undefined,
      () => undefined,
    );
  }, [copyMcp]);
  const visible = snapshot.connections.filter(
    (c) => !personId || c.personId === personId,
  );
  const accounts = visible.flatMap((c) =>
    Object.entries(c.accounts).map(([id, a]) => ({
      ...a,
      id,
      partial: c.partial,
      personName: c.personName ?? "Eu",
      profileName: c.profileName ?? "Pluggy principal",
    })),
  );
  const readyProfiles = new Set(
    snapshot.profiles.filter((p) => p.enabled && p.configured).map((p) => p.id),
  );
  const enabled = snapshot.profiles.filter(
    (p) => readyProfiles.has(p.id) && (!personId || p.personId === personId),
  );
  const importable = visible.filter((c) =>
    readyProfiles.has(c.profileId ?? "default"),
  );
  const connect = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      openConnection(
        String(new FormData(event.currentTarget).get("profileId")),
      );
    },
    [openConnection],
  );
  const assign = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const form = event.currentTarget;
      const { id } = form.dataset;
      if (!id) {
        return;
      }
      manage({
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
      <WorkspaceHeading
        title={props.section === "overview" ? "Visão geral" : "Conexões"}
      >
        <RefreshButton
          disabled={busy}
          label="Atualizar status da importação"
          onClick={props.refresh}
        />
      </WorkspaceHeading>
      {(props.section === "connections" || !hasResult) && (
        <ConnectionJourney
          activity={props.activity}
          cancel={props.cancel}
          connect={openConnection}
          manage={openManagement}
          observedAt={props.observedAt}
          readError={props.readError}
          snapshot={snapshot}
        />
      )}
      {hasResult && (props.section === "overview" || managementOpen) && (
        <FilterDrawer
          action={
            props.section === "overview" ? "/account" : "/account/connections"
          }
          context={
            snapshot.people.find((p) => p.id === personId)?.name ??
            "Todas as pessoas"
          }
        >
          <label>
            Pessoa
            <select
              defaultValue={personId}
              name="person"
            >
              <option value="">Todas as pessoas</option>
              {snapshot.people.map((p) => (
                <option
                  key={p.id}
                  value={p.id}
                >
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <input
            name="space"
            type="hidden"
            value={
              new URLSearchParams(location.search).get("space") ?? "personal"
            }
          />
        </FilterDrawer>
      )}
      <DashboardMessage
        message={props.message}
        partial={props.section === "overview" && visible.some((c) => c.partial)}
        readError={props.section === "overview" && hasResult && props.readError}
      />
      {props.section === "overview" && hasResult && (
        <>
          <section
            aria-labelledby="accounts-heading"
            className="account-section"
          >
            <h2
              className="sr-only"
              id="accounts-heading"
            >
              Contas e cartões
            </h2>
            {!accounts.length && (
              <div className="empty-state">
                <h3>Suas contas aparecem aqui após a importação.</h3>
                <p>
                  Adicione um perfil Pluggy, conecte uma instituição e importe
                  os dados.
                </p>
              </div>
            )}
            <ul
              aria-label="Contas e cartões"
              className="record-list"
            >
              {accounts.map((a) => (
                <li key={a.id}>
                  <DisclosureItem
                    className={
                      formatBalance(a.balanceMinor, a.currency).length > 18 ||
                      a.balanceMinor === null
                        ? "record-item wide-value"
                        : "record-item"
                    }
                    summary={
                      <>
                        <span className="record-title bank-heading">
                          <BankMark />
                          {a.name}
                        </span>
                        <span className="record-value">
                          {formatBalance(a.balanceMinor, a.currency)}
                        </span>
                        {!personId && snapshot.people.length > 1 && (
                          <span className="record-context">{a.personName}</span>
                        )}
                        <span className="record-meta">
                          {a.type === "CREDIT" && (
                            <span>Cartão · não é dinheiro disponível</span>
                          )}
                          <span>
                            {a.balanceObservedAt
                              ? `Saldo em ${dayLabel(a.balanceObservedAt)}`
                              : "Saldo ainda não observado"}
                          </span>
                          {!!a.partial && (
                            <span data-tone="warning">Dados parciais</span>
                          )}
                        </span>
                      </>
                    }
                  >
                    <div className="record-detail">
                      <dl className="detail-list">
                        <div>
                          <dt>Titular</dt>
                          <dd>{a.personName}</dd>
                        </div>
                        <div>
                          <dt>Perfil Pluggy</dt>
                          <dd>{a.profileName}</dd>
                        </div>
                        <div>
                          <dt>Saldo observado em</dt>
                          <dd>{timestamp(a.balanceObservedAt)}</dd>
                        </div>
                      </dl>
                      <a
                        href={`/account/transactions?${new URLSearchParams({ accountId: a.id, ...(personId && { person: personId }), space: new URLSearchParams(location.search).get("space") ?? "personal" })}`}
                      >
                        Ver transações desta conta
                      </a>
                      <RecordReference>
                        <div>
                          <dt>Identificador da conta</dt>
                          <dd>
                            <code>{a.id}</code>
                          </dd>
                        </div>
                      </RecordReference>
                    </div>
                  </DisclosureItem>
                </li>
              ))}
            </ul>
          </section>
          <WorkspaceDetails title="Resumo da instalação">
            <WorkspaceMetrics
              items={[
                {
                  label: "Pessoas nesta visão",
                  value: personId ? 1 : snapshot.people.length,
                },
                { label: "Conexões bancárias", value: visible.length },
                {
                  label: "Contas e cartões importados",
                  value: accounts.length,
                },
              ]}
            />
          </WorkspaceDetails>
        </>
      )}
      {props.section === "connections" && (
        <>
          <details
            className="journey-management"
            onToggle={toggleManagement}
            open={managementOpen}
          >
            <summary>Gerenciar conexões e perfis</summary>
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
                <p
                  className="notice"
                  data-tone="warning"
                >
                  Perfis pausados ou sem credenciais ficam fora desta
                  importação. Seus dados continuam visíveis.
                </p>
              )}
              <form
                className="connect-form"
                onSubmit={connect}
              >
                <label htmlFor="connect-profile">
                  Conectar usando o perfil
                </label>
                <div className="inline-fields">
                  <select
                    disabled={!enabled.length}
                    id="connect-profile"
                    name="profileId"
                  >
                    {enabled.map((p) => (
                      <option
                        key={p.id}
                        value={p.id}
                      >
                        {p.name} ·{" "}
                        {
                          snapshot.people.find(
                            (person) => person.id === p.personId,
                          )?.name
                        }
                      </option>
                    ))}
                  </select>
                  <UiButton
                    disabled={busy || !enabled.length}
                    type="submit"
                  >
                    Conectar Meu Pluggy
                  </UiButton>
                </div>
              </form>
              {!enabled.length && (
                <p
                  className="notice"
                  data-tone="warning"
                >
                  Adicione ou ative um perfil em “Pessoas e perfis Pluggy” para
                  conectar.
                </p>
              )}
              <div className="connection-list">
                {visible.map((c) => (
                  <article
                    className="connection-row"
                    key={c.id}
                  >
                    <div>
                      <span
                        className={`sync-state sync-${c.importStatus ?? "pending"}`}
                      >
                        {c.importStatus
                          ? importLabels[c.importStatus]
                          : "Não importada"}
                      </span>
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
                        <p
                          className="notice"
                          data-tone="error"
                        >
                          {importFailureMessage(c.importError)}
                          <br />
                          Código: {c.importError}.
                        </p>
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
                      <details>
                        <summary>Alterar titular</summary>
                        <form
                          data-id={c.id}
                          onSubmit={assign}
                        >
                          <label htmlFor={`owner-${c.id}`}>
                            Pessoa desta conexão
                          </label>
                          <select
                            defaultValue={c.personId ?? "self"}
                            id={`owner-${c.id}`}
                            name="personId"
                          >
                            {snapshot.people.map((p) => (
                              <option
                                key={p.id}
                                value={p.id}
                              >
                                {p.name}
                              </option>
                            ))}
                          </select>
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
                      </details>
                    </div>
                  </article>
                ))}
              </div>
            </section>
            <HouseholdPanel
              busy={busy}
              manage={props.manage}
              snapshot={snapshot}
            />
          </details>
          <details className="journey-assistants">
            <summary>Conectar meu assistente MCP</summary>
            <p>
              Autorizar um assistente dá acesso aos dados de toda a instalação.
            </p>
            <code className="mcp-address">{snapshot.origin}/mcp</code>
            <UiButton
              onClick={onCopyMcp}
              type="button"
              variant="secondary"
            >
              Copiar URL MCP
            </UiButton>
            <p role="status">{copyMessage}</p>
            <details>
              <summary>Gerenciar acesso dos assistentes</summary>
              <p>
                A revogação exige uma nova autorização. Contas e histórico
                permanecem salvos.
              </p>
              <UiButton
                disabled={busy}
                onClick={action}
                tone="danger"
                type="button"
                value="disconnect-assistants"
                variant="secondary"
              >
                Revogar todos os assistentes
              </UiButton>
            </details>
          </details>
        </>
      )}
      {props.section === "overview" && !hasResult && (
        <p>
          <a href="/account/connections">Gerenciar pessoas e perfis Pluggy</a>
        </p>
      )}
    </div>
  );
}
