import {
  Badge,
  DropdownMenu,
  InlineCopyText,
  LayerCard,
  Select,
  useKumoToastManager,
} from "@cloudflare/kumo";
import { type MouseEvent, useCallback, useState } from "react";

import {
  AccountListSchema,
  type PortalResponse,
  type WorkspaceCatalog,
} from "../../contracts";
import { formatBalance } from "../money";
import { UiButton } from "../ui";
import type { createAccountApi } from "./account-api";
import { navigateWorkspace } from "./account-navigation";
import { DisclosureItem } from "./disclosure-item";
import { QuerySearch, SearchField } from "./filter-fields";
import { DeleteOrganizationItem, GroupEditor } from "./group-editor";
import { conditionFields } from "./rule-draft";
import { RuleEditor } from "./rule-editor";
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
const categoryTypes = {
  expense: "Despesa",
  income: "Entrada",
  transfer: "Transferência",
};
export function OrganizationView({
  api,
  snapshot,
  page,
}: {
  api: ReturnType<typeof createAccountApi>;
  snapshot: PortalResponse;
  page: "rules" | "groups";
}) {
  const [editor, setEditor] = useState<{
    kind: "rule" | "space";
    id?: string;
    remove?: boolean;
  } | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorSession, setEditorSession] = useState(0);
  const { add: notify } = useKumoToastManager();
  const [params] = useState(() => new URLSearchParams(location.search));
  const spaceId = params.get("space") || "personal";
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
      navigateWorkspace(new URL("/account/groups", location.origin));
      return;
    }
    resource.retry();
  }, [resource.retry, editor, spaceId, notify]);
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
        <UiButton
          disabled={!data}
          onClick={newItem}
          type="button"
          variant="primary"
        >
          {page === "rules" ? "Nova regra" : "Novo grupo"}
        </UiButton>
      </WorkspaceHeading>
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
            action={`/account/${page}`}
            activeCount={
              {
                groups: 0,
                rules: [params.get("q"), params.get("enabled")].filter(Boolean)
                  .length,
              }[page]
            }
            context={
              {
                groups: `Categorias e etiquetas: ${current?.name ?? spaceId}`,
                rules: current?.name ?? spaceId,
              }[page]
            }
            leading={
              page === "rules" && (
                <QuerySearch
                  action="/account/rules"
                  label="Buscar regra"
                  name="q"
                  params={params}
                />
              )
            }
          >
            <ScopeFields
              catalog={data}
              params={params}
              person={false}
              snapshot={snapshot}
            />
            {page === "rules" && (
              <>
                <div className="filter-wide">
                  <SearchField
                    defaultValue={params.get("q") ?? ""}
                    label="Buscar regra"
                    name="q"
                    placeholder="Nome ou trecho da descrição"
                    type="search"
                  />
                </div>
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
                    const category =
                      data.categories.find((c) => c.id === r.categoryId)
                        ?.name ?? "Categoria não identificada";
                    const account =
                      data.accounts.find((item) => item.id === r.accountId)
                        ?.name ?? "Todas as contas do grupo";
                    const movement = movementLabel(r.direction);
                    const accountLabel = account;
                    const context = r.filter
                      ? ruleConditionsText({
                          accounts: data.accounts,
                          brief: true,
                          people: snapshot.people,
                          rule: r,
                        })
                      : `Contém “${r.text}”`;
                    const href = ruleTransactionsHref(r, spaceId);
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
                                {context} → {category}
                              </span>
                              <span className="record-meta">
                                <span>Prioridade {r.priority}</span>
                              </span>
                            </>
                          }
                        >
                          <div className="record-detail">
                            {!!r.filter && (
                              <RuleConditions
                                accounts={data.accounts}
                                people={snapshot.people}
                                rule={r}
                              />
                            )}
                            <dl className="detail-list">
                              <div hidden={!!r.filter}>
                                <dt>Movimento</dt>
                                <dd>{movement}</dd>
                              </div>
                              <div hidden={!!r.filter}>
                                <dt>Conta</dt>
                                <dd>{accountLabel}</dd>
                              </div>
                              {!!r.filter && (
                                <div>
                                  <dt>Moeda das condições</dt>
                                  <dd>
                                    {r.filter.currency ?? "Todas as moedas"}
                                  </dd>
                                </div>
                              )}
                            </dl>
                            <p className="muted">
                              Classifica transações novas; o histórico é
                              preservado.
                            </p>
                            <OrganizationActions
                              href={href}
                              item={r}
                              kind="rule"
                              linkLabel={linkLabel}
                              onOpen={openItem}
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
                  Regras ativas classificam transações novas. Menor prioridade
                  vence; o histórico é preservado.
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
                            "/account/transactions",
                            new URLSearchParams({ space: s.id }),
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
                hint={String(data.categories.length)}
                title={`Categorias de ${current?.name ?? spaceId}`}
              >
                {data.categories.length ? (
                  <ul className="category-list">
                    {data.categories.map((c) => (
                      <li key={c.id}>
                        <div>
                          <strong>{c.name}</strong>
                          <small>
                            {categoryTypes[c.kind]}
                            {c.hidden ? " · Oculta" : ""}
                          </small>
                        </div>
                        <span>
                          {c.limitMinor === null
                            ? "Sem limite definido"
                            : formatBalance(
                                c.limitMinor,
                                current?.currency ?? "BRL",
                              )}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>Nenhuma categoria neste grupo.</p>
                )}
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
  api: ReturnType<typeof createAccountApi>;
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

function movementLabel(direction: "DEBIT" | "CREDIT" | null) {
  if (!direction) {
    return "Entradas e saídas";
  }
  return direction === "DEBIT" ? "Saídas" : "Entradas";
}

function ruleTransactionsHref(
  rule: {
    filter?: unknown;
    text: string;
    accountId: string | null;
    direction: string | null;
  },
  spaceId: string,
) {
  const params = new URLSearchParams({ space: spaceId });
  if (!rule.filter) {
    params.set("text", rule.text);
    if (rule.accountId) {
      params.set("accountId", rule.accountId);
    }
    if (rule.direction) {
      params.set("direction", rule.direction);
    }
  }
  return `/account/transactions?${params}`;
}

function ruleLinkLabel(rule: { filter?: unknown }) {
  return rule.filter ? "Ver transações do grupo" : "Ver correspondências";
}

function ruleConditionsText({
  rule,
  accounts,
  people,
  brief = false,
}: {
  rule: WorkspaceCatalog["rules"][number];
  accounts: { id: string; name: string; personName: string }[];
  people: { id: string; name: string }[];
  brief?: boolean;
}) {
  if (!rule.filter) {
    return "";
  }
  const operators: Record<string, string> = {
    contains: "contém",
    equals: "é",
    gte: "≥",
    lte: "≤",
    not_contains: "não contém",
    starts_with: "começa com",
  };
  const values: Record<string, string> = {
    CREDIT: "Entrada",
    DEBIT: "Saída",
    PENDING: "Pendente",
    POSTED: "Confirmada",
  };
  function label(
    condition: NonNullable<
      typeof rule.filter
    >["alternatives"][number]["conditions"][number],
  ) {
    let value = values[condition.value] ?? condition.value;
    if (condition.field === "accountId") {
      const account = accounts.find((row) => row.id === condition.value);
      value = account
        ? `${account.name} · ${account.personName}`
        : "Conta não identificada";
    }
    if (condition.field === "personId") {
      value =
        people.find((row) => row.id === condition.value)?.name ??
        "Pessoa não identificada";
    }
    if (condition.field === "amount") {
      value = formatBalance(condition.value, rule.filter?.currency ?? "BRL");
    }
    const field =
      conditionFields.find((row) => row.value === condition.field)?.label ??
      condition.field;
    return `${field} ${operators[condition.operator]} ${value}`;
  }
  if (brief) {
    const { alternatives } = rule.filter;
    const conditions = alternatives.flatMap((row) => row.conditions);
    const description = conditions.find(
      (c) => c.field === "description" && c.operator === "contains",
    );
    const direction = conditions.find(
      (c) => c.field === "direction" && c.operator === "equals",
    );
    if (
      alternatives.length === 1 &&
      description &&
      conditions.every((c) => c === description || c === direction)
    ) {
      const movement = direction
        ? movementLabel(direction.value === "DEBIT" ? "DEBIT" : "CREDIT")
        : "Transações";
      return `${movement} com “${description.value}”`;
    }
    const [first] = conditions;
    if (!first) {
      return "Condições não disponíveis";
    }
    return [
      alternatives.length > 1 ? `${alternatives.length} alternativas` : "",
      conditions.length > 1 ? `+ ${conditions.length - 1} condições` : "",
      label(first),
    ]
      .filter(Boolean)
      .join(" · ");
  }
  return rule.filter.alternatives
    .map(
      (alternative, index) =>
        `${index ? "OU: " : ""}${alternative.conditions.map(label).join(" · E ")}`,
    )
    .join("\n\n");
}
function RuleConditions(props: Parameters<typeof ruleConditionsText>[0]) {
  const text =
    ruleConditionsText(props) || `Descrição contém “${props.rule.text}”`;
  return text ? <p className="rule-condition-summary">{text}</p> : null;
}
