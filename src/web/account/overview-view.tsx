import { Banner } from "@cloudflare/kumo/components/banner";
import { Select } from "@cloudflare/kumo/components/select";
import { useCallback, useState } from "react";

import type { PortalResponse } from "../../contracts";
import { ChartType, SpendingGroupBy, TransactionOrder } from "../../domain";
import { tryCatch } from "../../shared";
import type { createAccountApi } from "./account-api";
import { navigateWorkspace } from "./account-navigation";
import { monthPeriod, selectedMonth, shiftMonth } from "./dashboard-period";
import { FinancialDashboard } from "./financial-dashboard";
import { displayCurrency } from "./financial-presentation";
import { PeriodPicker } from "./period-picker";
import { ScopeFields } from "./workspace-filters";
import {
  momentLabel,
  ResourceFeedback,
  useResource,
} from "./workspace-resource";
import {
  RefreshButton,
  WorkspaceFilters,
  WorkspaceHeading,
} from "./workspace-ui";

export function OverviewView({
  api,
  snapshot,
}: {
  api: ReturnType<typeof createAccountApi>;
  snapshot: PortalResponse;
}) {
  const [params] = useState(() => new URLSearchParams(location.search));
  const referenceDay = new Date().toLocaleDateString("sv-SE", {
    timeZone: "America/Sao_Paulo",
  });
  const month = selectedMonth(params.get("month"), referenceDay);
  const period = monthPeriod(month);
  const spaceId = params.get("space") || "personal";
  const personId = params.get("person") ?? "";
  const load = useCallback(
    async (signal: AbortSignal, fresh = false) => {
      const queryPeriod = monthPeriod(month);
      const scope = { spaceId, ...(personId && { personId }) };
      const [overview, monthly, catalog, recent] = await Promise.all([
        api.query(
          { tool: "get_overview", ...scope, ...queryPeriod },
          snapshot.csrf,
          signal,
          fresh,
        ),
        tryCatch(() =>
          api.query(
            {
              tool: "generate_chart",
              ...scope,
              from: `${shiftMonth(month, -5)}-01`,
              groupBy: SpendingGroupBy.month,
              to: queryPeriod.to,
              type: ChartType.line,
            },
            snapshot.csrf,
            signal,
            fresh,
          ),
        ),
        api.catalog(spaceId, signal, fresh),
        api.query(
          {
            tool: "get_portal_transactions",
            ...scope,
            ...queryPeriod,
            future: false,
            limit: 6,
            order: TransactionOrder.date_desc,
          },
          snapshot.csrf,
          signal,
          fresh,
        ),
      ]);
      return {
        catalog,
        monthly: monthly.error ? null : monthly.data.data,
        observedAt: new Date().toISOString(),
        overview: overview.data,
        recent,
      };
    },
    [api, month, personId, snapshot.csrf, spaceId],
  );
  const resource = useResource(load);
  const { data } = resource;
  const changeMonth = useCallback((value: string) => {
    const destination = new URL(location.href);
    destination.searchParams.set("month", value);
    destination.searchParams.delete("cursor");
    navigateWorkspace(destination);
  }, []);
  const changeCurrency = useCallback((value: string | null) => {
    if (!value) {
      return;
    }
    const destination = new URL(location.href);
    destination.searchParams.set("currency", value);
    navigateWorkspace(destination);
  }, []);
  const currencies = [
    ...new Set([
      ...(data?.overview.accounts.map((account) => account.currency) ?? []),
      ...(data?.overview.totals.map((total) => total.currency) ?? []),
    ]),
  ].sort();
  const space = data?.catalog.spaces.find((item) => item.id === spaceId);
  const currency = displayCurrency(
    params.get("currency"),
    currencies,
    space?.currency ?? "BRL",
  );
  const selectedPerson = snapshot.people.find(
    (person) => person.id === personId,
  );
  const context = [
    space?.name ?? spaceId,
    selectedPerson?.name ?? "Todas as pessoas",
    currency,
  ].join(" · ");
  const transactionsHref = `/account/transactions?${new URLSearchParams({ space: spaceId, ...period, ...(personId && { person: personId }) })}`;
  return (
    <>
      <WorkspaceHeading title="Visão geral">
        <div className="page-actions">
          <PeriodPicker
            month={month}
            onChange={changeMonth}
          />
          <RefreshButton
            disabled={resource.loading}
            label="Atualizar resumo financeiro"
            onClick={resource.retry}
          />
        </div>
      </WorkspaceHeading>
      <ResourceFeedback {...resource} />
      {!!data && (
        <>
          <WorkspaceFilters
            action="/account"
            context={context}
            leading={
              currencies.length > 1 && (
                <Select
                  items={currencies.map((value) => ({ label: value, value }))}
                  label="Moeda"
                  onValueChange={changeCurrency}
                  value={currency}
                />
              )
            }
          >
            <ScopeFields
              catalog={data.catalog}
              params={params}
              snapshot={snapshot}
            />
            <input
              name="month"
              type="hidden"
              value={month}
            />
            <input
              name="currency"
              type="hidden"
              value={currency}
            />
          </WorkspaceFilters>
          {!!data.overview.partial && (
            <Banner
              description={
                <span>
                  Este resumo usa os dados recebidos.{" "}
                  <a href="/account/connections">Conferir conexões</a>.
                </span>
              }
              title="Histórico parcial"
              variant="secondary"
            />
          )}
          <FinancialDashboard
            categories={data.catalog.categories}
            currency={currency}
            monthly={data.monthly}
            overview={data.overview}
            people={snapshot.people}
            records={data.recent.data.records}
            rulesHref="/account/rules"
            transactionsHref={transactionsHref}
          />
          <p className="page-updated">
            Cópia importada · consultada em {momentLabel(data.observedAt)}.
          </p>
        </>
      )}
    </>
  );
}
