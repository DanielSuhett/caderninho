import { useCallback, useState } from "react";

import {
  AccountListSchema,
  PortalQuerySchema,
  type PortalResponse,
  TransactionListSchema,
  type WorkspaceCatalog,
} from "../../contracts";
import type { createAccountApi } from "./account-api";
import { formatBalance } from "./dashboard-view";
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
    async (signal: AbortSignal) => {
      const { query } = PortalQuerySchema.parse({
        csrf: snapshot.csrf,
        query: {
          limit: 50,
          order: "date_desc",
          spaceId,
          tool: "get_transactions",
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
        api.catalog(spaceId, signal),
        api.query(
          { include_hidden: true, spaceId, tool: "get_accounts" },
          snapshot.csrf,
          signal,
        ),
        api.query(query, snapshot.csrf, signal),
      ]);
      return {
        accounts: AccountListSchema.parse(accounts).data.records,
        catalog,
        result: TransactionListSchema.parse(result),
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
                  <option value="POSTED">Confirmadas</option>
                  <option value="PENDING">Pendentes</option>
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
            <h2>Lançamentos</h2>
            <span>
              {data.result.data.records.length} nesta página · mais recentes
              primeiro
            </span>
          </div>
          {data.result.data.records.length ? (
            <div className="ledger-wrap">
              <table className="ledger">
                <caption className="sr-only">
                  Transações do grupo e filtros selecionados
                </caption>
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Descrição e conta</th>
                    <th>Pessoa</th>
                    <th>Categoria</th>
                    <th>Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {data.result.data.records.map((row) => (
                    <tr key={row.id}>
                      <td data-label="Data">
                        {dayLabel(row.date)}
                        <small>
                          {row.status === "PENDING" ? "Pendente" : "Confirmada"}
                        </small>
                      </td>
                      <td data-label="Descrição">
                        <strong>{row.description || "Sem descrição"}</strong>
                        <small>
                          {data.accounts.find((a) => a.id === row.accountId)
                            ?.name ?? row.accountId}
                        </small>
                        <details className="row-details">
                          <summary>Detalhes</summary>
                          <p>
                            {row.manual
                              ? "Lançamento manual"
                              : "Importado da origem"}
                            {row.ignored ? " · Ignorado nas análises" : ""}
                          </p>
                          <code>{row.id}</code>
                        </details>
                      </td>
                      <td data-label="Pessoa">{row.personName}</td>
                      <td data-label="Categoria">
                        {data.catalog.categories.find(
                          (c) => c.id === row.category,
                        )?.name ??
                          row.category ??
                          "Sem categoria"}
                      </td>
                      <td
                        className="money"
                        data-label="Valor"
                      >
                        {formatBalance(row.amountMinor, row.currency)}
                        <small>
                          {row.direction === "DEBIT" ? "Saída" : "Entrada"}
                        </small>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyView title="Nenhuma transação neste recorte">
              Altere os filtros ou importe suas conexões na página Conexões.
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
                Próximas 50 transações
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
      ? [params.get("status") === "PENDING" ? "Pendentes" : "Confirmadas"]
      : []),
    ...(params.get("ignored") === "on" ? ["Inclui ignoradas"] : []),
  ];
}
