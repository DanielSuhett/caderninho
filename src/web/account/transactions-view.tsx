import { Banner } from "@cloudflare/kumo/components/banner";
import { Input } from "@cloudflare/kumo/components/input";
import { Link } from "@cloudflare/kumo/components/link";
import { Select } from "@cloudflare/kumo/components/select";
import { useCallback, useState } from "react";

import {
  type PortalResponse,
  PortalTransactionQuerySchema,
  type WorkspaceCatalog,
} from "../../contracts";
import {
  TransactionDirection,
  TransactionOrder,
  TransactionStatus,
} from "../../domain";
import { UiCheckbox } from "../ui";
import type { createAccountApi } from "./account-api";
import { CursorPagination } from "./cursor-pagination";
import {
  AccountFilter,
  CatalogField,
  DateRangeFields,
  QuerySearch,
} from "./filter-fields";
import { PersonStack } from "./person-identity";
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
      const query = PortalTransactionQuerySchema.parse({
        future: params.get("future") === "on",
        limit: 50,
        order: TransactionOrder.date_desc,
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
          ].flatMap((key) => (params.get(key) ? [[key, params.get(key)]] : [])),
        ),
        ...(params.get("person") && { personId: params.get("person") }),
        include_ignored: params.get("ignored") === "on",
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
        accounts: accounts.data.records,
        catalog,
        result,
      };
    },
    [api, snapshot.csrf, spaceId, params],
  );
  const resource = useResource(load);
  const { data } = resource;
  const presentation = data
    ? transactionFilterContext({
        accounts: data.accounts,
        catalog: data.catalog,
        params,
        records: data.result.data.records,
        snapshot,
      })
    : null;
  const next = new URLSearchParams(params);
  if (data?.result.data.cursor) {
    next.set("cursor", data.result.data.cursor);
  }
  const first = new URLSearchParams(params);
  first.delete("cursor");
  const future = params.get("future") === "on";
  const showOwner = !params.get("person") && !!presentation?.multiplePeople;
  return (
    <>
      <WorkspaceHeading title="Transações" />
      <ResourceFeedback {...resource} />
      {!!data && !!presentation && (
        <>
          <WorkspaceFilters
            action="/account/transactions"
            activeCount={presentation.activeCount}
            context={presentation.context}
            identity={
              <PersonStack
                people={snapshot.people}
                personId={params.get("person") ?? ""}
              />
            }
            leading={
              <QuerySearch
                action="/account/transactions"
                compact
                label="Buscar transação"
                name="text"
                params={params}
              />
            }
            showClear={presentation.activeCount > 0 || spaceId !== "personal"}
          >
            <ScopeFields
              catalog={data.catalog}
              compact
              params={params}
              person={presentation.multiplePeople}
              snapshot={snapshot}
            />
            <div className="filter-wide">
              <Input
                defaultValue={params.get("text") ?? ""}
                label="Buscar transação"
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
                  { label: "Saídas", value: TransactionDirection.DEBIT },
                  { label: "Entradas", value: TransactionDirection.CREDIT },
                ]}
                label="Movimento"
                name="direction"
              />
              <AccountFilter
                accounts={data.accounts}
                showOwner={showOwner}
                value={params.get("accountId") ?? ""}
              />
              <CatalogField
                defaultValue={params.get("categoryId") ?? ""}
                items={[
                  { label: "Todas as categorias", value: "" },
                  ...data.catalog.categories
                    .filter(
                      (c) => !c.hidden || c.id === params.get("categoryId"),
                    )
                    .map((c) => ({
                      appearance: c,
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
                  {
                    label: "Registradas na origem",
                    value: TransactionStatus.POSTED,
                  },
                  {
                    label: "Pendentes na origem",
                    value: TransactionStatus.PENDING,
                  },
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
                  Histórico parcial.{" "}
                  <Link
                    href="/account/sync"
                    variant="current"
                  >
                    Ver importações
                  </Link>
                </>
              }
              variant="secondary"
            />
          )}
          {data.result.data.records.length ? (
            <TransactionList
              accounts={data.accounts}
              categories={data.catalog.categories}
              records={data.result.data.records}
              referenceDay={data.result.data.referenceDay}
              showAccount={presentation.showAccount}
              showOwner={showOwner}
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

function transactionFilterContext({
  params,
  snapshot,
  catalog,
  accounts,
  records,
}: {
  params: URLSearchParams;
  snapshot: PortalResponse;
  catalog: WorkspaceCatalog;
  accounts: Array<{
    id: string;
    name: string;
    personId: string;
    personName: string;
  }>;
  records: Array<{ accountId: string }>;
}) {
  const spaceId = params.get("space") || "personal";
  const multiplePeople =
    snapshot.people.length !== 1 ||
    accounts.some((a) => a.personId !== snapshot.people.at(0)?.id);
  const onlyAccount = accounts.length === 1 ? accounts.at(0) : undefined;
  const showAccount =
    !onlyAccount || records.some((row) => row.accountId !== onlyAccount.id);
  const accountContext: string[] = [];
  if (!showAccount && onlyAccount) {
    accountContext.push(onlyAccount.name);
    if (multiplePeople) {
      accountContext.push(onlyAccount.personName);
    }
  }
  const context = [
    catalog.spaces.length > 1 || spaceId !== "personal"
      ? (catalog.spaces.find((s) => s.id === spaceId)?.name ?? spaceId)
      : "",
    scopeLabel({
      fallback: accountContext.join(" · "),
      items: accounts,
      missing: "Conta indisponível",
      value: params.get("accountId"),
    }),
    scopeLabel({
      fallback:
        multiplePeople && !accountContext.length ? "Todas as pessoas" : "",
      items: snapshot.people,
      missing: "Pessoa indisponível",
      value: params.get("person"),
    }),
    params.get("future") === "on" ? "Futuros" : "",
    params.get("from") ? `Desde ${dayLabel(params.get("from") ?? "")}` : "",
    params.get("to") ? `Até ${dayLabel(params.get("to") ?? "")}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const activeCount = activeTransactionFilters(
    params,
    accounts,
    snapshot.people,
    showAccount,
  );
  return { activeCount, context, multiplePeople, showAccount };
}

function activeTransactionFilters(
  params: URLSearchParams,
  accounts: Array<{ id: string }>,
  people: Array<{ id: string }>,
  showAccount: boolean,
) {
  const filterKeys = [
    "text",
    "from",
    "to",
    "direction",
    "categoryId",
    "status",
    "future",
    "ignored",
  ];
  if (showAccount || params.get("accountId") !== accounts.at(0)?.id) {
    filterKeys.push("accountId");
  }
  if (people.length !== 1 || params.get("person") !== people.at(0)?.id) {
    filterKeys.push("person");
  }
  return filterKeys.filter((key) => params.get(key)).length;
}

function scopeLabel({
  value,
  items,
  fallback,
  missing,
}: {
  value: string | null;
  items: Array<{ id: string; name: string }>;
  fallback: string;
  missing: string;
}) {
  if (!value) {
    return fallback;
  }
  return items.find((item) => item.id === value)?.name ?? missing;
}
