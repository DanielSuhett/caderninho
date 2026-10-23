import { useCallback, useState } from "react";

import {
  AccountListSchema,
  PortalQuerySchema,
  type PortalResponse,
  PortalTransactionListSchema,
  type WorkspaceCatalog,
} from "../../contracts";
import type { createAccountApi } from "./account-api";
import { TransactionList } from "./transaction-list";
import { EmptyView, ScopeFields } from "./workspace-filters";
import { dayLabel, ResourceFeedback, useResource } from "./workspace-resource";
import { FilterDrawer, WorkspaceHeading } from "./workspace-ui";

export function TransactionsView({
  api,
  snapshot,
}: {
  api: ReturnType<typeof createAccountApi>;
  snapshot: PortalResponse;
}) {
  const [params] = useState(() => new URLSearchParams(location.search));
  const spaceId = params.get("space") || "personal";
  const load = useCallback(
    async (signal: AbortSignal, fresh = false) => {
      const { query } = PortalQuerySchema.parse({
        csrf: snapshot.csrf,
        query: {
          future: params.get("future") === "on",
          limit: 50,
          order: "date_desc",
          spaceId,
          tool: "get_portal_transactions",
          ...Object.fromEntries(
            [
              "cursor",
              "from",
              "to",
              "text",
              "direction",
              "status",
              "accountId",
              "categoryId",
            ].flatMap((key) =>
              params.get(key) ? [[key, params.get(key)]] : [],
            ),
          ),
          ...(params.get("person") && { personId: params.get("person") }),
          include_ignored: params.get("ignored") === "on",
        },
      });
      const [catalog, accounts, result] = await Promise.all([
        api.catalog(spaceId, signal, fresh),
        api.query(
          { include_hidden: true, spaceId, tool: "get_accounts" },
          snapshot.csrf,
          signal,
          fresh,
        ),
        api.query(query, snapshot.csrf, signal, fresh),
      ]);
      return {
        accounts: AccountListSchema.parse(accounts).data.records,
        catalog,
        result: PortalTransactionListSchema.parse(result),
      };
    },
    [api, snapshot.csrf, spaceId, params],
  );
  const resource = useResource(load);
  const { data } = resource;
  const next = new URLSearchParams(params);
  if (data?.result.data.cursor) {
    next.set("cursor", data.result.data.cursor);
  }
  const first = new URLSearchParams(params);
  first.delete("cursor");
  const future = params.get("future") === "on";
  const switched = new URLSearchParams(first);
  if (future) {
    switched.delete("future");
  } else {
    switched.set("future", "on");
  }
  return (
    <>
      <WorkspaceHeading
        description="Lançamentos por titular, conta e categoria, na moeda de origem."
        title="Transações"
      />
      <ResourceFeedback {...resource} />
      {!!data && (
        <>
          <FilterDrawer
            action="/account/transactions"
            summary={transactionFilterSummary(
              params,
              snapshot,
              data.catalog,
              data.accounts,
            )}
          >
            <ScopeFields
              catalog={data.catalog}
              params={params}
              snapshot={snapshot}
            />
            <label className="filter-wide">
              Buscar descrição
              <input
                defaultValue={params.get("text") ?? ""}
                maxLength={240}
                name="text"
                placeholder="Ex.: mercado, aluguel, salário"
                type="search"
              />
            </label>
            <div className="advanced-filter-grid">
              <label>
                De
                <input
                  defaultValue={params.get("from") ?? ""}
                  name="from"
                  type="date"
                />
              </label>
              <label>
                Até
                <input
                  defaultValue={params.get("to") ?? ""}
                  name="to"
                  type="date"
                />
              </label>
              <label>
                Movimento
                <select
                  defaultValue={params.get("direction") ?? ""}
                  name="direction"
                >
                  <option value="">Entradas e saídas</option>
                  <option value="DEBIT">Saídas</option>
                  <option value="CREDIT">Entradas</option>
                </select>
              </label>
              <label>
                Conta
                <select
                  defaultValue={params.get("accountId") ?? ""}
                  name="accountId"
                >
                  <option value="">Todas as contas</option>
                  {data.accounts.map((a) => (
                    <option
                      key={a.id}
                      value={a.id}
                    >
                      {a.name} · {a.personName}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Categoria
                <select
                  defaultValue={params.get("categoryId") ?? ""}
                  name="categoryId"
                >
                  <option value="">Todas as categorias</option>
                  {data.catalog.categories.map((c) => (
                    <option
                      key={c.id}
                      value={c.id}
                    >
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Estado
                <select
                  defaultValue={params.get("status") ?? ""}
                  name="status"
                >
                  <option value="">Todos</option>
                  <option value="POSTED">Registradas na origem</option>
                  <option value="PENDING">Pendentes na origem</option>
                </select>
              </label>
              <label className="checkbox-label">
                <input
                  defaultChecked={params.get("ignored") === "on"}
                  name="ignored"
                  type="checkbox"
                />
                Incluir ignoradas
              </label>
            </div>
          </FilterDrawer>
          {!!data.result.partial && (
            <p
              className="notice"
              data-tone="warning"
            >
              Há dados parciais na instalação. Consulte as sincronizações antes
              de interpretar este recorte como um histórico completo.
            </p>
          )}
          <div className="results-heading">
            <h2>{future ? "Lançamentos futuros" : "Compras e lançamentos"}</h2>
            <span>
              {data.result.data.records.length} nesta página · por primeira data
            </span>
          </div>
          <a
            className="transaction-period-link"
            href={`/account/transactions?${switched}`}
          >
            {future ? "Voltar ao histórico" : "Ver lançamentos futuros"}
          </a>
          {data.result.data.records.length ? (
            <TransactionList
              accounts={data.accounts}
              categories={data.catalog.categories}
              records={data.result.data.records}
              referenceDay={data.result.data.referenceDay}
            />
          ) : (
            <EmptyView title="Nenhuma transação neste recorte">
              {future
                ? "Nenhum lançamento futuro encontrado. Volte ao histórico ou altere os filtros."
                : "Altere os filtros ou importe suas conexões na página Conexões."}
            </EmptyView>
          )}
          <div className="pagination">
            <p>Esta lista é paginada. Não representa um total financeiro.</p>
            {params.has("cursor") && (
              <a href={`/account/transactions?${first}`}>Voltar ao início</a>
            )}
            {!!data.result.data.cursor && (
              <a
                className="page-next"
                href={`/account/transactions?${next}`}
              >
                Próximos 50 itens
              </a>
            )}
          </div>
        </>
      )}
    </>
  );
}

function transactionFilterSummary(
  params: URLSearchParams,
  snapshot: PortalResponse,
  catalog: WorkspaceCatalog,
  accounts: Array<{ id: string; name: string }>,
) {
  return [
    ...(params.get("future") === "on" ? ["Lançamentos futuros"] : []),
    `Grupo: ${catalog.spaces.find((s) => s.id === (params.get("space") || "personal"))?.name ?? (params.get("space") || "personal")}`,
    `Pessoa: ${snapshot.people.find((p) => p.id === params.get("person"))?.name ?? "Todas"}`,
    ...(params.get("text") ? [`Descrição: ${params.get("text")}`] : []),
    ...(params.get("from")
      ? [`De: ${dayLabel(params.get("from") ?? "")}`]
      : []),
    ...(params.get("to") ? [`Até: ${dayLabel(params.get("to") ?? "")}`] : []),
    ...(params.get("direction")
      ? [params.get("direction") === "DEBIT" ? "Saídas" : "Entradas"]
      : []),
    ...(params.get("accountId")
      ? [
          `Conta: ${accounts.find((a) => a.id === params.get("accountId"))?.name ?? params.get("accountId")}`,
        ]
      : []),
    ...(params.get("categoryId")
      ? [
          `Categoria: ${catalog.categories.find((c) => c.id === params.get("categoryId"))?.name ?? params.get("categoryId")}`,
        ]
      : []),
    ...(params.get("status")
      ? [
          params.get("status") === "PENDING"
            ? "Pendentes na origem"
            : "Registradas na origem",
        ]
      : []),
    ...(params.get("ignored") === "on" ? ["Inclui ignoradas"] : []),
  ];
}
