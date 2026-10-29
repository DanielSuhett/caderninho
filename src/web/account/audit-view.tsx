import { Badge } from "@cloudflare/kumo/components/badge";
import { Banner } from "@cloudflare/kumo/components/banner";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Select } from "@cloudflare/kumo/components/select";
import { Table } from "@cloudflare/kumo/components/table";
import {
  type MouseEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import type { AuditReport, PortalResponse } from "../../contracts";
import { tryCatch } from "../../shared";
import { UiLink } from "../ui";
import type { AccountApi } from "./account-api";
import { workspaceHref } from "./account-navigation";
import { BackofficeDialog } from "./backoffice-dialog";
import { CursorPagination } from "./cursor-pagination";
import { DisclosureItem } from "./disclosure-item";
import { InfoTip } from "./info-tip";
import {
  ActivityChart,
  averageMs,
  BarGauge,
  errorRate,
  percent,
  Sparkline,
} from "./observability-charts";
import { createViewCache } from "./read-cache";
import { RowMenu } from "./row-menu";
import { EmptyView } from "./workspace-filters";
import {
  momentLabel,
  ResourceFeedback,
  ResourcePlaceholder,
  usePageResource,
} from "./workspace-resource";
import { WorkspaceFilters, WorkspaceHeading } from "./workspace-ui";

function bytes(value: number) {
  if (value < 1024) {
    return `${value} B`;
  }
  if (value < 1_048_576) {
    return `${(value / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} KiB`;
  }
  return `${(value / 1_048_576).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MiB`;
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
const toolLabels = new Map([
  ["caderninho_aggregate", "Totais"],
  ["caderninho_status", "Estado"],
  ["caderninho_sync", "Sincronizar"],
  ["caderninho_transactions", "Transações"],
]);
const toolLabel = (tool: string | null) =>
  tool ? (toolLabels.get(tool) ?? tool) : "Protocolo MCP";

function toolRows(recent: AuditReport["recent"]) {
  const counts = new Map<string, { errors: number; value: number }>();
  for (const row of recent) {
    const key = toolLabel(row.tool);
    const current = counts.get(key) ?? { errors: 0, value: 0 };
    current.value += 1;
    current.errors += row.outcome === "failed" ? 1 : 0;
    counts.set(key, current);
  }
  return [...counts]
    .map(([name, row]) => ({
      id: name,
      meta: row.errors ? `${row.errors} com falha` : "sem falhas",
      name,
      value: row.value,
    }))
    .sort((a, b) => b.value - a.value);
}

function Stat({
  label,
  hint,
  value,
  spark,
}: {
  label: string;
  hint?: string;
  value: ReactNode;
  spark: ReactNode;
}) {
  return (
    <div className="obs-stat">
      <dt>
        {label}
        {!!hint && <InfoTip label={label}>{hint}</InfoTip>}
      </dt>
      <dd>{value}</dd>
      <dd className="obs-stat-spark">{spark}</dd>
    </div>
  );
}

function Panel({
  id,
  title,
  tip,
  children,
}: {
  id: string;
  title: string;
  tip?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className="obs-panel"
    >
      <h2
        className="heading-tip"
        id={id}
      >
        {title}
        {!!tip && <InfoTip label={title}>{tip}</InfoTip>}
      </h2>
      <LayerCard className="ledger-surface obs-surface">{children}</LayerCard>
    </section>
  );
}

const views = createViewCache<AuditReport>();

export function AuditView({
  api,
  snapshot,
}: {
  api: AccountApi;
  snapshot: PortalResponse;
}) {
  const [params] = useState(() => new URLSearchParams(location.search));
  const load = useCallback(
    (source: AccountApi, signal: AbortSignal, fresh = false) =>
      source.audit(
        new URLSearchParams({
          days: params.get("days") || "7",
          ...(params.get("grantCursor") && {
            grantCursor: params.get("grantCursor") ?? "",
          }),
        }),
        signal,
        fresh,
      ),
    [params],
  );
  const resource = usePageResource(api, load, views);
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
    (event: MouseEvent<HTMLElement>) =>
      setConfirm(event.currentTarget.dataset.grant ?? null),
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
  const filters = (
    <WorkspaceFilters
      action={workspaceHref("/account/audit")}
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
  );
  return (
    <>
      <WorkspaceHeading
        filters={filters}
        title="Observabilidade"
      />

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
        <ResourcePlaceholder active={resource.placeholder}>
          {data.totals.requests ? (
            <>
              <dl className="obs-stats">
                <Stat
                  label="Requisições"
                  spark={
                    <Sparkline
                      tone="accent"
                      values={data.daily.map((day) => day.requests)}
                    />
                  }
                  value={data.totals.requests.toLocaleString("pt-BR")}
                />
                <Stat
                  hint={`${data.totals.errors} falhas e ${data.totals.cancelled} interrupções no período.`}
                  label="Taxa de erro"
                  spark={
                    <Sparkline
                      tone="danger"
                      values={data.daily.map(errorRate)}
                    />
                  }
                  value={percent(errorRate(data.totals))}
                />
                <Stat
                  label="Latência média"
                  spark={
                    <Sparkline
                      tone="accent"
                      values={data.daily.map(averageMs)}
                    />
                  }
                  value={
                    <>
                      {averageMs(data.totals).toLocaleString("pt-BR")}
                      <small className="obs-unit">ms</small>
                    </>
                  }
                />
                <Stat
                  hint="Corpos produzidos pelo Worker, sem cabeçalhos nem compressão. Não são tokens de IA."
                  label="Dados enviados"
                  spark={
                    <Sparkline
                      tone="accent"
                      values={data.daily.map((day) => day.outputBytes)}
                    />
                  }
                  value={bytes(data.totals.outputBytes)}
                />
              </dl>
              <div className="obs-grid">
                <Panel
                  id="obs-activity"
                  tip={`Dias em UTC desde ${momentLabel(data.since)}. Histórico de 30 dias, sem argumentos, respostas financeiras, tokens ou senhas.`}
                  title="Requisições por dia"
                >
                  <ActivityChart daily={data.daily} />
                </Panel>
                <Panel
                  id="obs-tools"
                  tip={`Contagem das ${data.recent.length} requisições mais recentes.`}
                  title="Ferramentas"
                >
                  <BarGauge
                    label="Uso por ferramenta"
                    rows={toolRows(data.recent)}
                  />
                </Panel>
              </div>
            </>
          ) : (
            <EmptyView title="Sem atividade no período">
              Quando um assistente consultar seus dados, o uso aparece aqui.
            </EmptyView>
          )}
          <section
            aria-labelledby="audit-access"
            className="workspace-section"
          >
            <div className="entity-panel-header">
              <h2 id="audit-access">Assistentes autorizados</h2>
              <UiLink
                href={workspaceHref("/account/connections?assistant=1")}
                variant={data.grants.length ? "secondary" : "primary"}
              >
                Conectar assistente
              </UiLink>
            </div>
            {data.grants.length ? (
              <LayerCard className="ledger-surface">
                <Table
                  aria-label="Assistentes autorizados"
                  className="ledger-table"
                  layout="fixed"
                >
                  <colgroup>
                    <col />
                    <col className="audit-time-column" />
                    <col className="audit-time-column" />
                    <col className="audit-time-column" />
                    <col className="audit-time-column" />
                    <col className="ledger-actions" />
                  </colgroup>
                  <Table.Header>
                    <Table.Row>
                      <Table.Head>Assistente</Table.Head>
                      <Table.Head className="ledger-number">
                        Requisições
                      </Table.Head>
                      <Table.Head>Último uso</Table.Head>
                      <Table.Head>Autorizado em</Table.Head>
                      <Table.Head>Expiração</Table.Head>
                      <Table.Head>
                        <span className="sr-only">Ações</span>
                      </Table.Head>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {data.grants.map((grant) => {
                      const usage = data.clients.find(
                        (c) => c.clientId === grant.clientId,
                      );
                      return (
                        <Table.Row key={grant.id}>
                          <Table.Cell>
                            <div className="ledger-primary">
                              <div>
                                <span>{grant.clientName}</span>
                                <small>
                                  {data.recent.find(
                                    (r) => r.clientId === grant.clientId,
                                  )?.model ??
                                    (grant.scope.join(", ") || "Acesso ao MCP")}
                                </small>
                              </div>
                            </div>
                          </Table.Cell>
                          <Table.Cell className="ledger-number">
                            {(usage?.requests ?? 0).toLocaleString("pt-BR")}
                            {!!usage?.errors && (
                              <small className="obs-unit">
                                {percent(errorRate(usage))} erro
                              </small>
                            )}
                          </Table.Cell>
                          <Table.Cell className="ledger-muted">
                            {momentLabel(usage?.lastSeen ?? null)}
                          </Table.Cell>
                          <Table.Cell className="ledger-muted ledger-wide">
                            {momentLabel(
                              new Date(grant.createdAt * 1000).toISOString(),
                            )}
                          </Table.Cell>
                          <Table.Cell className="ledger-muted ledger-wide">
                            {grant.expiresAt
                              ? momentLabel(
                                  new Date(
                                    grant.expiresAt * 1000,
                                  ).toISOString(),
                                )
                              : "Sem prazo"}
                          </Table.Cell>
                          <Table.Cell className="ledger-actions">
                            <RowMenu
                              items={[
                                {
                                  "data-grant": grant.id,
                                  disabled: busy,
                                  key: "revoke",
                                  label: "Revogar acesso",
                                  onClick: askRevoke,
                                  variant: "danger",
                                },
                              ]}
                              label={`Ações de ${grant.clientName}`}
                            />
                          </Table.Cell>
                        </Table.Row>
                      );
                    })}
                  </Table.Body>
                </Table>
              </LayerCard>
            ) : (
              <EmptyView title="Nenhum assistente autorizado">
                Conecte o ChatGPT ou o Claude para consultar seus dados.
              </EmptyView>
            )}
            <CursorPagination
              first={
                params.get("grantCursor")
                  ? workspaceHref(`/account/audit?days=${data.days}`)
                  : null
              }
              next={
                data.grantCursor
                  ? workspaceHref(
                      `/account/audit?${new URLSearchParams({ days: String(data.days), grantCursor: data.grantCursor })}`,
                    )
                  : null
              }
            />
          </section>
          {!!data.recent.length && (
            <div className="workspace-section">
              <DisclosureItem
                className="audit-events"
                summary={`Registro de requisições · ${data.recent.length}`}
              >
                <LayerCard className="ledger-surface">
                  <Table
                    aria-label="Registro de requisições"
                    className="ledger-table"
                  >
                    <Table.Header>
                      <Table.Row>
                        <Table.Head>Ferramenta</Table.Head>
                        <Table.Head>Assistente</Table.Head>
                        <Table.Head>Horário</Table.Head>
                        <Table.Head className="ledger-number">
                          Duração
                        </Table.Head>
                        <Table.Head>Resultado</Table.Head>
                      </Table.Row>
                    </Table.Header>
                    <Table.Body>
                      {data.recent.map((row) => (
                        <Table.Row key={row.id}>
                          <Table.Cell className="ledger-lead">
                            {toolLabel(row.tool)}
                          </Table.Cell>
                          <Table.Cell className="ledger-muted">
                            {clientLabel(data, row.clientId)}
                          </Table.Cell>
                          <Table.Cell className="ledger-muted">
                            {momentLabel(row.startedAt)}
                          </Table.Cell>
                          <Table.Cell className="ledger-muted ledger-number">
                            {row.durationMs} ms
                          </Table.Cell>
                          <Table.Cell>
                            {row.outcome === "success" ? (
                              <span className="sync-done">
                                {outcomes[row.outcome]}
                              </span>
                            ) : (
                              <Badge
                                variant={
                                  row.outcome === "failed"
                                    ? "error"
                                    : "secondary"
                                }
                              >
                                {outcomes[row.outcome]} · HTTP {row.status}
                              </Badge>
                            )}
                          </Table.Cell>
                        </Table.Row>
                      ))}
                    </Table.Body>
                  </Table>
                </LayerCard>
              </DisclosureItem>
            </div>
          )}
        </ResourcePlaceholder>
      )}
    </>
  );
}
