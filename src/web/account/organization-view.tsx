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
import { FilterDrawer, WorkspaceHeading } from "./workspace-ui";

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
    setNotice("Alteração salva. O histórico financeiro foi preservado.");
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
      <WorkspaceHeading
        description={
          page === "rules"
            ? "Classificação por condições, com prévia antes de salvar."
            : "Espaços para organizar o dinheiro. A titularidade continua ligada à pessoa."
        }
        title={page === "rules" ? "Regras" : "Grupos"}
      >
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
            summary={organizationFilterSummary(
              params,
              current?.name ?? spaceId,
              page,
            )}
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
              <div className="results-heading">
                <h2>Regras de {current?.name}</h2>
                <span>
                  {rules?.length ?? 0} regras · menor prioridade primeiro
                </span>
              </div>
              <p className="muted">
                As regras pertencem ao grupo e podem abranger várias pessoas.
                Salvar não reclassifica transações existentes. Regras ativas
                valem nas próximas importações.
              </p>
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
                      ? `${r.filter.alternatives.length} alternativa(s) de condições`
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
                              <span className="record-context">
                                {context} · {category}
                              </span>
                              <span className="record-meta">
                                <span>Prioridade {r.priority}</span>
                                <RuleScope
                                  account={accountLabel}
                                  movement={movement}
                                  rule={r}
                                />
                              </span>
                            </>
                          }
                        >
                          <div className="record-detail">
                            <div className="record-actions">
                              <UiButton
                                data-id={r.id}
                                data-kind="rule"
                                onClick={openItem}
                                type="button"
                                variant="secondary"
                              >
                                Editar regra
                              </UiButton>
                              <UiButton
                                data-id={r.id}
                                data-kind="rule"
                                data-remove="true"
                                onClick={openItem}
                                tone="danger"
                                type="button"
                                variant="secondary"
                              >
                                Excluir regra
                              </UiButton>
                            </div>
                            <p>
                              Quando as condições da regra corresponderem,
                              classificar como <strong>{category}</strong>.
                            </p>
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
                              <div>
                                <dt>Categoria</dt>
                                <dd>{category}</dd>
                              </div>
                              <div>
                                <dt>Identificador da regra</dt>
                                <dd>
                                  <code>{r.id}</code>
                                </dd>
                              </div>
                            </dl>
                            <a href={href}>{linkLabel}</a>
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
            </>
          ) : (
            <>
              <div className="results-heading">
                <h2>Seus grupos</h2>
                <span>{data.spaces.length} espaços de planejamento</span>
              </div>
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
                          <span className="record-value">
                            <span
                              className="status-label"
                              data-tone="neutral"
                            >
                              {groupTypes[s.type]}
                            </span>
                          </span>
                          <span className="record-context">
                            {s.budgetEnabled
                              ? `Orçamento: ${s.monthlyBudgetMinor === null ? "valor não definido" : formatBalance(s.monthlyBudgetMinor, s.currency)}`
                              : "Orçamento desativado"}
                          </span>
                          <span className="record-meta">
                            <span>{s.currency}</span>
                            <span>Mês começa no dia {s.monthStartDay}</span>
                          </span>
                        </>
                      }
                    >
                      <div className="record-detail">
                        <div className="record-actions">
                          <UiButton
                            data-id={s.id}
                            data-kind="space"
                            onClick={openItem}
                            type="button"
                            variant="secondary"
                          >
                            Editar grupo
                          </UiButton>
                          <UiButton
                            data-id={s.id}
                            data-kind="space"
                            data-remove="true"
                            onClick={openItem}
                            tone="danger"
                            type="button"
                            variant="secondary"
                          >
                            Excluir grupo
                          </UiButton>
                        </div>
                        <dl className="detail-list">
                          <div>
                            <dt>Moeda do grupo</dt>
                            <dd>{s.currency}</dd>
                          </div>
                          <div>
                            <dt>Início do mês</dt>
                            <dd>Dia {s.monthStartDay}</dd>
                          </div>
                          <div>
                            <dt>Orçamento</dt>
                            <dd>
                              {s.budgetEnabled ? "Ativado" : "Desativado"}
                            </dd>
                          </div>
                          <div>
                            <dt>Identificador do grupo</dt>
                            <dd>
                              <code>{s.id}</code>
                            </dd>
                          </div>
                        </dl>
                        <a
                          href={scopedHref(
                            "/account/transactions",
                            new URLSearchParams({ space: s.id }),
                          )}
                        >
                          Ver transações de {s.name}
                        </a>
                      </div>
                    </DisclosureItem>
                  </li>
                ))}
              </ul>
              <section aria-labelledby="categories-title">
                <div className="results-heading">
                  <h2 id="categories-title">Categorias de {current?.name}</h2>
                  <span>{data.categories.length} categorias</span>
                </div>
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
              </section>
              <section aria-labelledby="tags-title">
                <h2 id="tags-title">Etiquetas</h2>
                <p>
                  Marcadores adicionais para pesquisar lançamentos sem mudar sua
                  categoria.
                </p>
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
              </section>
            </>
          )}
        </>
      )}
    </>
  );
}

function movementLabel(direction: "DEBIT" | "CREDIT" | null) {
  if (!direction) {
    return "Entradas e saídas";
  }
  return direction === "DEBIT" ? "Saídas" : "Entradas";
}

function organizationFilterSummary(
  params: URLSearchParams,
  group: string,
  page: "rules" | "groups",
) {
  const summary = [`Grupo: ${group}`];
  if (page === "groups") {
    return summary;
  }
  const search = params.get("q");
  if (search) {
    summary.push(`Busca: ${search}`);
  }
  const enabled = params.get("enabled");
  if (enabled) {
    summary.push(enabled === "true" ? "Ativas" : "Pausadas");
  }
  return summary;
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
  return rule.filter
    ? "Ver todas as transações do grupo"
    : "Ver lançamentos com esta condição";
}

function RuleScope({
  rule,
  movement,
  account,
}: {
  rule: WorkspaceCatalog["rules"][number];
  movement: string;
  account: string;
}) {
  if (rule.filter) {
    return <span>{rule.filter.currency ?? "Todas as moedas"}</span>;
  }
  return (
    <>
      <span>{movement}</span>
      <span>{account}</span>
    </>
  );
}
function RuleConditions({
  rule,
  accounts,
  people,
}: {
  rule: WorkspaceCatalog["rules"][number];
  accounts: { id: string; name: string; personName: string }[];
  people: { id: string; name: string }[];
}) {
  if (!rule.filter) {
    return null;
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
  return (
    <p className="rule-condition-summary">
      {rule.filter.alternatives
        .map(
          (alternative, index) =>
            `${index ? "OU: " : "Todas: "}${alternative.conditions.map(label).join(" · E ")}`,
        )
        .join("\n\n")}
    </p>
  );
}
