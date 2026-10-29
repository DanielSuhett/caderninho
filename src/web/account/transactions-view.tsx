import { Banner } from "@cloudflare/kumo/components/banner";
import { Link } from "@cloudflare/kumo/components/link";
import { useCallback, useState } from "react";

import type {
  PortalQueryResults,
  PortalResponse,
  WorkspaceCatalog,
} from "../../contracts";
import type { createAccountApi } from "./account-api";
import { workspaceHref } from "./account-navigation";
import { CursorPagination } from "./cursor-pagination";
import { deferred } from "./deferred";
import { transactionRequests } from "./page-requests";
import { PersonStack } from "./person-identity";
import { QuerySearch } from "./query-search";
import { createViewCache } from "./read-cache";
import {
  CategorizationGuide,
  TransactionTabs,
} from "./transaction-categorization";
import { TransactionEditing } from "./transaction-editing";
import { TransactionList } from "./transaction-list";
import { EmptyView } from "./workspace-filters";
import { dayLabel, ResourceFeedback, useResource } from "./workspace-resource";
import { WorkspaceFilters, WorkspaceHeading } from "./workspace-ui";

const TransactionFilterFields = deferred(
  async () =>
    (await import("./transaction-filter-fields")).TransactionFilterFields,
);
const views = createViewCache<{
  accounts: PortalQueryResults["get_accounts"]["data"]["records"];
  catalog: WorkspaceCatalog;
  result: PortalQueryResults["get_portal_transactions"];
}>();

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
      const requests = transactionRequests(params);
      const [catalog, accounts, result] = await Promise.all([
        api.catalog(requests.spaceId, signal, fresh),
        api.query(requests.accounts, snapshot.csrf, signal, fresh),
        api.query(requests.transactions, snapshot.csrf, signal, fresh),
      ]);
      return {
        accounts: accounts.data.records,
        catalog,
        result,
      };
    },
    [api, snapshot.csrf, params],
  );
  const resource = useResource(load, views);
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
      <TransactionTabs
        basePath={workspaceHref("/account/transactions")}
        params={params}
        uncategorizedCount={data?.result.data.uncategorizedCount}
      />
      <ResourceFeedback {...resource} />
      {!!data && !!presentation && (
        <TransactionEditing
          accounts={data.accounts}
          api={api}
          catalog={data.catalog}
          revision={data.result.data.revision}
          saved={resource.retry}
          snapshot={snapshot}
          spaceId={spaceId}
        >
          <WorkspaceFilters
            action={
              params.get("uncategorized") === "on"
                ? workspaceHref("/account/transactions?uncategorized=on")
                : workspaceHref("/account/transactions")
            }
            activeCount={presentation.activeCount}
            context={presentation.context}
            identities={data.accounts}
            identity={
              <PersonStack
                people={snapshot.people}
                personId={params.get("person") ?? ""}
              />
            }
            leading={
              <QuerySearch
                action={workspaceHref("/account/transactions")}
                compact
                label="Buscar transação"
                name="text"
                params={params}
              />
            }
            showClear={presentation.activeCount > 0 || spaceId !== "personal"}
          >
            <TransactionFilterFields
              accounts={data.accounts}
              catalog={data.catalog}
              multiplePeople={presentation.multiplePeople}
              params={params}
              showOwner={showOwner}
              snapshot={snapshot}
            />
          </WorkspaceFilters>
          {!!data.result.partial && (
            <Banner
              className="feedback"
              description={
                <>
                  Histórico parcial.{" "}
                  <Link
                    href={workspaceHref("/account/connections")}
                    variant="current"
                  >
                    Ver importações
                  </Link>
                </>
              }
              variant="secondary"
            />
          )}
          {params.get("uncategorized") === "on" && (
            <CategorizationGuide
              categories={data.catalog.categories}
              params={params}
              records={data.result.data.records}
            />
          )}
          {data.result.data.records.length ? (
            <TransactionList
              accounts={data.accounts}
              categories={data.catalog.categories}
              records={data.result.data.records}
              referenceDay={data.result.data.referenceDay}
              showOwner={showOwner}
            />
          ) : (
            <EmptyView
              title={
                params.get("uncategorized") === "on"
                  ? "Nenhuma transação sem categoria neste recorte"
                  : "Nenhuma transação neste recorte"
              }
            >
              {future
                ? "Nenhum lançamento futuro encontrado. Volte ao histórico ou altere os filtros."
                : "Altere os filtros ou importe seus bancos em Pessoas."}
            </EmptyView>
          )}
          <CursorPagination
            first={
              params.has("cursor")
                ? workspaceHref(`/account/transactions?${first}`)
                : null
            }
            next={
              data.result.data.cursor
                ? workspaceHref(`/account/transactions?${next}`)
                : null
            }
          />
        </TransactionEditing>
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
