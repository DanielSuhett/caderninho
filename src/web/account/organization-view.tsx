import { type MouseEvent, useCallback, useState } from "react";

import {
  AccountListSchema,
  type PortalResponse,
  type WorkspaceCatalog,
} from "../../contracts";
import { UiButton } from "../ui";
import type { createAccountApi } from "./account-api";
import { navigateWorkspace } from "./account-navigation";
import { formatBalance } from "./dashboard-view";
import { DisclosureItem } from "./disclosure-item";
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
  FilterDrawer,
  RecordReference,
  WorkspaceDetails,
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
  const [notice, setNotice] = useState("");
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
  const closeEditor = useCallback(() => setEditor(null), []);
  const saved = useCallback(() => {
    setEditor(null);
    setNotice("Alteração salva.");
    if (editor?.remove && editor.kind === "space" && editor.id === spaceId) {
      navigateWorkspace(new URL("/account/groups", location.origin));
      return;
    }
    resource.retry();
  }, [resource.retry, editor, spaceId]);
  const newItem = useCallback(
    () => setEditor({ kind: page === "rules" ? "rule" : "space" }),
    [page],
  );
  const openItem = useCallback((event: MouseEvent<HTMLButtonElement>) => {
    const { id, kind, remove } = event.currentTarget.dataset;
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
        >
          {page === "rules" ? "Nova regra" : "Novo grupo"}
        </UiButton>
      </WorkspaceHeading>
      {!!notice && (
        <p
          className="notice"
          role="status"
        >
          {notice}
        </p>
      )}
      {!!(editor && data) &&
        (() => {
          const rule = data.rules.find((row) => row.id === editor.id);
          const space = data.spaces.find((row) => row.id === editor.id);
          if (editor.remove) {
            const item = editor.kind === "rule" ? rule : space;
            return item ? (
              <DeleteOrganizationItem
                api={api}
                close={closeEditor}
                deleted={saved}
                item={item}
                kind={editor.kind}
                snapshot={snapshot}
                spaceId={editor.kind === "space" ? item.id : spaceId}
              />
            ) : null;
          }
          if (editor.kind === "space") {
            return (
              <GroupEditor
                api={api}
                snapshot={snapshot}
                {...(space && { space })}
                close={closeEditor}
                saved={saved}
              />
            );
          }
          return (
            <RuleEditor
              accounts={data.accounts}
              api={api}
              catalog={data}
              snapshot={snapshot}
              spaceId={spaceId}
              {...(rule && { rule })}
              close={closeEditor}
              saved={saved}
            />
          );
        })()}
      <ResourceFeedback {...resource} />
      {!!data && (
        <>
          <FilterDrawer
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
          >
            <ScopeFields
              catalog={data}
              params={params}
              person={false}
              snapshot={snapshot}
            />
            {page === "rules" && (
              <>
                <label className="filter-wide">
                  Buscar regra
                  <input
                    defaultValue={params.get("q") ?? ""}
                    name="q"
                    placeholder="Nome ou trecho da descrição"
                    type="search"
                  />
                </label>
                <label>
                  Estado
                  <select
                    defaultValue={params.get("enabled") ?? ""}
                    name="enabled"
                  >
                    <option value="">Todas as regras</option>
                    <option value="true">Ativas</option>
                    <option value="false">Pausadas</option>
                  </select>
                </label>
              </>
            )}
          </FilterDrawer>
          {page === "rules" ? (
            <>
              {rules?.length ? (
                <ul
                  aria-label="Regras de classificação"
                  className="record-list"
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
                                <span
                                  className="status-label"
                                  data-tone="neutral"
                                >
                                  {r.enabled ? "Ativa" : "Pausada"}
                                </span>
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
                            <RuleConditions
                              accounts={data.accounts}
                              people={snapshot.people}
                              rule={r}
                            />
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
                              <div>
                                <dt>Categoria</dt>
                                <dd>{category}</dd>
                              </div>
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
                                  <code>{r.id}</code>
                                </dd>
                              </div>
                            </RecordReference>
                          </div>
                        </DisclosureItem>
                      </li>
                    );
                  })}
                </ul>
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
              <ul
                aria-label="Grupos"
                className="record-list"
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
                              <code>{s.id}</code>
                            </dd>
                          </div>
                        </RecordReference>
                      </div>
                    </DisclosureItem>
                  </li>
                ))}
              </ul>
              <WorkspaceDetails
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
  onOpen: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  const noun = kind === "rule" ? "regra" : "grupo";
  return (
    <div className="record-actions">
      <a href={href}>{linkLabel}</a>
      <UiButton
        aria-label={`Editar ${noun} ${item.name}`}
        data-id={item.id}
        data-kind={kind}
        onClick={onOpen}
        type="button"
        variant="ghost"
      >
        Editar
      </UiButton>
      {(kind === "rule" || item.id !== "personal") && (
        <UiButton
          aria-label={`Excluir ${noun} ${item.name}`}
          data-id={item.id}
          data-kind={kind}
          data-remove="true"
          onClick={onOpen}
          tone="danger"
          type="button"
          variant="ghost"
        >
          Excluir
        </UiButton>
      )}
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
