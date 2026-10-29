import { Badge } from "@cloudflare/kumo/components/badge";
import { Banner } from "@cloudflare/kumo/components/banner";
import { DropdownMenu } from "@cloudflare/kumo/components/dropdown";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Select } from "@cloudflare/kumo/components/select";
import { Table } from "@cloudflare/kumo/components/table";
import { Tooltip } from "@cloudflare/kumo/components/tooltip";
import {
  DotsThreeIcon,
  PencilSimpleIcon,
  PlusIcon,
  UploadSimpleIcon,
} from "@phosphor-icons/react";
import {
  lazy,
  type MouseEvent,
  type ReactNode,
  Suspense,
  useCallback,
  useEffect,
  useState,
} from "react";

import type {
  PortalQueryResults,
  PortalResponse,
  RuleJob,
  WorkspaceCatalog,
} from "../../contracts";
import { RuleJobStatus } from "../../domain";
import { tryCatch } from "../../shared";
import { UiButton, UiIconButton } from "../ui";
import type { OrganizationApi } from "./account-api";
import { navigateWorkspace, workspaceBasePath } from "./account-navigation";
import { CategoryLabel } from "./category-appearance";
import { CategoryOrganization } from "./category-editor";
import { notify } from "./notify";
import { QuerySearch } from "./query-search";
import { createViewCache } from "./read-cache";
import { RowMenu } from "./row-menu";
import { RuleJobNotice, ruleJobSummary, useRuleJob } from "./rule-jobs";
import { type RuleSource, ruleSummary } from "./rule-presentation";
import { ScopePicker } from "./scope-picker";
import { EmptyView, ScopeFields } from "./workspace-filters";
import {
  ResourceFeedback,
  scopedHref,
  useResource,
} from "./workspace-resource";
import {
  WorkspaceDetails,
  WorkspaceFilters,
  WorkspaceHeading,
} from "./workspace-ui";

// Editors and the importer load when first needed (or when the browser is idle).
function ChunkFailure() {
  return (
    <Banner
      description="Não foi possível abrir este editor. Recarregue a página e tente de novo."
      role="alert"
      variant="error"
    />
  );
}
const loadEditors = async () => {
  const { data, error } = await tryCatch(
    () => import("./organization-editors"),
  );
  return { default: error ? ChunkFailure : data.OrganizationEditors };
};
const loadImporter = async () => {
  const { data, error } = await tryCatch(() => import("./rule-importer"));
  return { default: error ? ChunkFailure : data.RuleImporter };
};
const OrganizationEditors = lazy(loadEditors);
const RuleImporter = lazy(loadImporter);

const groupTypes = {
  business: "Profissional",
  family: "Família",
  personal: "Pessoal",
};
function RuleActions({
  busy,
  data,
  openImport,
  reapply,
}: {
  busy: boolean;
  data: WorkspaceCatalog | undefined;
  openImport: () => void;
  reapply: () => void;
}) {
  return (
    <>
      <UiButton
        disabled={busy || !data?.rules.some((rule) => rule.enabled)}
        loading={busy}
        onClick={reapply}
        type="button"
        variant="outline"
      >
        Reaplicar regras
      </UiButton>
      <UiIconButton
        disabled={!data || busy}
        label="Importar regras"
        onClick={openImport}
      >
        <UploadSimpleIcon
          aria-hidden
          size={20}
        />
      </UiIconButton>
    </>
  );
}
const views = createViewCache<
  WorkspaceCatalog & {
    accounts: PortalQueryResults["get_accounts"]["data"]["records"];
  }
>();

export function OrganizationView({
  api,
  snapshot,
  page,
  basePath = workspaceBasePath(),
  actions,
  notice,
}: {
  api: OrganizationApi;
  snapshot: PortalResponse;
  page: "rules" | "categories";
  basePath?: "/account" | "/demo";
  actions?: ReactNode;
  notice?: ReactNode;
}) {
  const [editor, setEditor] = useState<{
    kind: "rule" | "space";
    id?: string;
    remove?: boolean;
  } | null>(null);
  const [importing, setImporting] = useState(false);
  const [importSession, setImportSession] = useState(0);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorSession, setEditorSession] = useState(0);
  const [params] = useState(() => new URLSearchParams(location.search));
  const spaceId = params.get("space") || "personal";
  const activeCount = [params.get("q"), params.get("enabled")].filter(
    Boolean,
  ).length;
  const load = useCallback(
    async (signal: AbortSignal, fresh = false) => {
      const [catalog, accountList] = await Promise.all([
        api.catalog(spaceId, signal, fresh),
        api.query(
          { include_hidden: true, spaceId, tool: "get_accounts" },
          snapshot.csrf,
          signal,
          fresh,
        ),
      ]);
      return {
        ...catalog,
        accounts: accountList.data.records,
      };
    },
    [api, spaceId, snapshot.csrf],
  );
  const resource = useResource(load, views);
  const { data } = resource;
  const rules = data?.rules.filter(
    (r) =>
      (!params.get("q") ||
        `${r.name} ${r.text}`
          .toLocaleLowerCase("pt-BR")
          .includes((params.get("q") ?? "").toLocaleLowerCase("pt-BR"))) &&
      (!params.get("enabled") || String(r.enabled) === params.get("enabled")),
  );
  const ready = !!data;
  useEffect(() => {
    if (!ready) {
      return;
    }
    // Warming is best effort; a failed chunk surfaces when the editor opens.
    const warm = () => {
      Promise.all([loadEditors(), loadImporter()]).then(
        () => undefined,
        () => undefined,
      );
    };
    if (typeof requestIdleCallback === "function") {
      const handle = requestIdleCallback(warm);
      return () => cancelIdleCallback(handle);
    }
    const timer = setTimeout(warm, 1500);
    return () => clearTimeout(timer);
  }, [ready]);
  const current = data?.spaces.find((s) => s.id === spaceId);
  const closeEditor = useCallback(() => setEditorOpen(false), []);
  const saved = useCallback(() => {
    setEditorOpen(false);
    notify({ title: "Alteração salva.", variant: "success" });
    if (editor?.remove && editor.kind === "space" && editor.id === spaceId) {
      navigateWorkspace(new URL(`${basePath}/categories`, location.origin));
      return;
    }
    resource.retry();
  }, [resource.retry, editor, spaceId, basePath]);
  const openImport = useCallback(() => {
    setImportSession((value) => value + 1);
    setImporting(true);
  }, []);
  const closeImport = useCallback(() => setImporting(false), []);
  const jobSettled = useCallback(
    (job: RuleJob) => {
      api.invalidate();
      resource.retry();
      if (job.status === RuleJobStatus.succeeded) {
        notify({ title: ruleJobSummary(job), variant: "success" });
      }
    },
    [api, resource.retry],
  );
  const ruleJob = useRuleJob({
    api,
    csrf: snapshot.csrf,
    settled: jobSettled,
    spaceId,
  });
  const importStarted = useCallback(
    (job: RuleJob) => {
      ruleJob.started(job);
      resource.retry();
    },
    [resource.retry, ruleJob.started],
  );
  const newItem = useCallback(() => {
    setEditor({ kind: page === "rules" ? "rule" : "space" });
    setEditorSession((value) => value + 1);
    setEditorOpen(true);
  }, [page]);
  const openItem = useCallback((event: MouseEvent<HTMLElement>) => {
    const { id, kind, remove } = event.currentTarget.dataset;
    setEditorSession((value) => value + 1);
    setEditorOpen(true);
    setEditor({
      kind: kind === "rule" ? "rule" : "space",
      ...(id && { id }),
      remove: remove === "true",
    });
  }, []);
  const filters = data ? (
    <OrganizationFilters
      activeCount={activeCount}
      basePath={basePath}
      catalog={data}
      page={page}
      params={params}
      snapshot={snapshot}
      spaceId={spaceId}
    />
  ) : null;
  return (
    <>
      <WorkspaceHeading title={page === "rules" ? "Regras" : "Categorias"}>
        {!!actions && <div className="page-actions">{actions}</div>}
      </WorkspaceHeading>
      {notice}
      {page === "rules" && (
        <RuleJobNotice
          job={ruleJob.job}
          message={ruleJob.message}
        />
      )}
      {!!data && importSession > 0 && (
        <Suspense fallback={null}>
          <RuleImporter
            api={api}
            catalog={data}
            close={closeImport}
            csrf={snapshot.csrf}
            key={importSession}
            open={importing}
            spaceId={spaceId}
            started={importStarted}
          />
        </Suspense>
      )}
      {!!data && editorSession > 0 && (
        <Suspense fallback={null}>
          <OrganizationEditors
            api={api}
            close={closeEditor}
            data={data}
            editor={editor}
            open={editorOpen}
            saved={saved}
            session={editorSession}
            snapshot={snapshot}
            spaceId={spaceId}
          />
        </Suspense>
      )}
      <ResourceFeedback {...resource} />
      {!!data && (
        <>
          {(page === "categories" || data.spaces.length > 1) && (
            <GroupScope
              basePath={basePath}
              newGroup={page === "categories" ? newItem : undefined}
              page={page}
              params={params}
              spaceId={spaceId}
              spaces={data.spaces}
            />
          )}
          {page === "rules" ? (
            <section
              aria-labelledby="rules-heading"
              className="entity-panel"
            >
              <header className="entity-panel-header">
                <h2 id="rules-heading">Regras de {current?.name ?? spaceId}</h2>
                <div className="entity-panel-actions">
                  <RuleActions
                    busy={ruleJob.active || ruleJob.starting}
                    data={data}
                    openImport={openImport}
                    reapply={ruleJob.reapply}
                  />
                  <UiButton
                    icon={PlusIcon}
                    onClick={newItem}
                    type="button"
                    variant="primary"
                  >
                    Nova regra
                  </UiButton>
                </div>
              </header>
              {filters}
              {rules?.length ? (
                <LayerCard className="ledger-surface">
                  <Table
                    aria-label="Regras de classificação"
                    className="ledger-table"
                    layout="fixed"
                  >
                    <colgroup>
                      <col className="rule-priority-column" />
                      <col />
                      <col className="rule-category-column" />
                      <col className="rule-origin-column" />
                      <col className="ledger-actions" />
                    </colgroup>
                    <Table.Header>
                      <Table.Row>
                        <Table.Head>Ordem</Table.Head>
                        <Table.Head>Regra</Table.Head>
                        <Table.Head>Categoria</Table.Head>
                        <Table.Head>Origem</Table.Head>
                        <Table.Head>
                          <span className="sr-only">Ações</span>
                        </Table.Head>
                      </Table.Row>
                    </Table.Header>
                    <Table.Body>
                      {rules.map((r) => {
                        const categoryAppearance = data.categories.find(
                          (c) => c.id === r.categoryId,
                        );
                        return (
                          <Table.Row key={r.id}>
                            <Table.Cell className="ledger-number">
                              <span className="sr-only">Prioridade </span>
                              {r.priority}
                            </Table.Cell>
                            <Table.Cell className="ledger-lead">
                              <div className="ledger-primary">
                                <div>
                                  <span>
                                    {r.name}{" "}
                                    {!r.enabled && (
                                      <Badge variant="secondary">Pausada</Badge>
                                    )}
                                  </span>
                                  <small>{ruleSummary({ rule: r })}</small>
                                </div>
                              </div>
                            </Table.Cell>
                            <Table.Cell>
                              <CategoryLabel
                                category={categoryAppearance}
                                label={
                                  categoryAppearance?.name ??
                                  "Categoria não identificada"
                                }
                              />
                            </Table.Cell>
                            <Table.Cell className="ledger-muted">
                              {r.pack ? `Pacote ${r.pack.id}` : "Pessoal"}
                            </Table.Cell>
                            <Table.Cell className="ledger-actions">
                              <OrganizationMenu
                                href={ruleTransactionsHref(r, params, basePath)}
                                item={r}
                                kind="rule"
                                linkLabel={ruleLinkLabel(r)}
                                onOpen={openItem}
                              />
                            </Table.Cell>
                          </Table.Row>
                        );
                      })}
                    </Table.Body>
                  </Table>
                </LayerCard>
              ) : (
                <EmptyView title="Nenhuma regra encontrada">
                  Use Nova regra para começar com um preset e conferir as
                  transações correspondentes.
                </EmptyView>
              )}
              <WorkspaceDetails title="Como as regras são aplicadas">
                <p>
                  Regras pessoais vêm antes dos pacotes. Dentro de cada grupo, a
                  primeira regra ativa correspondente vence: menor prioridade,
                  com desempate pelo identificador. Salvar vale para as próximas
                  importações e não reclassifica o histórico.
                </p>
              </WorkspaceDetails>
            </section>
          ) : (
            <GroupPanel
              api={api}
              basePath={basePath}
              current={current}
              data={data}
              onOpen={openItem}
              params={params}
              saved={saved}
              snapshot={snapshot}
              spaceId={spaceId}
            />
          )}
        </>
      )}
    </>
  );
}

function GroupPanel({
  api,
  basePath,
  current,
  data,
  onOpen,
  params,
  saved,
  snapshot,
  spaceId,
}: {
  api: OrganizationApi;
  basePath: string;
  current: WorkspaceCatalog["spaces"][number] | undefined;
  data: WorkspaceCatalog;
  onOpen: (event: MouseEvent<HTMLElement>) => void;
  params: URLSearchParams;
  saved: () => void;
  snapshot: PortalResponse;
  spaceId: string;
}) {
  const search = params.get("q") ?? "";
  if (!current) {
    return (
      <EmptyView title="Grupo não encontrado">
        Escolha um dos grupos acima para ver categorias e etiquetas.
      </EmptyView>
    );
  }
  return (
    <section
      aria-labelledby="group-heading"
      className="entity-panel"
    >
      <header className="entity-panel-header">
        <div className="group-identity">
          <h2 id="group-heading">{current.name}</h2>
          <p className="group-facts">
            {/* The type repeats the name for the default personal group. */}
            {groupTypes[current.type] !== current.name &&
              `${groupTypes[current.type]} · `}
            {current.currency} · mês começa no dia {current.monthStartDay}
          </p>
        </div>
        <OrganizationActions
          href={scopedHref(
            `${basePath}/transactions`,
            new URLSearchParams({
              space: current.id,
              ...(params.get("month") && {
                month: params.get("month") ?? "",
              }),
            }),
          )}
          item={current}
          kind="space"
          linkLabel={"Ver transações"}
          onOpen={onOpen}
        />
      </header>
      <QuerySearch
        action={`${basePath}/categories`}
        compact
        label="Buscar categoria"
        name="q"
        params={params}
      />
      <CategoryOrganization
        api={api}
        catalog={{
          ...data,
          categories: data.categories.filter((category) =>
            category.name
              .toLocaleLowerCase("pt-BR")
              .includes(search.toLocaleLowerCase("pt-BR")),
          ),
        }}
        saved={saved}
        snapshot={snapshot}
        spaceId={spaceId}
      />
      <WorkspaceDetails
        hint={String(data.tags.length)}
        title="Etiquetas"
      >
        {data.tags.length ? (
          <ul className="tag-list">
            {data.tags.map((t) => (
              <li key={t.id}>{t.name}</li>
            ))}
          </ul>
        ) : (
          <p className="muted">Nenhuma etiqueta cadastrada neste grupo.</p>
        )}
      </WorkspaceDetails>
    </section>
  );
}

function GroupScope({
  basePath,
  newGroup,
  page,
  params,
  spaceId,
  spaces,
}: {
  basePath: string;
  newGroup?: (() => void) | undefined;
  page: "rules" | "categories";
  params: URLSearchParams;
  spaceId: string;
  spaces: WorkspaceCatalog["spaces"];
}) {
  const hrefFor = (id: string) => {
    const next = new URLSearchParams(params);
    next.delete("space");
    if (id !== "personal") {
      next.set("space", id);
    }
    const query = next.toString();
    return `${basePath}/${page}${query && `?${query}`}`;
  };
  return (
    <ScopePicker
      create={newGroup && { label: "Outro grupo", onClick: newGroup }}
      currentId={spaceId}
      items={spaces.map((space) => ({
        href: hrefFor(space.id),
        id: space.id,
        name: space.name,
      }))}
      label="Grupos"
    />
  );
}

function OrganizationFilters({
  activeCount,
  basePath,
  catalog,
  page,
  params,
  snapshot,
  spaceId,
}: {
  activeCount: number;
  basePath: string;
  catalog: WorkspaceCatalog;
  page: "rules" | "categories";
  params: URLSearchParams;
  snapshot: PortalResponse;
  spaceId: string;
}) {
  const current = catalog.spaces.find((space) => space.id === spaceId);
  return (
    <WorkspaceFilters
      action={`${basePath}/${page}`}
      activeCount={activeCount}
      context={
        {
          categories: `Categorias e etiquetas: ${current?.name ?? spaceId}`,
          rules: current?.name ?? spaceId,
        }[page]
      }
      leading={
        page === "rules" && (
          <QuerySearch
            action={`${basePath}/rules`}
            compact
            label="Buscar regra"
            name="q"
            params={params}
          />
        )
      }
      showClear={activeCount > 0}
    >
      <input
        disabled={!params.has("month")}
        name="month"
        type="hidden"
        value={params.get("month") ?? ""}
      />
      <ScopeFields
        catalog={catalog}
        params={params}
        person={false}
        snapshot={snapshot}
        space={false}
      />
      <input
        name="q"
        type="hidden"
        value={params.get("q") ?? ""}
      />
      {page === "rules" && (
        <Select
          defaultValue={params.get("enabled") ?? ""}
          items={[
            { label: "Todas as regras", value: "" },
            { label: "Ativas", value: "true" },
            { label: "Pausadas", value: "false" },
          ]}
          label="Estado"
          name="enabled"
        />
      )}
    </WorkspaceFilters>
  );
}

function OrganizationActions({
  item,
  kind,
  href,
  linkLabel,
  onOpen,
}: {
  item: { id: string; name: string };
  kind: "rule" | "space";
  href: string;
  linkLabel: string;
  onOpen: (event: MouseEvent<HTMLElement>) => void;
}) {
  const noun = kind === "rule" ? "regra" : "grupo";
  return (
    <div className="record-actions">
      <UiIconButton
        data-id={item.id}
        data-kind={kind}
        label={`Editar ${noun} ${item.name}`}
        onClick={onOpen}
      >
        <PencilSimpleIcon
          aria-hidden
          size={20}
        />
      </UiIconButton>
      <DropdownMenu>
        <Tooltip
          content={`Mais ações de ${item.name}`}
          render={
            <DropdownMenu.Trigger
              aria-label={`Mais ações de ${item.name}`}
              render={
                <UiButton
                  aria-label={`Mais ações de ${item.name}`}
                  shape="square"
                  type="button"
                  variant="outline"
                />
              }
            >
              <DotsThreeIcon
                aria-hidden
                size={20}
              />
            </DropdownMenu.Trigger>
          }
        />
        <DropdownMenu.Content>
          <DropdownMenu.LinkItem href={href}>{linkLabel}</DropdownMenu.LinkItem>
          {(kind === "rule" || item.id !== "personal") && (
            <>
              <DropdownMenu.Separator />
              <DropdownMenu.Item
                data-id={item.id}
                data-kind={kind}
                data-remove="true"
                onClick={onOpen}
                variant="danger"
              >
                Excluir {noun}
              </DropdownMenu.Item>
            </>
          )}
        </DropdownMenu.Content>
      </DropdownMenu>
    </div>
  );
}

// Row variant of OrganizationActions: every action lives in the trailing ⋯.
function OrganizationMenu({
  item,
  kind,
  href,
  linkLabel,
  onOpen,
}: {
  item: { id: string; name: string };
  kind: "rule" | "space";
  href: string;
  linkLabel: string;
  onOpen: (event: MouseEvent<HTMLElement>) => void;
}) {
  const noun = kind === "rule" ? "regra" : "grupo";
  return (
    <RowMenu
      items={[
        {
          "data-id": item.id,
          "data-kind": kind,
          icon: <PencilSimpleIcon size={16} />,
          key: "edit",
          label: `Editar ${noun}`,
          onClick: onOpen,
        },
        { href, key: "open", label: linkLabel },
        {
          "data-id": item.id,
          "data-kind": kind,
          "data-remove": "true",
          key: "remove",
          label: `Excluir ${noun}`,
          onClick: onOpen,
          separated: true,
          variant: "danger",
        },
      ]}
      label={`Ações de ${item.name}`}
    />
  );
}

function ruleTransactionsHref(
  rule: RuleSource,
  scope: URLSearchParams,
  basePath: string,
) {
  const params = new URLSearchParams({
    space: scope.get("space") ?? "personal",
    ...(scope.get("month") && { month: scope.get("month") ?? "" }),
  });
  if (!rule.filter) {
    params.set("text", rule.text);
    if (rule.accountId) {
      params.set("accountId", rule.accountId);
    }
    if (rule.direction) {
      params.set("direction", rule.direction);
    }
  }
  return `${basePath}/transactions?${params}`;
}

function ruleLinkLabel(rule: RuleSource) {
  return rule.filter ? "Ver transações do grupo" : "Ver correspondências";
}
