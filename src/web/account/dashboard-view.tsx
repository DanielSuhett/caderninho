import { type FormEvent, type MouseEvent, useCallback } from "react";

import type { HouseholdCommand, PortalResponse } from "../../contracts";
import { UiButton } from "../ui";
import { BankMark } from "./bank-mark";
import { HouseholdPanel } from "./household-view";
import {
  FilterDrawer,
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
export function DashboardView(props: {
  snapshot: PortalResponse;
  section: "overview" | "connections";
  busy: boolean;
  message: string;
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
  const visible = snapshot.connections.filter(
    (c) => !personId || c.personId === personId,
  );
  const accounts = visible.flatMap((c) =>
    Object.entries(c.accounts).map(([id, a]) => ({
      ...a,
      id,
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
        description={
          props.section === "overview"
            ? "Contas e cartões, com titular e origem identificados."
            : "Pessoas, perfis Pluggy e acesso aos bancos."
        }
        title={props.section === "overview" ? "Visão geral" : "Conexões"}
      />
      <FilterDrawer
        action={
          props.section === "overview" ? "/account" : "/account/connections"
        }
        summary={[
          `Pessoa: ${snapshot.people.find((p) => p.id === personId)?.name ?? "Todas"}`,
        ]}
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
      <p
        aria-live="polite"
        className="dashboard-message"
        role="status"
      >
        {props.message ||
          (visible.some((c) => c.partial)
            ? "Há conexões com dados parciais. Confira a situação abaixo antes de analisar totais."
            : "")}
      </p>
      {props.section === "overview" && (
        <>
          <WorkspaceMetrics
            items={[
              {
                label: "Pessoas nesta visão",
                value: personId ? 1 : snapshot.people.length,
              },
              { label: "Conexões bancárias", value: visible.length },
              { label: "Contas e cartões importados", value: accounts.length },
            ]}
          />

          <section aria-labelledby="accounts-heading">
            <div className="section-heading">
              <h2 id="accounts-heading">Contas e cartões</h2>
              <a href="/account/connections">Gerenciar pessoas e perfis</a>
            </div>
            {!accounts.length && (
              <div className="empty-state">
                <h3>Suas contas aparecem aqui após a importação.</h3>
                <p>
                  Adicione um perfil Pluggy, conecte uma instituição e importe
                  os dados.
                </p>
              </div>
            )}
            <div className="account-grid">
              {accounts.map((a) => (
                <article
                  className="bank-account"
                  key={a.id}
                >
                  <div className="account-owner">
                    <strong>{a.personName}</strong>
                    <span>{a.type === "CREDIT" ? "Cartão" : "Conta"}</span>
                  </div>
                  <h3 className="bank-heading">
                    <BankMark />
                    {a.name}
                  </h3>
                  <p className="account-balance">
                    {formatBalance(a.balanceMinor, a.currency)}
                  </p>
                  <p className="muted">
                    {a.type === "CREDIT"
                      ? "Saldo do cartão · não é dinheiro disponível"
                      : "Saldo informado pela instituição"}
                  </p>
                  <footer>
                    {a.profileName}
                    <br />
                    <time>{timestamp(a.balanceObservedAt)}</time>
                  </footer>
                </article>
              ))}
            </div>
          </section>
        </>
      )}
      {props.section === "connections" && (
        <>
          <section aria-labelledby="connections-heading">
            <div className="section-heading">
              <h2 id="connections-heading">Conexões e atualização</h2>
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
                Perfis pausados ou sem credenciais ficam fora desta importação.
                Seus dados continuam visíveis.
              </p>
            )}
            <form
              className="connect-form"
              onSubmit={connect}
            >
              <label htmlFor="connect-profile">Conectar usando o perfil</label>
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
                        A importação foi interrompida ({c.importError}). Confira
                        o perfil e a autorização no Meu Pluggy. Os dados já
                        importados foram preservados.
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
          <section aria-labelledby="assistant-heading">
            <h2 id="assistant-heading">Assistentes com a mesma visão</h2>
            <p>
              Use a URL abaixo no ChatGPT ou Claude. Peça consultas por pessoa
              ou uma visão conjunta. Quem autorizar o assistente dará acesso aos
              dados de toda a instalação.
            </p>
            <code className="mcp-address">{snapshot.origin}/mcp</code>
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
          </section>
        </>
      )}
    </div>
  );
}
