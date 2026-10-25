import { Banner, Empty, Select } from "@cloudflare/kumo";
import { useCallback } from "react";

import { PortalCardsSchema, type PortalResponse } from "../../contracts";
import { localDay } from "../../domain";
import type { createAccountApi } from "./account-api";
import { navigateWorkspace } from "./account-navigation";
import { cardScope } from "./card-presentation";
import { CardsDashboard } from "./cards-dashboard";
import { selectedMonth } from "./dashboard-period";
import { PeriodPicker } from "./period-picker";
import { ScopeFields } from "./workspace-filters";
import { ResourceFeedback, useResource } from "./workspace-resource";
import {
  RefreshButton,
  WorkspaceFilters,
  WorkspaceHeading,
} from "./workspace-ui";
import "./cards.css";

export function CardsView({
  api,
  snapshot,
  basePath = "/account/cards",
}: {
  api: Pick<ReturnType<typeof createAccountApi>, "catalog" | "query">;
  snapshot: PortalResponse;
  basePath?: string;
}) {
  const params = new URLSearchParams(location.search);
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
      const result = PortalCardsSchema.parse(
        await api.query(
          {
            currency,
            month,
            spaceId,
            tool: "get_portal_cards",
            ...(personId && { personId }),
            ...(accountId && { accountId }),
            ...(cursor && { cursor }),
          },
          snapshot.csrf,
          signal,
          fresh,
        ),
      );
      return { ...result, catalog };
    },
    [
      accountId,
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
  const changeCurrency = useCallback((value: string | null) => {
    if (!value) {
      return;
    }
    const target = new URL(location.href);
    target.searchParams.set("currency", value);
    target.searchParams.delete("cursor");
    navigateWorkspace(target);
  }, []);
  const changeCard = useCallback((value: string | null) => {
    if (value === null) {
      return;
    }
    const target = new URL(location.href);
    if (value) {
      target.searchParams.set("accountId", value);
    } else {
      target.searchParams.delete("accountId");
    }
    target.searchParams.delete("cursor");
    navigateWorkspace(target);
  }, []);
  const result = resource.data;
  const data = result?.data;
  const monthHref = useCallback(
    (value: string) => {
      const target = new URLSearchParams(location.search);
      target.set("month", value);
      target.delete("cursor");
      return `${basePath}?${target}`;
    },
    [basePath],
  );
  const { hasFilters, context } = cardScope({
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
        items={currencies.map((value) => ({
          label: <span className="text-sm">{value}</span>,
          value,
        }))}
        label="Moeda"
        onValueChange={changeCurrency}
        value={data.currency}
      />
    ) : null;
  const cardControl = data?.accounts.length ? (
    <Select
      items={[
        { label: <span className="text-sm">Todos os cartões</span>, value: "" },
        ...data.accounts.map((account) => ({
          label: (
            <span className="text-sm">
              {account.name}
              {account.cardNumber ? ` · ${account.cardNumber}` : ""}
            </span>
          ),
          value: account.id,
        })),
      ]}
      label="Cartão"
      onValueChange={changeCard}
      value={accountId}
    />
  ) : null;
  const controls = (
    <div className="cards-toolbar-controls">
      {cardControl}
      {currencyControl}
    </div>
  );
  const nextParams = new URLSearchParams(location.search);
  nextParams.set("month", month);
  if (data) {
    nextParams.set("currency", data.currency);
  }
  if (data?.nextCursor) {
    nextParams.set("cursor", data.nextCursor);
  }
  return (
    <div className="cards-page">
      <WorkspaceHeading
        description="Gastos, limites e parcelas recebidas dos seus cartões."
        title="Cartões"
      >
        <div className="page-actions">
          <PeriodPicker
            month={month}
            onChange={changeMonth}
          />
          <RefreshButton
            disabled={resource.loading}
            label="Atualizar cartões"
            onClick={resource.retry}
          />
        </div>
      </WorkspaceHeading>
      <ResourceFeedback {...resource} />
      {!!data && !!result && (
        <>
          {hasFilters ? (
            <WorkspaceFilters
              action={basePath}
              activeCount={Number(!!personId) + Number(spaceId !== "personal")}
              context={context}
              leading={controls}
              showClear={!!(accountId || personId || spaceId !== "personal")}
            >
              <div className="cards-page cards-filter-fields">
                <ScopeFields
                  catalog={result.catalog}
                  compact
                  params={params}
                  person={snapshot.people.length > 1 || !!personId}
                  snapshot={snapshot}
                />
                <input
                  name="accountId"
                  type="hidden"
                  value={accountId}
                />
                <input
                  name="month"
                  type="hidden"
                  value={month}
                />
                <input
                  name="currency"
                  type="hidden"
                  value={data.currency}
                />
              </div>
            </WorkspaceFilters>
          ) : (
            <div className="filter-toolbar">
              {controls}
              <p className="filter-context">{context}</p>
            </div>
          )}
          {!!result.partial && (
            <Banner
              description="Esta visão usa somente os dados já recebidos. Confira o estado das conexões."
              title="Histórico parcial"
              variant="secondary"
            />
          )}
          {data.accounts.length ? (
            <CardsDashboard
              accountId={accountId}
              categories={result.catalog.categories}
              data={data}
              monthHref={monthHref}
              nextHref={data.nextCursor ? `${basePath}?${nextParams}` : null}
              showOwner={snapshot.people.length > 1}
            />
          ) : (
            <Empty
              contents={
                <a href="/account/connections">
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
