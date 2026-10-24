import { Banner, Input, Select } from "@cloudflare/kumo";
import { useCallback, useState } from "react";

import {
  AccountListSchema,
  PortalQuerySchema,
  type PortalResponse,
  PortalTransactionListSchema,
  type WorkspaceCatalog,
} from "../../contracts";
import { UiCheckbox } from "../ui";
import type { createAccountApi } from "./account-api";
import { CursorPagination } from "./cursor-pagination";
import { CatalogField, DateRangeFields, QuerySearch } from "./filter-fields";
import { TransactionList } from "./transaction-list";
import { EmptyView, ScopeFields } from "./workspace-filters";
import { dayLabel, ResourceFeedback, useResource } from "./workspace-resource";
import { WorkspaceFilters, WorkspaceHeading } from "./workspace-ui";

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
          <WorkspaceFilters
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
            leading={
              <QuerySearch
                action="/account/transactions"
                label="Buscar descrição"
                name="text"
                params={params}
              />
            }
          >
            <ScopeFields
              catalog={data.catalog}
              params={params}
              snapshot={snapshot}
            />
            <div className="filter-wide">
              <Input
                defaultValue={params.get("text") ?? ""}
                label="Buscar descrição"
                maxLength={240}
                name="text"
                placeholder="Ex.: mercado, aluguel, salário"
                type="search"
              />
            </div>
            <div className="advanced-filter-grid">
              <DateRangeFields
                from={params.get("from") ?? ""}
                to={params.get("to") ?? ""}
              />
              <Select
                defaultValue={params.get("direction") ?? ""}
                items={[
                  { label: "Entradas e saídas", value: "" },
                  { label: "Saídas", value: "DEBIT" },
                  { label: "Entradas", value: "CREDIT" },
                ]}
                label="Movimento"
                name="direction"
              />
              <CatalogField
                defaultValue={params.get("accountId") ?? ""}
                items={[
                  { label: "Todas as contas", value: "" },
                  ...data.accounts.map((a) => ({
                    label: `${a.name} · ${a.personName}`,
                    value: a.id,
                  })),
                ]}
                label="Conta"
                name="accountId"
              />
              <CatalogField
                defaultValue={params.get("categoryId") ?? ""}
                items={[
                  { label: "Todas as categorias", value: "" },
                  ...data.catalog.categories.map((c) => ({
                    label: c.name,
                    value: c.id,
                  })),
                ]}
                label="Categoria"
                name="categoryId"
              />
              <Select
                defaultValue={params.get("status") ?? ""}
                items={[
                  { label: "Todos", value: "" },
                  { label: "Registradas na origem", value: "POSTED" },
                  { label: "Pendentes na origem", value: "PENDING" },
                ]}
                label="Estado"
                name="status"
              />
              <div className="checkbox-label">
                <UiCheckbox
                  defaultChecked={future}
                  label="Lançamentos futuros"
                  name="future"
                />
              </div>
              <div className="checkbox-label">
                <UiCheckbox
                  defaultChecked={params.get("ignored") === "on"}
                  label="Incluir ignoradas"
                  name="ignored"
                />
              </div>
            </div>
          </WorkspaceFilters>
          {!!data.result.partial && (
            <Banner
              className="feedback"
              description={
                <>
                  Histórico parcial. <a href="/account/sync">Ver importações</a>
                </>
              }
              variant="alert"
            />
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
          <CursorPagination
            count={data.result.data.records.length}
            first={
              params.has("cursor") ? `/account/transactions?${first}` : null
            }
            next={
              data.result.data.cursor ? `/account/transactions?${next}` : null
            }
            noun="transações"
            singular="transação"
          />
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
    params.get("from") ? `Desde ${dayLabel(params.get("from") ?? "")}` : "",
    params.get("to") ? `Até ${dayLabel(params.get("to") ?? "")}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
}
