import { useCallback, useState } from "react";

import type { PortalResponse } from "../../contracts";
import type { createAccountApi } from "./account-api";
import { DisclosureItem } from "./disclosure-item";
import { EmptyView } from "./workspace-filters";
import {
  momentLabel,
  ResourceFeedback,
  useResource,
} from "./workspace-resource";
import {
  FilterDrawer,
  RecordReference,
  RefreshButton,
  WorkspaceDetails,
  WorkspaceHeading,
} from "./workspace-ui";

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
    (signal: AbortSignal, fresh = false) => {
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
      return api.history(query, signal, fresh);
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
      <WorkspaceHeading title="Sincronizações">
        <RefreshButton
          disabled={resource.loading}
          label="Atualizar histórico"
          onClick={resource.retry}
        />
      </WorkspaceHeading>
      <FilterDrawer
        action="/account/sync"
        activeCount={params.get("status") ? 1 : 0}
        context={
          snapshot.people.find((p) => p.id === params.get("person"))?.name ??
          "Todas as pessoas"
        }
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
      </FilterDrawer>
      <ResourceFeedback {...resource} />
      {!!data && (
        <>
          {data.records.length ? (
            <ol
              aria-label="Rodadas de sincronização"
              className="record-list"
            >
              {data.records.map((r) => (
                <li key={r.id}>
                  <DisclosureItem
                    className="record-item"
                    summary={
                      <>
                        <span className="record-title">{r.profileName}</span>
                        <span className="record-value">
                          <span className={`status-label run-${r.status}`}>
                            {statuses[r.status]}
                          </span>
                        </span>
                        <span className="record-context">{r.personName}</span>
                        <span className="record-meta">
                          <time dateTime={r.admittedAt}>
                            Início {momentLabel(r.admittedAt)}
                          </time>
                          {r.status === "running" && (
                            <span>
                              {r.phase
                                ? (phases[r.phase] ?? r.phase)
                                : "Aguardando início"}
                            </span>
                          )}
                          {!!r.error && (
                            <span data-tone="error">Dados preservados</span>
                          )}
                        </span>
                      </>
                    }
                  >
                    <div className="record-detail">
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
                        <p
                          className="notice"
                          data-tone="error"
                        >
                          Interrompida: <code>{r.error}</code>. As páginas
                          confirmadas foram preservadas. Consulte o estado da
                          conexão antes de tentar uma nova importação.
                        </p>
                      )}
                      {!!r.legacy && (
                        <p className="muted">
                          Registro recuperado da versão anterior; algumas
                          informações podem não estar disponíveis.
                        </p>
                      )}
                      <a href="/account/connections">
                        Ver conexões e atualização
                      </a>
                      <RecordReference>
                        <div>
                          <dt>Rodada</dt>
                          <dd>
                            <code>{r.id}</code>
                          </dd>
                        </div>
                        <div>
                          <dt>Conexão</dt>
                          <dd>
                            <code>{r.connectionId}</code>
                          </dd>
                        </div>
                      </RecordReference>
                    </div>
                  </DisclosureItem>
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
          <WorkspaceDetails title="Sobre este histórico">
            {" "}
            <p className="muted">
              Histórico disponível a partir desta versão. A última rodada de
              cada conexão anterior foi recuperada quando existia; rodadas mais
              antigas não podem ser reconstruídas. Sincronizações abrangem a
              conexão inteira, independentemente do grupo.
            </p>
          </WorkspaceDetails>
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
