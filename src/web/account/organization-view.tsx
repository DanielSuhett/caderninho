import { useCallback, useState } from "react";

import type { PortalResponse } from "../../contracts";
import type { createAccountApi } from "./account-api";
import { formatBalance } from "./dashboard-view";
import { EmptyView, FilterActions, ScopeFields } from "./workspace-filters";
import {
  ResourceFeedback,
  scopedHref,
  useResource,
} from "./workspace-resource";

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
    (signal: AbortSignal) => api.catalog(spaceId, signal),
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
      <header className="workspace-heading">
        <p className="eyebrow">Organização do planejamento</p>
        <h1>{page === "rules" ? "Regras" : "Grupos"}</h1>
        <p>
          {page === "rules"
            ? "Entenda quais condições direcionam a classificação dos lançamentos. Alterações e aplicação das regras continuam disponíveis pelo assistente."
            : "Grupos são os espaços de planejamento. Uma pessoa identifica o titular; um grupo organiza o uso do dinheiro."}
        </p>
      </header>
      <ResourceFeedback {...resource} />
      {!!data && (
        <>
          <form
            action={`/account/${page}`}
            className="workspace-filters"
            method="get"
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
            <FilterActions />
          </form>
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
                <div className="rule-list">
                  {rules.map((r) => (
                    <article
                      className="rule-row"
                      key={r.id}
                    >
                      <div className="rule-top">
                        <h3>{r.name}</h3>
                        <span className="status-label">
                          {r.enabled ? "Ativa" : "Pausada"} · prioridade{" "}
                          {r.priority}
                        </span>
                      </div>
                      <p>
                        Quando a descrição contém <strong>“{r.text}”</strong>,
                        classificar como{" "}
                        <strong>
                          {data.categories.find((c) => c.id === r.categoryId)
                            ?.name ?? r.categoryId}
                        </strong>
                        .
                      </p>
                      <dl className="detail-list">
                        <div>
                          <dt>Movimento</dt>
                          <dd>{movementLabel(r.direction)}</dd>
                        </div>
                        <div>
                          <dt>Conta</dt>
                          <dd>
                            {r.accountId
                              ? (Object.values(
                                  snapshot.connections.flatMap((c) =>
                                    Object.entries(c.accounts),
                                  ),
                                ).find(([id]) => id === r.accountId)?.[1]
                                  ?.name ?? r.accountId)
                              : "Todas as contas do grupo"}
                          </dd>
                        </div>
                      </dl>
                      <a
                        href={`/account/transactions?${new URLSearchParams({ space: spaceId, text: r.text, ...(r.accountId && { accountId: r.accountId }), ...(r.direction && { direction: r.direction }) })}`}
                      >
                        Ver lançamentos com esta condição
                      </a>
                    </article>
                  ))}
                </div>
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
              <div className="group-grid">
                {data.spaces.map((s) => (
                  <article
                    className="group-card"
                    key={s.id}
                  >
                    <span className="muted">{groupTypes[s.type]}</span>
                    <h3>{s.name}</h3>
                    <p>
                      {s.currency} · mês começa no dia {s.monthStartDay}
                    </p>
                    <p>
                      {s.budgetEnabled
                        ? `Orçamento: ${formatBalance(s.monthlyBudgetMinor, s.currency)}`
                        : "Orçamento desativado"}
                    </p>
                    <a
                      href={scopedHref(
                        "/account/transactions",
                        new URLSearchParams({ space: s.id }),
                      )}
                    >
                      Ver transações de {s.name}
                    </a>
                  </article>
                ))}
              </div>
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
