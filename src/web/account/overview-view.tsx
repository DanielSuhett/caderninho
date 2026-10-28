import { Banner } from "@cloudflare/kumo/components/banner";
import { Select } from "@cloudflare/kumo/components/select";
import { useCallback, useState } from "react";

import type { PortalResponse } from "../../contracts";
import { ChartType, SpendingGroupBy, TransactionOrder } from "../../domain";
import { tryCatch } from "../../shared";
import type { createAccountApi } from "./account-api";
import { navigateWorkspace, workspaceHref } from "./account-navigation";
import { monthPeriod, selectedMonth, shiftMonth } from "./dashboard-period";
import { FinancialDashboard } from "./financial-dashboard";
import { displayCurrency } from "./financial-presentation";
import { identityParameters } from "./identity-filters";
import { PeriodPicker } from "./period-picker";
import { PersonStack } from "./person-identity";
import { SetupProgress } from "./setup-progress";
import { TransactionEditing } from "./transaction-editing";
import { ScopeFields } from "./workspace-filters";
import { ResourceFeedback, useResource } from "./workspace-resource";
import { WorkspaceFilters, WorkspaceHeading } from "./workspace-ui";

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
      const scope = {
        spaceId,
        ...(personId && { personId }),
        ...identityParameters(params),
      };
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
              from: `${shiftMonth(month, -23)}-01`,
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
    [api, month, personId, snapshot.csrf, spaceId, params],
  );
  const resource = useResource(load);
  const { data } = resource;
  const changeMonth = useCallback((value: string) => {
    const destination = new URL(location.href);
    destination.searchParams.set("month", value);
    destination.searchParams.delete("cursor");
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
  const transactionScope = new URLSearchParams({
    currency,
    space: spaceId,
    ...period,
    ...(personId && { person: personId }),
    ...identityParameters(params),
  });
  const transactionsHref = workspaceHref(
    `/account/transactions?${transactionScope}`,
  );
  const filters = data ? (
    <WorkspaceFilters
      action={workspaceHref("/account")}
      activeCount={Number(!!personId) + Number(spaceId !== "personal")}
      context={context}
      identities={data.overview.accounts}
      identity={
        <PersonStack
          people={snapshot.people}
          personId={personId}
        />
      }
      showClear={!!personId || spaceId !== "personal"}
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
      <Select
        className="w-full"
        defaultValue={currency}
        items={currencies.map((value) => ({ label: value, value }))}
        label="Moeda"
        name="currency"
      />
    </WorkspaceFilters>
  ) : null;
  return (
    <>
      <WorkspaceHeading
        filters={filters}
        title="Visão geral"
      >
        <div className="page-actions">
          <PeriodPicker
            month={month}
            onChange={changeMonth}
          />
        </div>
      </WorkspaceHeading>
      <SetupProgress snapshot={snapshot} />
      <ResourceFeedback {...resource} />
      {!!data && (
        <>
          {!!data.overview.partial && (
            <Banner
              description={
                <span>
                  Este resumo usa os dados recebidos.{" "}
                  <a href={workspaceHref("/account/connections")}>
                    Conferir conexões
                  </a>
                  .
                </span>
              }
              title="Histórico parcial"
              variant="secondary"
            />
          )}
          <TransactionEditing
            accounts={data.overview.accounts}
            api={api}
            catalog={data.catalog}
            revision={data.recent.data.revision}
            saved={resource.retry}
            snapshot={snapshot}
            spaceId={spaceId}
          >
            <FinancialDashboard
              categories={data.catalog.categories}
              currency={currency}
              monthly={data.monthly}
              overview={data.overview}
              people={snapshot.people}
              records={data.recent.data.records}
              showOwner={!personId}
              transactionsHref={transactionsHref}
            />
          </TransactionEditing>
        </>
      )}
    </>
  );
}
