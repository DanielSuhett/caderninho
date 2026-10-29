import { Banner } from "@cloudflare/kumo/components/banner";
import { Empty } from "@cloudflare/kumo/components/empty";
import { Select } from "@cloudflare/kumo/components/select";
import { useCallback, useState } from "react";

import type {
  PortalQueryResults,
  PortalResponse,
  WorkspaceCatalog,
} from "../../contracts";
import { localDay } from "../../domain";
import type { createAccountApi } from "./account-api";
import { navigateWorkspace, workspaceHref } from "./account-navigation";
import { CardFilter } from "./card-filter";
import { CardsWithLimitEditor } from "./card-limit-editor";
import {
  activeCardFilters,
  cardScope,
  focusedAccountId,
  scopeParameters,
} from "./card-presentation";
import { selectedMonth } from "./dashboard-period";
import { identityParameters } from "./page-requests";
import { PeriodPicker } from "./period-picker";
import { PersonStack } from "./person-identity";
import { createViewCache } from "./read-cache";
import { ScopeFields } from "./workspace-filters";
import { ResourceFeedback, useResource } from "./workspace-resource";
import { WorkspaceFilters, WorkspaceHeading } from "./workspace-ui";
import "./cards.css";

const views = createViewCache<
  PortalQueryResults["get_portal_cards"] & { catalog: WorkspaceCatalog }
>();

export function CardsView({
  api,
  snapshot,
  basePath = workspaceHref("/account/cards"),
}: {
  api: Pick<
    ReturnType<typeof createAccountApi>,
    "catalog" | "query" | "planning"
  >;
  snapshot: PortalResponse;
  basePath?: string;
}) {
  const [params] = useState(() => new URLSearchParams(location.search));
  const month = selectedMonth(params.get("month"), localDay(new Date()));
  const personId = params.get("person") ?? "";
  const accountId = params.get("accountId") ?? "";
  const cardId = params.get("cardId") ?? "";
  const spaceId = params.get("space") ?? "personal";
  const requestedCurrency = params.get("currency");
  const cursor = params.get("cursor");
  const load = useCallback(
    async (signal: AbortSignal, fresh: boolean) => {
      const catalog = await api.catalog(spaceId, signal, fresh);
      const currency =
        requestedCurrency ??
        catalog.spaces.find((space) => space.id === spaceId)?.currency ??
        "BRL";
      const result = await api.query(
        {
          currency,
          month,
          spaceId,
          tool: "get_portal_cards",
          ...identityParameters(params),
          ...scopeParameters({ accountId, cardId, cursor, personId }),
        },
        snapshot.csrf,
        signal,
        fresh,
      );
      return { ...result, catalog };
    },
    [
      accountId,
      cardId,
      params,
      api,
      cursor,
      month,
      personId,
      requestedCurrency,
      snapshot.csrf,
      spaceId,
    ],
  );
  const resource = useResource(load, views);
  const changeMonth = useCallback((value: string) => {
    const target = new URL(location.href);
    target.searchParams.set("month", value);
    target.searchParams.delete("cursor");
    navigateWorkspace(target);
  }, []);
  const result = resource.data;
  const data = result?.data;
  const { context } = cardScope({
    catalog: result?.catalog,
    data,
    params,
    snapshot,
  });
  const currencies = data
    ? [...new Set([...data.currencies, data.currency])]
    : [];
  const currencyControl =
    data && currencies.length > 1 ? (
      <Select
        className="w-full"
        defaultValue={data.currency}
        items={currencies.map((value) => ({
          label: <span className="text-sm">{value}</span>,
          value,
        }))}
        label="Moeda"
        name="currency"
      />
    ) : null;
  const showOwner = !personId && snapshot.people.length > 1;
  const cardControl = data?.accounts.length ? (
    <CardFilter
      accounts={data.accounts}
      cardId={cardId}
      showOwner={showOwner}
    />
  ) : null;
  const nextParams = new URLSearchParams(location.search);
  nextParams.set("month", month);
  if (data) {
    nextParams.set("currency", data.currency);
  }
  if (data?.nextCursor) {
    nextParams.set("cursor", data.nextCursor);
  }
  const activeFilters = activeCardFilters({
    accountId,
    cardId,
    personId,
    spaceId,
  });
  const filterChoices = [
    cardControl,
    currencyControl,
    snapshot.people.length > 1,
    (result?.catalog.spaces.length ?? 0) > 1,
    activeFilters,
  ].some(Boolean);
  const filters = filterChoices && data && result && (
    <WorkspaceFilters
      action={basePath}
      activeCount={activeFilters}
      context={context}
      identities={data.accounts}
      identity={
        <PersonStack
          people={snapshot.people}
          personId={personId}
        />
      }
      showClear={activeFilters > 0}
    >
      <div className="cards-page cards-filter-fields">
        <ScopeFields
          catalog={result.catalog}
          params={params}
          person={snapshot.people.length > 1 || !!personId}
          snapshot={snapshot}
        />
        {cardControl}
        {currencyControl}
        <input
          name="month"
          type="hidden"
          value={month}
        />
        {!currencyControl && (
          <input
            name="currency"
            type="hidden"
            value={data.currency}
          />
        )}
      </div>
    </WorkspaceFilters>
  );
  return (
    <div className="cards-page">
      <WorkspaceHeading
        description="Gastos, limites e parcelas recebidas dos seus cartões."
        filters={filters}
        title="Cartões"
      >
        <div className="page-actions">
          <PeriodPicker
            month={month}
            onChange={changeMonth}
          />
        </div>
      </WorkspaceHeading>
      <ResourceFeedback {...resource} />
      {!!data && !!result && (
        <>
          {!!result.partial && (
            <Banner
              description="Esta visão usa somente os dados já recebidos. Confira o estado das conexões."
              title="Histórico parcial"
              variant="secondary"
            />
          )}
          {data.accounts.length ? (
            <CardsWithLimitEditor
              accountId={focusedAccountId(data.accounts, accountId, cardId)}
              api={api}
              categories={result.catalog.categories}
              data={data}
              nextHref={data.nextCursor ? `${basePath}?${nextParams}` : null}
              revision={result.revision}
              saved={resource.retry}
              showOwner={showOwner}
              snapshot={snapshot}
              spaceId={spaceId}
            />
          ) : (
            <Empty
              contents={
                <a href={workspaceHref("/account/connections")}>
                  Confira suas conexões ou escolha outro grupo.
                </a>
              }
              size="sm"
              title="Nenhuma conta de cartão neste recorte"
            />
          )}
        </>
      )}
    </div>
  );
}
