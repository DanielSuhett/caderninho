import { Banner } from "@cloudflare/kumo/components/banner";
import { Select } from "@cloudflare/kumo/components/select";
import { useCallback, useState } from "react";

import type {
  PortalQueryResults,
  PortalResponse,
  WorkspaceCatalog,
} from "../../contracts";
import { investmentPortfolio } from "../../domain";
import type { createAccountApi } from "./account-api";
import { AccountIdentity } from "./account-identity";
import { workspaceHref } from "./account-navigation";
import { InvestorDashboard, investmentTypeNames } from "./investor-dashboard";
import { identityParameters } from "./page-requests";
import { PersonStack } from "./person-identity";
import { createViewCache } from "./read-cache";
import { ScopeFields } from "./workspace-filters";
import { ResourceFeedback, useResource } from "./workspace-resource";
import { WorkspaceFilters, WorkspaceHeading } from "./workspace-ui";

const views = createViewCache<{
  catalog: WorkspaceCatalog;
  result: PortalQueryResults["get_investments"];
}>();

export function InvestmentsView({
  api,
  snapshot,
  basePath = workspaceHref("/account/investments"),
}: {
  api: Pick<ReturnType<typeof createAccountApi>, "query" | "catalog">;
  snapshot: PortalResponse;
  basePath?: string;
}) {
  const [params] = useState(() => new URLSearchParams(location.search));
  const personId = params.get("person") ?? "";
  const spaceId = params.get("space") ?? "personal";
  const currency = params.get("currency") ?? "BRL";
  const type = params.get("type") ?? "";
  const institutionId = params.get("institutionId") ?? "";
  const load = useCallback(
    async (signal: AbortSignal, fresh: boolean) => {
      const [result, catalog] = await Promise.all([
        api.query(
          {
            spaceId,
            tool: "get_investments",
            ...(personId && { personId }),
            ...identityParameters(params),
          },
          snapshot.csrf,
          signal,
          fresh,
        ),
        api.catalog(spaceId, signal, fresh),
      ]);
      return { catalog, result };
    },
    [api, snapshot.csrf, spaceId, personId, params],
  );
  const resource = useResource(load, views);
  const records = resource.data?.result.data.records ?? [];
  const currencies = [
    ...new Set([currency, ...records.map((row) => row.currency)]),
  ].sort();
  const institutions = new Map(
    records.flatMap((row) =>
      row.identity?.institution
        ? [[row.identity.institution.id, row.identity.institution] as const]
        : [],
    ),
  );
  const types = [...new Set(records.map((row) => row.type))].sort();
  const data = investmentPortfolio(records, {
    ...(type && { type }),
    ...(institutionId && { institutionId }),
  });
  const activeFilters = [personId, type, spaceId !== "personal"].filter(
    Boolean,
  );
  const filterChoices = [
    snapshot.people.length > 1,
    (resource.data?.catalog.spaces.length ?? 0) > 1,
    types.length > 1,
    institutions.size > 1,
    currencies.length > 1,
    personId,
    type,
    institutionId,
    spaceId !== "personal",
  ].some(Boolean);
  const filters = filterChoices && resource.data && (
    <WorkspaceFilters
      action={basePath}
      activeCount={activeFilters.length}
      context="Carteira do investidor"
      identities={records}
      identity={
        <PersonStack
          people={snapshot.people}
          personId={personId}
        />
      }
      showClear={!!activeFilters.length}
    >
      <ScopeFields
        catalog={resource.data.catalog}
        identityFilters={false}
        params={params}
        snapshot={snapshot}
      />
      {types.length > 1 || type ? (
        <Select
          className="w-full"
          defaultValue={type}
          items={[
            { label: "Todas as classes", value: "" },
            ...types.map((value) => ({
              label: investmentTypeNames[value] ?? value,
              value,
            })),
          ]}
          label="Classe"
          name="type"
        />
      ) : (
        <input
          name="type"
          type="hidden"
          value={type}
        />
      )}
      {institutions.size > 1 || institutionId ? (
        <Select
          className="w-full"
          defaultValue={institutionId}
          items={[
            { label: "Todas as instituições", value: "" },
            ...[...institutions.values()].map((institution) => ({
              label: (
                <AccountIdentity
                  account={{
                    identity: { cardBrand: null, institution },
                    name: institution.name,
                  }}
                />
              ),
              value: institution.id,
            })),
          ]}
          label="Instituição"
          name="institutionId"
        />
      ) : (
        <input
          name="institutionId"
          type="hidden"
          value={institutionId}
        />
      )}
      {currencies.length > 1 ? (
        <Select
          className="w-full"
          defaultValue={currency}
          items={currencies.map((value) => ({ label: value, value }))}
          label="Moeda"
          name="currency"
        />
      ) : (
        <input
          name="currency"
          type="hidden"
          value={currency}
        />
      )}
    </WorkspaceFilters>
  );
  return (
    <>
      <WorkspaceHeading
        filters={filters}
        title="Investimentos"
      />
      <ResourceFeedback {...resource} />
      {!!resource.data && (
        <>
          {!!resource.data.result.partial && (
            <Banner
              description="Algumas posições ainda não foram recebidas."
              title="Carteira parcial"
              variant="secondary"
            />
          )}
          <InvestorDashboard
            currency={currency}
            data={data}
            people={snapshot.people}
            showOwner={!personId}
          />
        </>
      )}
    </>
  );
}
