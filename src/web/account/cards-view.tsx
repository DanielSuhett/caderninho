import { Banner } from "@cloudflare/kumo/components/banner";
import { Empty } from "@cloudflare/kumo/components/empty";
import { Select } from "@cloudflare/kumo/components/select";
import { useCallback, useState } from "react";

import type { PortalResponse } from "../../contracts";
import { localDay } from "../../domain";
import type { createAccountApi } from "./account-api";
import { AccountIdentity } from "./account-identity";
import { navigateWorkspace, workspaceHref } from "./account-navigation";
import { CardsWithLimitEditor } from "./card-limit-editor";
import { cardScope } from "./card-presentation";
import { selectedMonth } from "./dashboard-period";
import { identityParameters } from "./identity-filters";
import { PeriodPicker } from "./period-picker";
import { PersonStack } from "./person-identity";
import { ScopeFields } from "./workspace-filters";
import { ResourceFeedback, useResource } from "./workspace-resource";
import { WorkspaceFilters, WorkspaceHeading } from "./workspace-ui";
import "./cards.css";

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
          ...(personId && { personId }),
          ...identityParameters(params),
          ...(accountId && { accountId }),
          ...(cursor && { cursor }),
        },
        snapshot.csrf,
        signal,
        fresh,
      );
      return { ...result, catalog };
    },
    [
      accountId,
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
  const resource = useResource(load);
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
  const cardControl = data?.accounts.length ? (
    <Select
      className="w-full"
      defaultValue={accountId}
      items={[
        { label: <span className="text-sm">Todos os cartões</span>, value: "" },
        ...data.accounts.map((account) => ({
          label: (
            <AccountIdentity
              account={{
                ...account,
                name: `${account.name}${account.cardNumber ? ` · ${account.cardNumber}` : ""}`,
                type: "CREDIT",
              }}
              person={
                !personId && snapshot.people.length > 1
                  ? { id: account.personId, name: account.personName }
                  : undefined
              }
            />
          ),
          value: account.id,
        })),
      ]}
      label="Cartão"
      name="accountId"
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
  const filterChoices = [
    cardControl,
    currencyControl,
    snapshot.people.length > 1,
    (result?.catalog.spaces.length ?? 0) > 1,
    accountId,
    personId,
    spaceId !== "personal",
  ].some(Boolean);
  const filters = filterChoices && data && result && (
    <WorkspaceFilters
      action={basePath}
      activeCount={
        Number(!!personId) +
        Number(!!accountId) +
        Number(spaceId !== "personal")
      }
      context={context}
      identities={data.accounts}
      identity={
        <PersonStack
          people={snapshot.people}
          personId={personId}
        />
      }
      showClear={!!(accountId || personId || spaceId !== "personal")}
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
              accountId={accountId}
              api={api}
              categories={result.catalog.categories}
              data={data}
              nextHref={data.nextCursor ? `${basePath}?${nextParams}` : null}
              revision={result.revision}
              saved={resource.retry}
              showOwner={!personId && snapshot.people.length > 1}
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
