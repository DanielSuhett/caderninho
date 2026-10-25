import { Badge } from "@cloudflare/kumo/components/badge";
import { Banner } from "@cloudflare/kumo/components/banner";
import { InlineCopyText } from "@cloudflare/kumo/components/inline-copy-text";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Link } from "@cloudflare/kumo/components/link";
import { Meter } from "@cloudflare/kumo/components/meter";
import { Select } from "@cloudflare/kumo/components/select";
import { Table } from "@cloudflare/kumo/components/table";
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
import { BackofficeDialog } from "./backoffice-dialog";
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
function CompactBytes({ value }: { value: number }) {
  const [amount, unit] = bytes(value).split(" ");
  return (
    <span className="audit-byte">
      <span>{amount}</span>
      <small>{unit}</small>
    </span>
  );
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
  const [activityOpen, setActivityOpen] = useState(true);
  const activitySection = useRef<HTMLDivElement>(null);
  const showActivity = useCallback(() => {
    setActivityOpen(true);
    requestAnimationFrame(() =>
      activitySection.current?.scrollIntoView({ block: "start" }),
    );
  }, []);
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
      <WorkspaceHeading title="Auditoria MCP">
        <RefreshButton
          disabled={resource.loading || busy}
          label="Atualizar auditoria"
          onClick={resource.retry}
        />
      </WorkspaceHeading>
      <WorkspaceFilters
        action="/account/audit"
        activeCount={params.get("days") && params.get("days") !== "7" ? 1 : 0}
        context={
          params.get("days") === "1"
            ? "Últimas 24 horas"
            : `Últimos ${params.get("days") || "7"} dias`
        }
      >
        <Select
          defaultValue={params.get("days") || "7"}
          items={[
            { label: "24 horas", value: "1" },
            { label: "7 dias", value: "7" },
            { label: "30 dias", value: "30" },
          ]}
          label="Período"
          name="days"
        />
      </WorkspaceFilters>
      <BackofficeDialog
        busy={busy}
        close={cancelRevoke}
        dirty={false}
        open={confirm !== null}
        presentation="confirmation"
        primaryAction={{
          children: busy ? "Revogando…" : "Confirmar revogação",
          onClick: revoke,
          type: "button",
          variant: "destructive",
        }}
        title="Revogar acesso do assistente"
      >
        <p>
          Revogar o acesso de{" "}
          {data?.grants.find((grant) => grant.id === confirm)?.clientName ??
            "este assistente"}
          ?
        </p>
        <p>
          O assistente precisará de uma nova autorização. Seus dados financeiros
          serão preservados.
        </p>
      </BackofficeDialog>
      <ResourceFeedback {...resource} />
      {!!message && (
        <Banner
          className="feedback"
          description={message}
          role="status"
          variant={messageTone === "error" ? "error" : "secondary"}
        />
      )}
      {!!data && (
        <>
          {!!data.totals.errors && (
            <Banner
              action={
                <UiButton
                  onClick={showActivity}
                  type="button"
                  variant="secondary"
                >
                  Ver atividade
                </UiButton>
              }
              className="feedback"
              description={<>{data.totals.errors} falhas no período.</>}
              variant="alert"
            />
          )}
          <section
            aria-labelledby="audit-access"
            className="workspace-section"
          >
            <h2 id="audit-access">Assistentes autorizados</h2>
            {data.grants.length ? (
              <LayerCard
                aria-label="Assistentes autorizados"
                className="record-list"
                render={<ul />}
              >
                {data.grants.map((grant) => (
                  <li key={grant.id}>
                    <DisclosureItem
                      className="record-item"
                      summary={
                        <>
                          <span className="record-title">
                            {grant.clientName}
                          </span>
                          <span className="record-context">
                            Último uso:{" "}
                            {momentLabel(
                              data.clients.find(
                                (c) => c.clientId === grant.clientId,
                              )?.lastSeen ?? null,
                            )}
                          </span>
                          {!!grant.expiresAt && (
                            <span className="record-meta">
                              Expira em{" "}
                              {momentLabel(
                                new Date(grant.expiresAt * 1000).toISOString(),
                              )}
                            </span>
                          )}
                        </>
                      }
                    >
                      <div className="record-detail">
                        <dl className="detail-list">
                          <div>
                            <dt>Autorizado em</dt>
                            <dd>
                              {momentLabel(
                                new Date(grant.createdAt * 1000).toISOString(),
                              )}
                            </dd>
                          </div>

                          <div>
                            <dt>Permissões OAuth</dt>
                            <dd>{grant.scope.join(", ") || "Acesso ao MCP"}</dd>
                          </div>
                          <div>
                            <dt>Expiração</dt>
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
                          Nome declarado pelo cliente. Autorização não indica
                          conexão online; o último uso se refere ao período
                          selecionado.
                        </p>
                        <UiButton
                          className="quiet-action"
                          disabled={busy}
                          onClick={askRevoke}
                          type="button"
                          value={grant.id}
                          variant="ghost"
                        >
                          Revogar acesso
                        </UiButton>
                        <RecordReference>
                          <div>
                            <dt>Cliente declarado</dt>
                            <dd>
                              <InlineCopyText
                                labels={{
                                  copied: "Identificador copiado",
                                  copyAction: "Copiar identificador",
                                }}
                              >
                                {grant.clientId}
                              </InlineCopyText>
                            </dd>
                          </div>
                        </RecordReference>
                      </div>
                    </DisclosureItem>
                  </li>
                ))}
              </LayerCard>
            ) : (
              <EmptyView title="Nenhum assistente autorizado">
                <Link href="/account/connections">Conectar assistente</Link>
              </EmptyView>
            )}
            <CursorPagination
              count={data.grants.length}
              first={
                params.get("grantCursor")
                  ? `/account/audit?days=${data.days}`
                  : null
              }
              next={
                data.grantCursor
                  ? `/account/audit?${new URLSearchParams({ days: String(data.days), grantCursor: data.grantCursor })}`
                  : null
              }
              noun="autorizações"
              singular="autorização"
            />
          </section>
          <div ref={activitySection}>
            <WorkspaceDetails
              hint={`${data.totals.requests} requisições`}
              onOpenChange={setActivityOpen}
              open={activityOpen}
              title="Atividade"
            >
              <WorkspaceMetrics
                items={[
                  {
                    label: "Chamadas de ferramentas",
                    value: data.totals.toolCalls,
                  },
                  {
                    label: "Falhas / interrupções",
                    value: `${data.totals.errors} / ${data.totals.cancelled}`,
                  },
                  {
                    label: "Entrada / saída",
                    value: (
                      <span className="audit-volume">
                        <CompactBytes value={data.totals.inputBytes} />
                        <span>/</span>
                        <CompactBytes value={data.totals.outputBytes} />
                      </span>
                    ),
                  },
                  {
                    label: "Duração média",
                    value: data.totals.requests ? (
                      <span className="audit-duration">
                        {Math.round(
                          data.totals.durationMs / data.totals.requests,
                        ).toLocaleString("pt-BR")}
                        <small>ms</small>
                      </span>
                    ) : (
                      "—"
                    ),
                  },
                ]}
              />
              {data.totals.requests ? (
                <>
                  <section aria-labelledby="audit-trend">
                    <h2 id="audit-trend">Dias com atividade · UTC</h2>
                    <p className="muted">
                      Escala relativa: 0 a{" "}
                      {Math.max(...data.daily.map((day) => day.requests), 1)}{" "}
                      requisições, o máximo observado neste período. Não
                      representa cota.
                    </p>
                    <div className="audit-bars">
                      {data.daily.map((day) => (
                        <div
                          className="audit-day"
                          key={day.day}
                        >
                          <span>
                            {day.day.slice(5).split("-").reverse().join("/")}
                          </span>
                          <Meter
                            indicatorClassName="audit-activity-indicator"
                            label={`${day.day}: ${day.requests} requisições, ${day.errors} falhas`}
                            max={Math.max(
                              ...data.daily.map((d) => d.requests),
                              1,
                            )}
                            min={0}
                            showValue={false}
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
                      declaração, mostramos “Não informado”; o nome recebido não
                      é verificado.
                    </p>
                    <div className="audit-table-wrap">
                      <Table className="audit-table">
                        <Table.Header>
                          <Table.Row>
                            <Table.Head>Modelo</Table.Head>
                            <Table.Head>Chamadas de ferramentas</Table.Head>
                            <Table.Head>Falhas</Table.Head>
                            <Table.Head>Taxa de erro</Table.Head>
                            <Table.Head>Entrada / saída</Table.Head>
                          </Table.Row>
                        </Table.Header>
                        <Table.Body>
                          {data.models.map((row) => (
                            <Table.Row key={row.model ?? "unknown"}>
                              <Table.Cell data-label="Modelo">
                                {row.model ?? "Não informado"}
                              </Table.Cell>
                              <Table.Cell data-label="Chamadas de ferramentas">
                                {row.toolCalls}
                              </Table.Cell>
                              <Table.Cell data-label="Falhas">
                                {row.errors}
                              </Table.Cell>
                              <Table.Cell data-label="Taxa de erro">
                                {rate(row.errors, row.toolCalls)}
                              </Table.Cell>
                              <Table.Cell data-label="Entrada / saída">
                                {bytes(row.inputBytes)} /{" "}
                                {bytes(row.outputBytes)}
                              </Table.Cell>
                            </Table.Row>
                          ))}
                        </Table.Body>
                      </Table>
                    </div>
                  </section>
                  <section aria-labelledby="audit-clients">
                    <h2 id="audit-clients">Volume por cliente</h2>
                    <div className="audit-table-wrap">
                      <Table className="audit-table">
                        <Table.Header>
                          <Table.Row>
                            <Table.Head>Cliente</Table.Head>
                            <Table.Head>Requisições</Table.Head>
                            <Table.Head>Falhas</Table.Head>
                            <Table.Head>Entrada / saída</Table.Head>
                          </Table.Row>
                        </Table.Header>
                        <Table.Body>
                          {data.clients.map((row) => (
                            <Table.Row key={row.clientId ?? "unknown"}>
                              <Table.Cell data-label="Cliente">
                                {clientLabel(data, row.clientId)}
                              </Table.Cell>
                              <Table.Cell data-label="Requisições">
                                {row.requests}
                              </Table.Cell>
                              <Table.Cell data-label="Falhas">
                                {row.errors}
                              </Table.Cell>
                              <Table.Cell data-label="Entrada / saída">
                                {bytes(row.inputBytes)} /{" "}
                                {bytes(row.outputBytes)}
                              </Table.Cell>
                            </Table.Row>
                          ))}
                        </Table.Body>
                      </Table>
                    </div>
                  </section>
                  <DisclosureItem
                    className="audit-events"
                    summary={`Requisições recentes · ${data.recent.length}`}
                  >
                    <div className="audit-table-wrap">
                      <Table className="audit-table">
                        <Table.Header>
                          <Table.Row>
                            <Table.Head>Horário</Table.Head>
                            <Table.Head>Ferramenta</Table.Head>
                            <Table.Head>Resultado</Table.Head>
                            <Table.Head>Cliente / modelo</Table.Head>
                            <Table.Head>Duração / saída</Table.Head>
                          </Table.Row>
                        </Table.Header>
                        <Table.Body>
                          {data.recent.map((row) => (
                            <Table.Row key={row.id}>
                              <Table.Cell data-label="Horário">
                                {momentLabel(row.startedAt)}
                              </Table.Cell>
                              <Table.Cell data-label="Ferramenta">
                                {row.tool ?? "Protocolo MCP"}
                              </Table.Cell>
                              <Table.Cell data-label="Resultado">
                                <Badge
                                  variant={
                                    row.outcome === "failed"
                                      ? "error"
                                      : "secondary"
                                  }
                                >
                                  {outcomes[row.outcome]} · HTTP {row.status}
                                </Badge>
                              </Table.Cell>
                              <Table.Cell data-label="Cliente / modelo">
                                {clientLabel(data, row.clientId)}
                                <small>
                                  {row.model ?? "Modelo não informado"}
                                </small>
                              </Table.Cell>
                              <Table.Cell data-label="Duração / saída">
                                {row.durationMs} ms · {bytes(row.outputBytes)}
                              </Table.Cell>
                            </Table.Row>
                          ))}
                        </Table.Body>
                      </Table>
                    </div>
                  </DisclosureItem>
                </>
              ) : (
                <p className="muted">Sem atividade registrada no período.</p>
              )}
            </WorkspaceDetails>
          </div>
          <WorkspaceDetails title="O que estes números medem">
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
          </WorkspaceDetails>
        </>
      )}
    </>
  );
}
