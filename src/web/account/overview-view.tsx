import { Banner } from "@cloudflare/kumo/components/banner";
import { useCallback, useState } from "react";

import type {
  PortalQueryResults,
  PortalResponse,
  WorkspaceCatalog,
} from "../../contracts";
import { tryCatch } from "../../shared";
import type { AccountApi } from "./account-api";
import { navigateWorkspace, workspaceHref } from "./account-navigation";
import { monthPeriod, selectedMonth } from "./dashboard-period";
import { FieldSelect } from "./field-select";
import { FinancialDashboard } from "./financial-dashboard";
import { displayCurrency } from "./financial-presentation";
import {
  identityParameters,
  overviewRequests,
  referenceDay,
} from "./page-requests";
import { PeriodPicker } from "./period-picker";
import { PersonStack } from "./person-identity";
import { createViewCache } from "./read-cache";
import { SetupProgress } from "./setup-progress";
import { TransactionEditing } from "./transaction-editing";
import { ScopeFields } from "./workspace-filters";
import {
  ResourceFeedback,
  ResourcePlaceholder,
  usePageResource,
} from "./workspace-resource";
import { WorkspaceFilters, WorkspaceHeading } from "./workspace-ui";

interface OverviewData {
  catalog: WorkspaceCatalog;
  monthly: PortalQueryResults["generate_chart"]["data"] | null;
  observedAt: string;
  overview: PortalQueryResults["get_overview"]["data"];
  recent: PortalQueryResults["get_portal_transactions"];
}
const views = createViewCache<OverviewData>();

export function OverviewView({
  api,
  snapshot,
}: {
  api: AccountApi;
  snapshot: PortalResponse;
}) {
  const [params] = useState(() => new URLSearchParams(location.search));
  const day = referenceDay();
  const month = selectedMonth(params.get("month"), day);
  const period = monthPeriod(month);
  const spaceId = params.get("space") || "personal";
  const personId = params.get("person") ?? "";
  const load = useCallback(
    async (
      source: AccountApi,
      signal: AbortSignal,
      fresh = false,
    ): Promise<OverviewData> => {
      const requests = overviewRequests(params, day);
      const [overview, monthly, catalog, recent] = await Promise.all([
        source.query(requests.overview, snapshot.csrf, signal, fresh),
        tryCatch(() =>
          source.query(requests.chart, snapshot.csrf, signal, fresh),
        ),
        source.catalog(requests.spaceId, signal, fresh),
        source.query(requests.recent, snapshot.csrf, signal, fresh),
      ]);
      return {
        catalog,
        monthly: monthly.error ? null : monthly.data.data,
        observedAt: new Date().toISOString(),
        overview: overview.data,
        recent,
      };
    },
    [day, snapshot.csrf, params],
  );
  const resource = usePageResource(api, load, views);
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
    <ResourcePlaceholder active={resource.placeholder}>
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
        <FieldSelect
          className="w-full"
          defaultValue={currency}
          items={currencies.map((value) => ({ label: value, value }))}
          label="Moeda"
          name="currency"
        />
      </WorkspaceFilters>
    </ResourcePlaceholder>
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
        <ResourcePlaceholder active={resource.placeholder}>
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
        </ResourcePlaceholder>
      )}
    </>
  );
}
