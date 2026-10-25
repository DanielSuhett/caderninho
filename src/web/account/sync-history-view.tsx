import { Badge } from "@cloudflare/kumo/components/badge";
import { Banner } from "@cloudflare/kumo/components/banner";
import { InlineCopyText } from "@cloudflare/kumo/components/inline-copy-text";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Link } from "@cloudflare/kumo/components/link";
import { Select } from "@cloudflare/kumo/components/select";
import { useCallback, useState } from "react";

import type { PortalResponse } from "../../contracts";
import type { createAccountApi } from "./account-api";
import { CursorPagination } from "./cursor-pagination";
import { DisclosureItem } from "./disclosure-item";
import { EmptyView } from "./workspace-filters";
import {
  momentLabel,
  ResourceFeedback,
  useResource,
} from "./workspace-resource";
import {
  RecordReference,
  RefreshButton,
  WorkspaceDetails,
  WorkspaceFilters,
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
      for (const key of ["cursor", "status", "connectionId"]) {
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
      <WorkspaceFilters
        action="/account/sync"
        activeCount={params.get("status") ? 1 : 0}
        context={
          snapshot.people.find((p) => p.id === params.get("person"))?.name ??
          "Todas as pessoas"
        }
      >
        {!!params.get("connectionId") && (
          <input
            name="connectionId"
            type="hidden"
            value={params.get("connectionId") ?? ""}
          />
        )}
        <Select
          defaultValue={params.get("person") ?? ""}
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
          value={params.get("space") ?? "personal"}
        />
        <Select
          defaultValue={params.get("status") ?? ""}
          items={[
            { label: "Todas as rodadas", value: "" },
            ...Object.entries(statuses).map(([id, name]) => ({
              label: name,
              value: id,
            })),
          ]}
          label="Estado"
          name="status"
        />
      </WorkspaceFilters>
      <ResourceFeedback {...resource} />
      {!!data && (
        <>
          {data.records.length ? (
            <LayerCard
              aria-label="Rodadas de sincronização"
              className="record-list"
              render={<ol />}
            >
              {data.records.map((r) => (
                <li key={r.id}>
                  <DisclosureItem
                    className="record-item"
                    summary={
                      <>
                        <span className="record-title">{r.profileName}</span>
                        <span className="record-value">
                          <Badge
                            variant={
                              (
                                {
                                  failed: "error",
                                  pending: "warning",
                                  running: "info",
                                  succeeded: "success",
                                } as const
                              )[r.status]
                            }
                          >
                            {statuses[r.status]}
                          </Badge>
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
                        <Banner
                          className="feedback"
                          description={
                            <>
                              Interrompida: <code>{r.error}</code>. As páginas
                              confirmadas foram preservadas. Consulte o estado
                              da conexão antes de tentar uma nova importação.
                            </>
                          }
                          variant="error"
                        />
                      )}
                      <Link href="/account/connections">
                        Ver conexões e atualização
                      </Link>
                      <RecordReference>
                        <div>
                          <dt>Rodada</dt>
                          <dd>
                            <InlineCopyText
                              labels={{
                                copied: "Identificador copiado",
                                copyAction: "Copiar identificador",
                              }}
                            >
                              {r.id}
                            </InlineCopyText>
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
            </LayerCard>
          ) : (
            <EmptyView title="Nenhuma rodada neste recorte">
              As novas importações aparecerão aqui. Abra Conexões para solicitar
              uma importação.
            </EmptyView>
          )}
          <CursorPagination
            count={data.records.length}
            first={params.has("cursor") ? `/account/sync?${first}` : null}
            next={data.cursor ? `/account/sync?${next}` : null}
            noun="rodadas"
            singular="rodada"
          />
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
