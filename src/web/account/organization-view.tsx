import { useCallback, useState } from "react";

import type { PortalResponse } from "../../contracts";
import type { createAccountApi } from "./account-api";
import { formatBalance } from "./dashboard-view";
import { DisclosureItem } from "./disclosure-item";
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
  const [params] = useState(() => new URLSearchParams(location.search));
  const spaceId = params.get("space") || "personal";
  const load = useCallback(
    (signal: AbortSignal, fresh = false) => api.catalog(spaceId, signal, fresh),
    [api, spaceId],
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
  return (
    <>
      <WorkspaceHeading
        description={
          page === "rules"
            ? "Condições de classificação. Crie, altere e aplique pelo assistente."
            : "Espaços para organizar o dinheiro. A titularidade continua ligada à pessoa."
        }
        title={page === "rules" ? "Regras" : "Grupos"}
      />
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
                As regras pertencem ao grupo e podem abranger várias pessoas. A
                aplicação depende de uma ação explícita pelo assistente.
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
                    const account = r.accountId
                      ? (snapshot.connections
                          .flatMap((c) => Object.entries(c.accounts))
                          .find(([id]) => id === r.accountId)?.[1].name ??
                        "Conta não identificada")
                      : "Todas as contas do grupo";
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
                                Contém “{r.text}” · {category}
                              </span>
                              <span className="record-meta">
                                <span>Prioridade {r.priority}</span>
                                <span>{movementLabel(r.direction)}</span>
                                <span>{account}</span>
                              </span>
                            </>
                          }
                        >
                          <div className="record-detail">
                            <p>
                              Quando a descrição contém{" "}
                              <strong>“{r.text}”</strong>, classificar como{" "}
                              <strong>{category}</strong>.
                            </p>
                            <dl className="detail-list">
                              <div>
                                <dt>Movimento</dt>
                                <dd>{movementLabel(r.direction)}</dd>
                              </div>
                              <div>
                                <dt>Conta</dt>
                                <dd>{account}</dd>
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
                            <a
                              href={`/account/transactions?${new URLSearchParams({ space: spaceId, text: r.text, ...(r.accountId && { accountId: r.accountId }), ...(r.direction && { direction: r.direction }) })}`}
                            >
                              Ver lançamentos com esta condição
                            </a>
                          </div>
                        </DisclosureItem>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <EmptyView title="Nenhuma regra encontrada">
                  Você pode pedir ao assistente para criar uma regra neste
                  grupo. Ela aparecerá aqui após atualizar a página.
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
