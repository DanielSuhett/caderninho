import {
  Badge,
  DropdownMenu,
  InlineCopyText,
  LayerCard,
  Select,
  useKumoToastManager,
} from "@cloudflare/kumo";
import { type MouseEvent, type ReactNode, useCallback, useState } from "react";

import {
  AccountListSchema,
  type PortalResponse,
  type WorkspaceCatalog,
} from "../../contracts";
import { formatBalance } from "../money";
import { UiButton } from "../ui";
import type { OrganizationApi } from "./account-api";
import { navigateWorkspace } from "./account-navigation";
import { CategoryLabel } from "./category-appearance";
import { CategoryOrganization } from "./category-editor";
import { DisclosureItem } from "./disclosure-item";
import { QuerySearch } from "./filter-fields";
import { DeleteOrganizationItem, GroupEditor } from "./group-editor";
import { RuleComposition } from "./rule-composition";
import { RuleEditor } from "./rule-editor";
import { RuleImporter } from "./rule-importer";
import { ruleSummary } from "./rule-presentation";
import { EmptyView, ScopeFields } from "./workspace-filters";
import {
  ResourceFeedback,
  scopedHref,
  useResource,
} from "./workspace-resource";
import {
  RecordReference,
  WorkspaceDetails,
  WorkspaceFilters,
  WorkspaceHeading,
} from "./workspace-ui";

const groupTypes = {
  business: "Profissional",
  family: "Família",
  personal: "Pessoal",
};
export function OrganizationView({
  api,
  snapshot,
  page,
  basePath = "/account",
  actions,
  notice,
}: {
  api: OrganizationApi;
  snapshot: PortalResponse;
  page: "rules" | "groups";
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
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorSession, setEditorSession] = useState(0);
  const { add: notify } = useKumoToastManager();
  const [params] = useState(() => new URLSearchParams(location.search));
  const spaceId = params.get("space") || "personal";
  const activeCount =
    {
      groups: 0,
      rules: [params.get("q"), params.get("enabled")].filter(Boolean).length,
    }[page] + Number(spaceId !== "personal");
  const monthField = (
    <input
      disabled={!params.has("month")}
      name="month"
      type="hidden"
      value={params.get("month") ?? ""}
    />
  );
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
        accounts: AccountListSchema.parse(accountList).data.records,
      };
    },
    [api, spaceId, snapshot.csrf],
  );
  const resource = useResource(load);
  const { data } = resource;
  const rules = data?.rules.filter(
    (r) =>
      (!params.get("q") ||
        `${r.name} ${r.text}`
          .toLocaleLowerCase("pt-BR")
          .includes((params.get("q") ?? "").toLocaleLowerCase("pt-BR"))) &&
      (!params.get("enabled") || String(r.enabled) === params.get("enabled")),
  );
  const current = data?.spaces.find((s) => s.id === spaceId);
  const closeEditor = useCallback(() => setEditorOpen(false), []);
  const saved = useCallback(() => {
    setEditorOpen(false);
    notify({ title: "Alteração salva.", variant: "success" });
    if (editor?.remove && editor.kind === "space" && editor.id === spaceId) {
      navigateWorkspace(new URL(`${basePath}/groups`, location.origin));
      return;
    }
    resource.retry();
  }, [resource.retry, editor, spaceId, notify, basePath]);
  const openImport = useCallback(() => setImporting(true), []);
  const closeImport = useCallback(() => setImporting(false), []);
  const importSaved = useCallback(() => {
    setImporting(false);
    notify({ title: "Regras importadas.", variant: "success" });
    resource.retry();
  }, [notify, resource.retry]);
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
  return (
    <>
      <WorkspaceHeading title={page === "rules" ? "Regras" : "Grupos"}>
        <div className="page-actions">
          {actions}
          {page === "rules" && basePath === "/account" && (
            <UiButton
              disabled={!data}
              onClick={openImport}
              type="button"
            >
              Importar regras
            </UiButton>
          )}
          <UiButton
            disabled={!data}
            onClick={newItem}
            type="button"
            variant="primary"
          >
            {page === "rules" ? "Nova regra" : "Novo grupo"}
          </UiButton>
        </div>
      </WorkspaceHeading>
      {notice}
      {importing && !!data && (
        <RuleImporter
          accounts={data.accounts}
          api={api}
          catalog={data}
          close={closeImport}
          csrf={snapshot.csrf}
          people={snapshot.people}
          saved={importSaved}
          spaceId={spaceId}
        />
      )}
      {!!data && (
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
      )}
      <ResourceFeedback {...resource} />
      {!!data && (
        <>
          <WorkspaceFilters
            action={`${basePath}/${page}`}
            activeCount={activeCount}
            context={
              {
                groups: `Categorias e etiquetas: ${current?.name ?? spaceId}`,
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
            {monthField}
            <ScopeFields
              catalog={data}
              compact
              params={params}
              person={false}
              snapshot={snapshot}
            />
            {page === "rules" && (
              <>
                <input
                  name="q"
                  type="hidden"
                  value={params.get("q") ?? ""}
                />
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
              </>
            )}
          </WorkspaceFilters>
          {page === "rules" ? (
            <>
              {rules?.length ? (
                <LayerCard
                  aria-label="Regras de classificação"
                  className="record-list"
                  render={<ul />}
                >
                  {rules.map((r) => {
                    const categoryAppearance = data.categories.find(
                      (c) => c.id === r.categoryId,
                    );
                    const category =
                      categoryAppearance?.name ?? "Categoria não identificada";
                    const context = ruleSummary({
                      rule: r,
                    });
                    const href = ruleTransactionsHref(r, params, basePath);
                    const linkLabel = ruleLinkLabel(r);
                    return (
                      <li key={r.id}>
                        <DisclosureItem
                          className="record-item"
                          summary={
                            <>
                              <span className="record-title">{r.name}</span>
                              <span className="record-value">
                                <Badge variant="secondary">
                                  {r.enabled ? "Ativa" : "Pausada"}
                                </Badge>
                              </span>
                              <span className="record-context rule-context">
                                {context} →{" "}
                                <CategoryLabel
                                  category={categoryAppearance}
                                  label={category}
                                />
                              </span>
                              <span className="record-meta">
                                <span>
                                  {r.pack
                                    ? `Importada (${r.pack.id}) · `
                                    : "Pessoal · "}
                                  Prioridade {r.priority}
                                </span>
                              </span>
                            </>
                          }
                        >
                          <div className="record-detail">
                            <OrganizationActions
                              href={href}
                              item={r}
                              kind="rule"
                              linkLabel={linkLabel}
                              onOpen={openItem}
                            />
                            <RuleComposition
                              accounts={data.accounts}
                              category={category}
                              categoryAppearance={categoryAppearance}
                              enabled={r.enabled}
                              people={snapshot.people}
                              rule={r}
                            />
                            <RecordReference>
                              <div>
                                <dt>Identificador da regra</dt>
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
                            </RecordReference>
                          </div>
                        </DisclosureItem>
                      </li>
                    );
                  })}
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
            </>
          ) : (
            <>
              <LayerCard
                aria-label="Grupos"
                className="record-list"
                render={<ul />}
              >
                {data.spaces.map((s) => (
                  <li key={s.id}>
                    <DisclosureItem
                      className="record-item"
                      summary={
                        <>
                          <span className="record-title">{s.name}</span>
                          <span className="record-value">{s.currency}</span>
                          <span className="record-context">
                            {s.budgetEnabled
                              ? `Orçamento: ${s.monthlyBudgetMinor === null ? "valor não definido" : formatBalance(s.monthlyBudgetMinor, s.currency)}`
                              : "Sem orçamento"}
                          </span>
                        </>
                      }
                    >
                      <div className="record-detail">
                        <dl className="detail-list">
                          <div>
                            <dt>Tipo</dt>
                            <dd>{groupTypes[s.type]}</dd>
                          </div>
                          <div>
                            <dt>Início do mês</dt>
                            <dd>Dia {s.monthStartDay}</dd>
                          </div>
                        </dl>
                        <OrganizationActions
                          href={scopedHref(
                            `${basePath}/transactions`,
                            new URLSearchParams({
                              space: s.id,
                              ...(params.get("month") && {
                                month: params.get("month") ?? "",
                              }),
                            }),
                          )}
                          item={s}
                          kind="space"
                          linkLabel={"Ver transações"}
                          onOpen={openItem}
                        />
                        <RecordReference>
                          <div>
                            <dt>Identificador do grupo</dt>
                            <dd>
                              <InlineCopyText
                                labels={{
                                  copied: "Identificador copiado",
                                  copyAction: "Copiar identificador",
                                }}
                              >
                                {s.id}
                              </InlineCopyText>
                            </dd>
                          </div>
                        </RecordReference>
                      </div>
                    </DisclosureItem>
                  </li>
                ))}
              </LayerCard>
              <WorkspaceDetails
                defaultOpen
                hint={String(
                  data.categories.filter((category) => !category.hidden).length,
                )}
                title={`Categorias de ${current?.name ?? spaceId}`}
              >
                <CategoryOrganization
                  api={api}
                  catalog={data}
                  saved={saved}
                  snapshot={snapshot}
                  spaceId={spaceId}
                />
              </WorkspaceDetails>
              <WorkspaceDetails
                defaultOpen
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
                  <p className="muted">
                    Nenhuma etiqueta cadastrada neste grupo.
                  </p>
                )}
              </WorkspaceDetails>
            </>
          )}
        </>
      )}
    </>
  );
}

function OrganizationEditors({
  api,
  close,
  data,
  editor,
  open,
  saved,
  session,
  snapshot,
  spaceId,
}: {
  api: OrganizationApi;
  close: () => void;
  data: WorkspaceCatalog & {
    accounts: {
      id: string;
      name: string;
      personId: string;
      personName: string;
    }[];
  };
  editor: { kind: "rule" | "space"; id?: string; remove?: boolean } | null;
  open: boolean;
  saved: () => void;
  session: number;
  snapshot: PortalResponse;
  spaceId: string;
}) {
  const rule = data.rules.find((row) => row.id === editor?.id);
  const space = data.spaces.find((row) => row.id === editor?.id);
  return (
    <>
      <RuleEditor
        accounts={data.accounts}
        api={api}
        catalog={data}
        close={close}
        key={`rule-${session}`}
        open={open && editor?.kind === "rule" && !editor.remove}
        {...(rule && { rule })}
        saved={saved}
        snapshot={snapshot}
        spaceId={spaceId}
      />
      <GroupEditor
        api={api}
        close={close}
        key={`group-${session}`}
        open={open && editor?.kind === "space" && !editor.remove}
        saved={saved}
        snapshot={snapshot}
        {...(space && { space })}
      />
      <DeleteOrganizationItem
        api={api}
        close={close}
        deleted={saved}
        item={(editor?.kind === "rule" ? rule : space) ?? { id: "", name: "" }}
        key={`delete-${session}`}
        kind={editor?.kind ?? "rule"}
        open={open && !!editor?.remove}
        snapshot={snapshot}
        spaceId={editor?.kind === "space" ? (editor.id ?? spaceId) : spaceId}
      />
    </>
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
      <UiButton
        aria-label={`Editar ${noun} ${item.name}`}
        data-id={item.id}
        data-kind={kind}
        onClick={onOpen}
        type="button"
        variant="secondary"
      >
        Editar
      </UiButton>
      <DropdownMenu>
        <DropdownMenu.Trigger
          aria-label={`Mais ações de ${item.name}`}
          render={
            <UiButton
              type="button"
              variant="ghost"
            />
          }
        >
          Mais ações
        </DropdownMenu.Trigger>
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

function ruleTransactionsHref(
  rule: {
    filter?: unknown;
    text: string;
    accountId: string | null;
    direction: string | null;
  },
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

function ruleLinkLabel(rule: { filter?: unknown }) {
  return rule.filter ? "Ver transações do grupo" : "Ver correspondências";
}
