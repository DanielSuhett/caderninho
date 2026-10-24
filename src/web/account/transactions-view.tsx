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
import { ResourceFeedback, useResource } from "./workspace-resource";
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
  return (
    <>
      <WorkspaceHeading title="Transações" />
      <ResourceFeedback {...resource} />
      {!!data && (
        <>
          <FilterDrawer
            action="/account/transactions"
            activeCount={
              [
                "text",
                "from",
                "to",
                "direction",
                "accountId",
                "categoryId",
                "status",
                "future",
                "ignored",
              ].filter((key) => params.get(key)).length
            }
            context={transactionFilterContext(
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
                  defaultChecked={future}
                  name="future"
                  type="checkbox"
                />
                Lançamentos futuros
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
              Histórico parcial. <a href="/account/sync">Ver importações</a>
            </p>
          )}
          {data.result.data.records.length ? (
            <TransactionList
              accounts={data.accounts}
              categories={data.catalog.categories}
              records={data.result.data.records}
              referenceDay={data.result.data.referenceDay}
              showOwner={
                !params.get("person") &&
                (snapshot.people.length !== 1 ||
                  data.accounts.some(
                    (a) => a.personId !== snapshot.people.at(0)?.id,
                  ))
              }
            />
          ) : (
            <EmptyView title="Nenhuma transação neste recorte">
              {future
                ? "Nenhum lançamento futuro encontrado. Volte ao histórico ou altere os filtros."
                : "Altere os filtros ou importe suas conexões na página Conexões."}
            </EmptyView>
          )}
          <div className="pagination">
            <p>{data.result.data.records.length} nesta página</p>
            {params.has("cursor") && (
              <a href={`/account/transactions?${first}`}>Voltar ao início</a>
            )}
            {!!data.result.data.cursor && (
              <a
                className="page-next"
                href={`/account/transactions?${next}`}
              >
                Próximas
              </a>
            )}
          </div>
        </>
      )}
    </>
  );
}

function transactionFilterContext(
  params: URLSearchParams,
  snapshot: PortalResponse,
  catalog: WorkspaceCatalog,
  accounts: Array<{ personId: string }>,
) {
  const spaceId = params.get("space") || "personal";
  const person = snapshot.people.find((p) => p.id === params.get("person"));
  const multiplePeople =
    snapshot.people.length !== 1 ||
    accounts.some((a) => a.personId !== snapshot.people.at(0)?.id);
  return [
    catalog.spaces.find((s) => s.id === spaceId)?.name ?? spaceId,
    person?.name ?? (multiplePeople ? "Todas as pessoas" : ""),
    params.get("future") === "on" ? "Futuros" : "",
  ]
    .filter(Boolean)
    .join(" · ");
}
