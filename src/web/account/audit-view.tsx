import {
  type MouseEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import type { AuditReport, PortalResponse } from "../../contracts";
import { tryCatch } from "../../shared";
import { UiButton } from "../ui";
import type { createAccountApi } from "./account-api";
import { EmptyView } from "./workspace-filters";
import {
  momentLabel,
  ResourceFeedback,
  useResource,
} from "./workspace-resource";
import {
  FilterDrawer,
  RefreshButton,
  WorkspaceHeading,
  WorkspaceMetrics,
} from "./workspace-ui";

function bytes(value: number) {
  if (value < 1024) {
    return `${value} B`;
  }
  if (value < 1_048_576) {
    return `${(value / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} KiB`;
  }
  return `${(value / 1_048_576).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MiB`;
}
function rate(errors: number, total: number) {
  return total
    ? `${((100 * errors) / total).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`
    : "—";
}
function clientLabel(data: AuditReport, id: string | null) {
  return (
    data.grants.find((g) => g.clientId === id)?.clientName ??
    id ??
    "Cliente não identificado"
  );
}
const outcomes = {
  cancelled: "Interrompida",
  failed: "Falhou",
  success: "Concluída",
};

export function AuditView({
  api,
  snapshot,
}: {
  api: ReturnType<typeof createAccountApi>;
  snapshot: PortalResponse;
}) {
  const [params] = useState(() => new URLSearchParams(location.search));
  const load = useCallback(
    (signal: AbortSignal, fresh = false) =>
      api.audit(
        new URLSearchParams({
          days: params.get("days") || "7",
          ...(params.get("grantCursor") && {
            grantCursor: params.get("grantCursor") ?? "",
          }),
        }),
        signal,
        fresh,
      ),
    [api, params],
  );
  const resource = useResource(load);
  const { data } = resource;
  const [confirm, setConfirm] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"success" | "error">(
    "success",
  );
  const mutation = useRef<AbortController | null>(null);
  useEffect(() => () => mutation.current?.abort(), []);
  const cancelRevoke = useCallback(() => setConfirm(null), []);
  const askRevoke = useCallback(
    (event: MouseEvent<HTMLButtonElement>) =>
      setConfirm(event.currentTarget.value),
    [],
  );
  const revoke = useCallback(async () => {
    if (!confirm || busy) {
      return;
    }
    setBusy(true);
    const controller = new AbortController();
    mutation.current = controller;
    const { data: _data, error } = await tryCatch(() =>
      api.revokeGrant(confirm, snapshot.csrf, controller.signal),
    );
    if (controller.signal.aborted) {
      return;
    }
    setBusy(false);
    setConfirm(null);
    setMessageTone(error ? "error" : "success");
    setMessage(
      error
        ? "Não foi possível confirmar a revogação. Atualize a lista antes de tentar novamente."
        : "Autorização revogada. O assistente precisará ser autorizado novamente.",
    );
    resource.retry();
  }, [api, confirm, busy, snapshot.csrf, resource.retry]);
  return (
    <>
      <WorkspaceHeading
        description="Autorizações e atividade observada nesta instalação."
        title="Auditoria MCP"
      >
        <RefreshButton
          disabled={resource.loading || busy}
          label="Atualizar auditoria"
          onClick={resource.retry}
        />
      </WorkspaceHeading>
      <FilterDrawer
        action="/account/audit"
        summary={[
          `Período: ${params.get("days") === "1" ? "24 horas" : `${params.get("days") || "7"} dias`}`,
        ]}
      >
        <label>
          Período
          <select
            defaultValue={params.get("days") || "7"}
            name="days"
          >
            <option value="1">24 horas</option>
            <option value="7">7 dias</option>
            <option value="30">30 dias</option>
          </select>
        </label>
      </FilterDrawer>
      <ResourceFeedback {...resource} />
      {!!message && (
        <p
          className="notice"
          data-tone={messageTone}
          role="status"
        >
          {message}
        </p>
      )}
      {!!data && (
        <>
          <WorkspaceMetrics
            items={[
              {
                hint: `${data.totals.toolCalls} chamadas de ferramentas`,
                label: "Requisições autenticadas",
                value: data.totals.requests.toLocaleString("pt-BR"),
              },
              {
                hint: "Payload observado pelo Worker",
                label: "Corpos recebidos / produzidos",
                value: `${bytes(data.totals.inputBytes)} / ${bytes(data.totals.outputBytes)}`,
              },
              {
                hint: "Inclui falha de ferramenta em HTTP 200",
                label: "Falhas / interrupções",
                value: `${data.totals.errors} / ${data.totals.cancelled}`,
              },
              {
                hint: "Até o encerramento do corpo",
                label: "Duração média",
                value: data.totals.requests
                  ? `${Math.round(data.totals.durationMs / data.totals.requests)} ms`
                  : "—",
              },
            ]}
          />

          <section aria-labelledby="audit-access">
            <div className="results-heading">
              <h2 id="audit-access">Assistentes autorizados</h2>
              <span>{data.grants.length} nesta página</span>
            </div>
            <p className="muted">
              Autorização cadastrada não significa conexão online. O último uso
              é agregado por cliente, no período selecionado.
            </p>
            {data.grants.length ? (
              <div className="grant-list">
                {data.grants.map((grant) => (
                  <article
                    className="grant-row"
                    key={grant.id}
                  >
                    <div>
                      <h3>{grant.clientName}</h3>
                      <p>
                        Autorizado em{" "}
                        {momentLabel(
                          new Date(grant.createdAt * 1000).toISOString(),
                        )}
                      </p>
                      <p>
                        Último uso do cliente:{" "}
                        {momentLabel(
                          data.clients.find(
                            (c) => c.clientId === grant.clientId,
                          )?.lastSeen ?? null,
                        )}
                      </p>
                      <details className="row-details">
                        <summary>Detalhes da autorização</summary>
                        <dl className="detail-list">
                          <div>
                            <dt>Cliente declarado</dt>
                            <dd>
                              <code>{grant.clientId}</code>
                            </dd>
                          </div>
                          <div>
                            <dt>Permissões OAuth</dt>
                            <dd>{grant.scope.join(", ") || "Acesso ao MCP"}</dd>
                          </div>
                          <div>
                            <dt>Expira em</dt>
                            <dd>
                              {grant.expiresAt
                                ? momentLabel(
                                    new Date(
                                      grant.expiresAt * 1000,
                                    ).toISOString(),
                                  )
                                : "Sem prazo declarado"}
                            </dd>
                          </div>
                        </dl>
                        <p className="muted">
                          Nome informado pelo cliente. A autorização permite
                          usar as ferramentas desta instalação.
                        </p>
                      </details>
                    </div>
                    {confirm === grant.id ? (
                      <div className="revoke-confirm">
                        <p>Revogar o acesso de {grant.clientName}?</p>
                        <UiButton
                          disabled={busy}
                          onClick={revoke}
                          tone="danger"
                          type="button"
                        >
                          Confirmar revogação
                        </UiButton>
                        <UiButton
                          disabled={busy}
                          onClick={cancelRevoke}
                          type="button"
                          variant="secondary"
                        >
                          Cancelar
                        </UiButton>
                      </div>
                    ) : (
                      <UiButton
                        disabled={busy}
                        onClick={askRevoke}
                        type="button"
                        value={grant.id}
                        variant="secondary"
                      >
                        Revogar acesso
                      </UiButton>
                    )}
                  </article>
                ))}
              </div>
            ) : (
              <EmptyView title="Nenhum assistente autorizado">
                Configure a URL MCP em Conexões e autorize seu assistente.
              </EmptyView>
            )}
            {!!data.grantCursor && (
              <a
                href={`/account/audit?${new URLSearchParams({ days: String(data.days), grantCursor: data.grantCursor })}`}
              >
                Mais autorizações
              </a>
            )}
            {!!params.get("grantCursor") && (
              <a href={`/account/audit?days=${data.days}`}>
                Primeiras autorizações
              </a>
            )}
          </section>
          {data.totals.requests ? (
            <>
              <section aria-labelledby="audit-trend">
                <h2 id="audit-trend">Dias com atividade · UTC</h2>
                <div className="audit-bars">
                  {data.daily.map((day) => (
                    <div
                      className="audit-day"
                      key={day.day}
                    >
                      <span>
                        {day.day.slice(5).split("-").reverse().join("/")}
                      </span>
                      <meter
                        aria-label={`${day.day}: ${day.requests} requisições, ${day.errors} falhas`}
                        max={Math.max(...data.daily.map((d) => d.requests), 1)}
                        min={0}
                        value={day.requests}
                      />
                      <span>
                        {day.requests} <small>· {day.errors} falhas</small>
                      </span>
                    </div>
                  ))}
                </div>
              </section>
              <section aria-labelledby="audit-model">
                <h2 id="audit-model">Modelos informados pelos clientes</h2>
                <p className="muted">
                  O servidor não identifica o modelo automaticamente. Sem
                  declaração, mostramos “Não informado”; o nome recebido não é
                  verificado.
                </p>
                <div className="audit-table-wrap">
                  <table className="audit-table">
                    <thead>
                      <tr>
                        <th>Modelo</th>
                        <th>Chamadas</th>
                        <th>Falhas</th>
                        <th>Taxa de erro</th>
                        <th>Entrada / saída</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.models.map((row) => (
                        <tr key={row.model ?? "unknown"}>
                          <td>{row.model ?? "Não informado"}</td>
                          <td>{row.toolCalls}</td>
                          <td>{row.errors}</td>
                          <td>{rate(row.errors, row.toolCalls)}</td>
                          <td>
                            {bytes(row.inputBytes)} / {bytes(row.outputBytes)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
              <section aria-labelledby="audit-clients">
                <h2 id="audit-clients">Volume por cliente</h2>
                <div className="audit-table-wrap">
                  <table className="audit-table">
                    <thead>
                      <tr>
                        <th>Cliente</th>
                        <th>Requisições</th>
                        <th>Falhas</th>
                        <th>Entrada / saída</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.clients.map((row) => (
                        <tr key={row.clientId ?? "unknown"}>
                          <td>{clientLabel(data, row.clientId)}</td>
                          <td>{row.requests}</td>
                          <td>{row.errors}</td>
                          <td>
                            {bytes(row.inputBytes)} / {bytes(row.outputBytes)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
              <details className="audit-events">
                <summary>Últimas {data.recent.length} requisições</summary>
                <div className="audit-table-wrap">
                  <table className="audit-table">
                    <thead>
                      <tr>
                        <th>Horário</th>
                        <th>Ferramenta</th>
                        <th>Resultado</th>
                        <th>Cliente / modelo</th>
                        <th>Duração / saída</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.recent.map((row) => (
                        <tr key={row.id}>
                          <td>{momentLabel(row.startedAt)}</td>
                          <td>{row.tool ?? "Protocolo MCP"}</td>
                          <td>
                            <span
                              className="status-label"
                              data-tone={
                                row.outcome === "failed" ? "error" : "neutral"
                              }
                            >
                              {outcomes[row.outcome]} · HTTP {row.status}
                            </span>
                          </td>
                          <td>
                            {clientLabel(data, row.clientId)}
                            <small>{row.model ?? "Modelo não informado"}</small>
                          </td>
                          <td>
                            {row.durationMs} ms · {bytes(row.outputBytes)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </>
          ) : (
            <EmptyView title="Ainda não há atividade registrada">
              Faça uma consulta pelo seu assistente conectado. O histórico
              começa nesta versão.
            </EmptyView>
          )}
          <details className="audit-limits">
            <summary>O que estes números medem</summary>
            <p>
              Janela desde {momentLabel(data.since)}. Histórico consultável de
              30 dias; nenhum argumento, resposta financeira, token ou senha é
              armazenado. Bytes são os corpos consumidos e produzidos pelo
              Worker, sem cabeçalhos, TLS ou compressão de rede. Não são tokens
              de IA nem custos do modelo.
            </p>
            <p>
              Chamadas interrompidas têm volume parcial. A taxa por modelo
              divide falhas por chamadas daquele modelo. As listas mostram até
              100 modelos/clientes e 50 requisições recentes; totais e série
              usam todo o período. Tentativas sem autenticação ficam nos
              diagnósticos de segurança, fora deste painel. Registros anteriores
              a 30 dias são removidos na próxima atividade. A gravação é best
              effort; uma indisponibilidade da auditoria pode deixar lacunas.
            </p>
          </details>
        </>
      )}
    </>
  );
}
