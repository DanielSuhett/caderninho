import { Badge } from "@cloudflare/kumo/components/badge";
import { Banner } from "@cloudflare/kumo/components/banner";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Select } from "@cloudflare/kumo/components/select";
import { Table } from "@cloudflare/kumo/components/table";
import { GearSixIcon } from "@phosphor-icons/react";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

import type {
  PortalQueryResults,
  PortalResponse,
  ReserveReport,
} from "../../contracts";
import { ReserveHealth, reserveDefaults } from "../../domain";
import { tryCatch } from "../../shared";
import { formatBalance } from "../money";
import { randomId } from "../random-id";
import { UiButton, UiLink } from "../ui";
import { UiCheckbox } from "../ui-checkbox";
import type { createAccountApi } from "./account-api";
import { AccountAvatar } from "./account-identity";
import { workspaceHref } from "./account-navigation";
import { BackofficeDialog } from "./backoffice-dialog";
import { CategorySymbol } from "./category-appearance";
import { InfoTip } from "./info-tip";
import { PersonAvatar, PersonIdentity } from "./person-identity";
import { createViewCache } from "./read-cache";
import { ScopePicker } from "./scope-picker";
import { EmptyView } from "./workspace-filters";
import { ResourceFeedback, useResource } from "./workspace-resource";
import { WorkspaceHeading } from "./workspace-ui";

type Source = ReserveReport["sources"][number];

const monthName = new Intl.DateTimeFormat("pt-BR", {
  month: "long",
  timeZone: "UTC",
});
const monthOptions = [3, 6, 9, 12].map((months) => ({
  label: `${months} meses`,
  value: String(months),
}));
const sourceKinds: Record<Source["kind"], string> = {
  account: "Conta",
  investment: "Investimento",
};
const healthBadges: Record<
  ReserveHealth,
  { label: string; variant: "error" | "warning" | "success" }
> = {
  [ReserveHealth.full]: { label: "Completa", variant: "success" },
  [ReserveHealth.low]: { label: "Abaixo da metade", variant: "error" },
  [ReserveHealth.partial]: { label: "Em formação", variant: "warning" },
};
const coverage = (value: number) =>
  value.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
// Cutting fixed costs only matters once the reserve has reached its target.
const showsReduction = (report: ReserveReport) =>
  report.health === ReserveHealth.full && report.reductionMinor !== "0";
const sourceAppearance = (source: Source) => ({
  identity: source.identity,
  name: source.name,
});

const views = createViewCache<PortalQueryResults["get_emergency_reserve"]>();

export function ReserveView({
  api,
  snapshot,
}: {
  api: Pick<
    ReturnType<typeof createAccountApi>,
    "invalidate" | "planning" | "query"
  >;
  snapshot: PortalResponse;
}) {
  const [params] = useState(() => new URLSearchParams(location.search));
  const spaceId = params.get("space") ?? "personal";
  const personId = params.get("person") ?? snapshot.people[0]?.id ?? "self";
  const person = snapshot.people.find((row) => row.id === personId);
  const [editing, setEditing] = useState(false);
  const [session, setSession] = useState(0);
  const load = useCallback(
    (signal: AbortSignal, fresh: boolean) =>
      api.query(
        { personId, spaceId, tool: "get_emergency_reserve" },
        snapshot.csrf,
        signal,
        fresh,
      ),
    [api, personId, snapshot.csrf, spaceId],
  );
  const resource = useResource(load, views);
  const report = resource.data?.data;
  const configure = useCallback(() => {
    setSession((value) => value + 1);
    setEditing(true);
  }, []);
  const close = useCallback(() => setEditing(false), []);
  const saved = useCallback(() => {
    setEditing(false);
    api.invalidate();
    resource.retry();
  }, [api, resource.retry]);
  const hrefFor = (id: string) => {
    const next = new URLSearchParams(params);
    next.set("person", id);
    return `${workspaceHref("/account/reserve")}?${next}`;
  };
  return (
    <>
      <WorkspaceHeading title="Reserva de emergência" />
      {snapshot.people.length > 1 && (
        <ScopePicker
          currentId={personId}
          items={snapshot.people.map((row) => ({
            href: hrefFor(row.id),
            id: row.id,
            leading: (
              <PersonAvatar
                person={row}
                size={24}
              />
            ),
            name: row.name,
          }))}
          label="Pessoas"
        />
      )}
      <ResourceFeedback {...resource} />
      {!!report && (
        <section
          aria-labelledby="reserve-heading"
          className="entity-panel"
        >
          <header className="entity-panel-header">
            <h2 id="reserve-heading">
              {person ? <PersonIdentity person={person} /> : "Reserva"}
            </h2>
            <div className="entity-panel-actions">
              <UiButton
                icon={GearSixIcon}
                onClick={configure}
                type="button"
              >
                Configurar
              </UiButton>
            </div>
          </header>
          <ReserveSummary report={report} />
          <FixedCostTable
            report={report}
            spaceId={spaceId}
          />
          <SourceTable
            configure={configure}
            report={report}
          />
          {session > 0 && (
            <ReserveEditor
              api={api}
              close={close}
              csrf={snapshot.csrf}
              key={session}
              open={editing}
              report={report}
              saved={saved}
              spaceId={spaceId}
            />
          )}
        </section>
      )}
    </>
  );
}

function ReserveSummary({ report }: { report: ReserveReport }) {
  const covered = report.coveredMonths ?? 0;
  // The surplus reads as extra months, capped so the target stays legible.
  const surplus = Math.min(Math.max(covered - report.months, 0), report.months);
  const money = (value: string | null) => formatBalance(value, report.currency);
  const badge = report.health ? healthBadges[report.health] : null;
  const label = [
    `${coverage(covered)} de ${report.months} meses cobertos`,
    badge?.label,
  ]
    .filter(Boolean)
    .join(", ");
  return (
    <div className="reserve-summary">
      <p className="reserve-headline">
        <strong>{money(report.savedMinor)}</strong>
        <span>de {money(report.targetMinor)}</span>
        {!!badge && (
          <span className="reserve-health">
            <Badge variant={badge.variant}>{badge.label}</Badge>
          </span>
        )}
      </p>
      {/* One segment per month of fixed cost; the surplus trails in grey. */}
      <ol
        aria-label={label}
        className="reserve-months"
        data-health={report.health ?? undefined}
      >
        {Array.from({ length: report.months }, (_, index) => (
          <li key={String(index)}>
            <span
              style={{
                width: `${Math.max(Math.min(covered - index, 1), 0) * 100}%`,
              }}
            />
          </li>
        ))}
        {surplus > 0 && (
          <li
            className="reserve-surplus"
            style={{ flexGrow: surplus }}
          />
        )}
      </ol>
      <dl className="reserve-facts">
        <div>
          <dt>Cobertura</dt>
          <dd>
            {report.coveredMonths === null
              ? "—"
              : `${coverage(report.coveredMonths)} de ${report.months} meses`}
          </dd>
        </div>
        <div>
          <dt>
            Custo fixo mensal
            <InfoTip label="Custo fixo mensal">
              Média das categorias de custo fixo nos últimos{" "}
              {reserveDefaults.window} meses fechados.
            </InfoTip>
          </dt>
          <dd>{money(report.averageMinor)}</dd>
        </div>
        {report.surplusMinor === null ? (
          <div>
            <dt>Falta</dt>
            <dd>{money(report.remainingMinor)}</dd>
          </div>
        ) : (
          <div>
            <dt>Excedente</dt>
            <dd>{money(report.surplusMinor)}</dd>
          </div>
        )}
        {showsReduction(report) && (
          <div>
            <dt>
              Redução possível
              <InfoTip label="Redução possível">
                Se cada categoria voltar ao seu menor mês recente, a meta cai{" "}
                {money(
                  (
                    BigInt(report.reductionMinor) * BigInt(report.months)
                  ).toString(),
                )}
                .
              </InfoTip>
            </dt>
            <dd className="reserve-saving">
              {money(report.reductionMinor)}/mês
            </dd>
          </div>
        )}
      </dl>
    </div>
  );
}

function FixedCostTable({
  report,
  spaceId,
}: {
  report: ReserveReport;
  spaceId: string;
}) {
  const categoriesHref = `${workspaceHref("/account/categories")}${
    spaceId === "personal" ? "" : `?space=${spaceId}`
  }`;
  return (
    <section
      aria-labelledby="reserve-fixed-heading"
      className="reserve-section"
    >
      <header className="reserve-section-header">
        <h3 id="reserve-fixed-heading">Custo fixo</h3>
        <UiLink
          href={categoriesHref}
          variant="ghost"
        >
          Ajustar categorias
        </UiLink>
      </header>
      {report.categories.length ? (
        <LayerCard className="ledger-surface">
          <Table
            aria-labelledby="reserve-fixed-heading"
            className="ledger-table ledger-pair"
            layout="fixed"
          >
            <Table.Header>
              <Table.Row>
                <Table.Head>Categoria</Table.Head>
                <Table.Head className="ledger-number">Média mensal</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {report.categories.map((row) => (
                <Table.Row key={row.id}>
                  <Table.Cell className="ledger-lead">
                    <span className="ledger-primary">
                      <CategorySymbol
                        {...(row.color && { color: row.color })}
                        {...(row.icon && { icon: row.icon })}
                      />
                      <div>
                        <span>{row.name}</span>
                        {showsReduction(report) &&
                          row.reductionMinor !== "0" && (
                            <small>
                              Menor mês{" "}
                              {formatBalance(row.lowestMinor, report.currency)}
                            </small>
                          )}
                      </div>
                    </span>
                  </Table.Cell>
                  <Table.Cell className="ledger-number">
                    {formatBalance(row.averageMinor, report.currency)}
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
            <tfoot>
              <Table.Row>
                <Table.Cell className="ledger-muted">
                  {report.monthly
                    .map((row) =>
                      monthName.format(new Date(`${row.month}-01T12:00:00Z`)),
                    )
                    .join(", ")}
                </Table.Cell>
                <Table.Cell className="ledger-number">
                  {formatBalance(report.averageMinor, report.currency)}
                </Table.Cell>
              </Table.Row>
            </tfoot>
          </Table>
        </LayerCard>
      ) : (
        <EmptyView title="Sem custo fixo nos últimos meses">
          Marque as categorias que se repetem todo mês em Categorias.
        </EmptyView>
      )}
    </section>
  );
}

function SourceTable({
  report,
  configure,
}: {
  report: ReserveReport;
  configure: () => void;
}) {
  const linked = report.sources.filter((source) => source.linked);
  return (
    <section
      aria-labelledby="reserve-source-heading"
      className="reserve-section"
    >
      <header className="reserve-section-header">
        <h3 id="reserve-source-heading">Onde está a reserva</h3>
      </header>
      {linked.length ? (
        <LayerCard className="ledger-surface">
          <Table
            aria-labelledby="reserve-source-heading"
            className="ledger-table ledger-pair"
            layout="fixed"
          >
            <Table.Header>
              <Table.Row>
                <Table.Head>Origem</Table.Head>
                <Table.Head className="ledger-number">Saldo</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {linked.map((source) => (
                <Table.Row key={source.id}>
                  <Table.Cell className="ledger-lead">
                    <span className="ledger-primary">
                      <AccountAvatar
                        account={sourceAppearance(source)}
                        filterable={false}
                      />
                      <div>
                        <span>{source.name}</span>
                        <small>{sourceKinds[source.kind]}</small>
                      </div>
                    </span>
                  </Table.Cell>
                  <Table.Cell className="ledger-number">
                    {formatBalance(source.balanceMinor, report.currency)}
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </LayerCard>
      ) : (
        <div className="reserve-empty">
          <EmptyView title="Nenhuma conta ou investimento vinculado">
            Escolha onde a reserva está guardada para acompanhar a cobertura.
          </EmptyView>
          <UiButton
            onClick={configure}
            type="button"
            variant="primary"
          >
            Vincular saldos
          </UiButton>
        </div>
      )}
    </section>
  );
}

function ReserveEditor({
  api,
  csrf,
  report,
  spaceId,
  open,
  close,
  saved,
}: {
  api: Pick<ReturnType<typeof createAccountApi>, "planning">;
  csrf: string;
  report: ReserveReport;
  spaceId: string;
  open: boolean;
  close: () => void;
  saved: () => void;
}) {
  const id = useId();
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const markDirty = useCallback(() => setDirty(true), []);
  const submit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (controller.current) {
        return;
      }
      const form = new FormData(event.currentTarget);
      const pick = (kind: Source["kind"]) =>
        report.sources
          .filter(
            (source) => source.kind === kind && form.has(`source:${source.id}`),
          )
          .map((source) => source.id);
      const command = {
        accountIds: pick("account"),
        confirmed: true,
        idempotency_key: randomId(),
        investmentIds: pick("investment"),
        months: Number(form.get("months")),
        personId: report.personId,
        spaceId,
        tool: "set_emergency_reserve",
      };
      const request = new AbortController();
      controller.current = request;
      setBusy(true);
      setMessage("");
      // The validator downloads with the first save, not with the page.
      const { data: contracts, error: loadError } = await tryCatch(
        () => import("../../contracts"),
      );
      if (request.signal.aborted) {
        return;
      }
      const input = loadError
        ? null
        : contracts.PortalMutationSchema.safeParse({ command, csrf });
      if (!input?.success) {
        controller.current = null;
        setBusy(false);
        setMessage(
          input
            ? "Confira os meses da reserva."
            : "Não foi possível salvar. Sua escolha foi preservada.",
        );
        return;
      }
      const { error } = await tryCatch(() =>
        api.planning(input.data.command, csrf, request.signal),
      );
      if (request.signal.aborted) {
        return;
      }
      controller.current = null;
      setBusy(false);
      if (error) {
        setMessage("Não foi possível salvar. Sua escolha foi preservada.");
        return;
      }
      saved();
    },
    [api, csrf, report, saved, spaceId],
  );
  return (
    <BackofficeDialog
      busy={busy}
      close={close}
      dirty={dirty}
      open={open}
      presentation="compact-editor"
      primaryAction={{
        children: busy ? "Salvando…" : "Salvar",
        form: id,
        type: "submit",
      }}
      title="Configurar reserva"
    >
      <form
        className="backoffice-form"
        id={id}
        onChange={markDirty}
        onSubmit={submit}
      >
        <fieldset disabled={busy}>
          <legend className="sr-only">Reserva de emergência</legend>
          <Select
            defaultValue={String(report.months)}
            items={monthOptions}
            label="Meses de custo fixo"
            name="months"
            onValueChange={markDirty}
          />
        </fieldset>
        <fieldset
          className="reserve-sources"
          disabled={busy}
        >
          <legend>Saldos que compõem a reserva</legend>
          {report.sources.length ? (
            report.sources.map((source) => (
              <UiCheckbox
                defaultChecked={source.linked}
                key={source.id}
                label={
                  <span className="reserve-source">
                    <AccountAvatar
                      account={sourceAppearance(source)}
                      filterable={false}
                    />
                    <span>
                      {source.name}
                      <small>{sourceKinds[source.kind]}</small>
                    </span>
                    <span className="reserve-source-balance">
                      {formatBalance(source.balanceMinor, report.currency)}
                    </span>
                  </span>
                }
                name={`source:${source.id}`}
              />
            ))
          ) : (
            <p className="muted">Nenhuma conta ou investimento desta pessoa.</p>
          )}
          {!!message && <Banner variant="error">{message}</Banner>}
        </fieldset>
      </form>
    </BackofficeDialog>
  );
}
