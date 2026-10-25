import { Banner, Select } from "@cloudflare/kumo";
import { useCallback, useState } from "react";

import { InvestmentListSchema, type PortalResponse } from "../../contracts";
import { investmentPortfolio } from "../../domain";
import type { createAccountApi } from "./account-api";
import { AccountIdentity } from "./account-identity";
import { InvestorDashboard, investmentTypeNames } from "./investor-dashboard";
import { PersonStack } from "./person-identity";
import { ScopeFields } from "./workspace-filters";
import { ResourceFeedback, useResource } from "./workspace-resource";
import {
  RefreshButton,
  WorkspaceFilters,
  WorkspaceHeading,
} from "./workspace-ui";

export function InvestmentsView({
  api,
  snapshot,
  basePath = "/account/investments",
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
          { spaceId, tool: "get_investments", ...(personId && { personId }) },
          snapshot.csrf,
          signal,
          fresh,
        ),
        api.catalog(spaceId, signal, fresh),
      ]);
      return { catalog, result: InvestmentListSchema.parse(result) };
    },
    [api, snapshot.csrf, spaceId, personId],
  );
  const resource = useResource(load);
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
  return (
    <>
      <WorkspaceHeading title="Investimentos">
        <RefreshButton
          disabled={resource.loading}
          onClick={resource.retry}
        />
      </WorkspaceHeading>
      <ResourceFeedback {...resource} />
      {!!resource.data && (
        <>
          <WorkspaceFilters
            action={basePath}
            activeCount={
              [personId, type, institutionId, spaceId !== "personal"].filter(
                Boolean,
              ).length
            }
            context="Carteira do investidor"
            identity={
              <PersonStack
                people={snapshot.people}
                personId={personId}
              />
            }
            showClear={
              !!(personId || type || institutionId || spaceId !== "personal")
            }
          >
            <ScopeFields
              catalog={resource.data.catalog}
              compact
              params={params}
              snapshot={snapshot}
            />
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
            <Select
              className="w-full"
              defaultValue={currency}
              items={currencies.map((value) => ({ label: value, value }))}
              label="Moeda"
              name="currency"
            />
          </WorkspaceFilters>
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
