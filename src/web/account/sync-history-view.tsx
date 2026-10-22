import { useCallback, useState } from "react";

import type { PortalResponse } from "../../contracts";
import { UiButton } from "../ui";
import type { createAccountApi } from "./account-api";
import { EmptyView, FilterActions } from "./workspace-filters";
import {
  momentLabel,
  ResourceFeedback,
  useResource,
} from "./workspace-resource";

const statuses = {
  failed: "Falhou",
  pending: "Na fila",
  running: "Em andamento",
  succeeded: "Concluída",
};
const phases: Record<string, string> = {
  accounts: "Contas",
  bills: "Faturas",
  finish: "Conferência final",
  investments: "Investimentos",
  loans: "Empréstimos",
  transactions: "Transações",
};
export function SyncHistoryView({
  api,
  snapshot,
}: {
  api: ReturnType<typeof createAccountApi>;
  snapshot: PortalResponse;
}) {
  const [params] = useState(() => new URLSearchParams(location.search));
  const load = useCallback(
    (signal: AbortSignal) => {
      const query = new URLSearchParams({ limit: "25" });
      for (const key of ["cursor", "status"]) {
        const value = params.get(key);
        if (value) {
          query.set(key, value);
        }
      }
      if (params.get("person")) {
        query.set("personId", params.get("person") ?? "");
      }
      return api.history(query, signal);
    },
    [api, params],
  );
  const resource = useResource(load);
  const { data } = resource;
  const next = new URLSearchParams(params);
  if (data?.cursor) {
    next.set("cursor", data.cursor);
  }
  const first = new URLSearchParams(params);
  first.delete("cursor");
  return (
    <>
      <header className="workspace-heading">
        <p className="eyebrow">Da origem até o Caderninho</p>
        <h1>Sincronizações</h1>
        <p>
          Acompanhe cada rodada, suas etapas confirmadas e eventuais falhas. O
          titular mostrado é o registrado no início da rodada.
        </p>
      </header>
      <form
        action="/account/sync"
        className="workspace-filters"
        method="get"
      >
        <label>
          Pessoa
          <select
            defaultValue={params.get("person") ?? ""}
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
          value={params.get("space") ?? "personal"}
        />
        <label>
          Estado
          <select
            defaultValue={params.get("status") ?? ""}
            name="status"
          >
            <option value="">Todas as rodadas</option>
            {Object.entries(statuses).map(([id, name]) => (
              <option
                key={id}
                value={id}
              >
                {name}
              </option>
            ))}
          </select>
        </label>
        <FilterActions />
      </form>
      <div className="results-heading">
        <h2>Rodadas registradas</h2>
        <UiButton
          disabled={resource.loading}
          onClick={resource.retry}
          type="button"
          variant="secondary"
        >
          Atualizar histórico
        </UiButton>
      </div>
      <p className="muted">
        Histórico disponível a partir desta versão. A última rodada de cada
        conexão anterior foi recuperada quando existia; rodadas mais antigas não
        podem ser reconstruídas. Sincronizações abrangem a conexão inteira,
        independentemente do grupo.
      </p>
      <ResourceFeedback {...resource} />
      {!!data && (
        <>
          {data.records.length ? (
            <ol className="run-list">
              {data.records.map((r) => (
                <li
                  className="run-row"
                  key={r.id}
                >
                  <div className="run-top">
                    <div>
                      <h3>{r.profileName}</h3>
                      <p>
                        {r.personName} · início {momentLabel(r.admittedAt)}
                      </p>
                    </div>
                    <span className={`status-label run-${r.status}`}>
                      {statuses[r.status]}
                    </span>
                  </div>
                  <dl className="detail-list">
                    <div>
                      <dt>Última etapa</dt>
                      <dd>
                        {r.phase
                          ? (phases[r.phase] ?? r.phase)
                          : "Não registrada"}
                      </dd>
                    </div>
                    <div>
                      <dt>Etapas confirmadas</dt>
                      <dd>{r.sequence}</dd>
                    </div>
                    <div>
                      <dt>Encerramento</dt>
                      <dd>{finishLabel(r.finishedAt, r.status)}</dd>
                    </div>
                  </dl>
                  {!!r.error && (
                    <p className="notice">
                      Interrompida: <code>{r.error}</code>. As páginas
                      confirmadas foram preservadas. Confira as credenciais e a
                      autorização na página Conexões.
                    </p>
                  )}
                  {!!r.legacy && (
                    <p className="muted">
                      Registro recuperado da versão anterior; algumas
                      informações podem não estar disponíveis.
                    </p>
                  )}
                  <details className="row-details">
                    <summary>Identificadores da rodada</summary>
                    <p>
                      Rodada: <code>{r.id}</code>
                    </p>
                    <p>
                      Conexão: <code>{r.connectionId}</code>
                    </p>
                  </details>
                </li>
              ))}
            </ol>
          ) : (
            <EmptyView title="Nenhuma rodada neste recorte">
              As novas importações aparecerão aqui. Abra Conexões para solicitar
              uma importação.
            </EmptyView>
          )}
          <div className="pagination">
            <span>{data.records.length} rodadas nesta página</span>
            {params.has("cursor") && (
              <a href={`/account/sync?${first}`}>Voltar às mais recentes</a>
            )}
            {!!data.cursor && (
              <a
                className="page-next"
                href={`/account/sync?${next}`}
              >
                Ver rodadas anteriores
              </a>
            )}
          </div>
        </>
      )}
    </>
  );
}

function finishLabel(finishedAt: string | null, status: string) {
  if (finishedAt) {
    return momentLabel(finishedAt);
  }
  return status === "pending" || status === "running"
    ? "Ainda em andamento"
    : "Horário não disponível";
}
