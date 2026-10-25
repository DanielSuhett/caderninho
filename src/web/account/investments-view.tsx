import { Select } from "@cloudflare/kumo";
import { useCallback, useState } from "react";

import {
  CardCommitmentsResponseSchema,
  type PortalResponse,
} from "../../contracts";
import type { createAccountApi } from "./account-api";
import { navigateWorkspace } from "./account-navigation";
import { CardCommitmentsPanel } from "./card-commitments-panel";
import { selectedMonth } from "./dashboard-period";
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

export function InvestmentsView({
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
  const spaceId = params.get("space") || "personal";
  const personId = params.get("person") ?? "";
  const load = useCallback(
    async (signal: AbortSignal, fresh = false) => {
      const [result, catalog] = await Promise.all([
        api.query(
          {
            month,
            months: 12,
            spaceId,
            tool: "get_card_commitments",
            ...(personId && { personId }),
          },
          snapshot.csrf,
          signal,
          fresh,
        ),
        api.catalog(spaceId, signal, fresh),
      ]);
      return {
        catalog,
        observedAt: new Date().toISOString(),
        result: CardCommitmentsResponseSchema.parse(result),
      };
    },
    [api, month, personId, snapshot.csrf, spaceId],
  );
  const resource = useResource(load);
  const { data } = resource;
  const currencies = [
    ...new Set([
      ...(data?.result.data.accounts.map((account) => account.currency) ?? []),
      ...(data?.result.data.totals.map((total) => total.currency) ?? []),
    ]),
  ].sort();
  const space = data?.catalog.spaces.find((item) => item.id === spaceId);
  const currency = displayCurrency(
    params.get("currency"),
    currencies,
    space?.currency ?? "BRL",
  );
  const person = snapshot.people.find((item) => item.id === personId);
  const missingPerson = personId ? "Pessoa indisponível" : "Todas as pessoas";
  const context = [
    space?.name ?? spaceId,
    person?.name ?? missingPerson,
    currency,
  ].join(" · ");
  const changeMonth = useCallback((value: string) => {
    const url = new URL(location.href);
    url.searchParams.set("month", value);
    navigateWorkspace(url);
  }, []);
  const changeCurrency = useCallback((value: string | null) => {
    if (!value) {
      return;
    }
    const url = new URL(location.href);
    url.searchParams.set("currency", value);
    navigateWorkspace(url);
  }, []);
  return (
    <>
      <WorkspaceHeading
        description="Cartões e parcelas · próximos 12 meses a partir do mês escolhido"
        title="Investimentos"
      >
        <div className="page-actions">
          <PeriodPicker
            month={month}
            onChange={changeMonth}
          />
          <RefreshButton
            disabled={resource.loading}
            label="Atualizar cartões e parcelas"
            onClick={resource.retry}
          />
        </div>
      </WorkspaceHeading>
      <ResourceFeedback {...resource} />
      {!!data && (
        <>
          <WorkspaceFilters
            action="/account/investments"
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
              compact
              params={params}
              person={snapshot.people.length > 1 || !!personId}
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
          <CardCommitmentsPanel
            currency={currency}
            data={data.result.data}
            partial={data.result.partial}
          />
          <p className="page-updated">
            Última importação bem-sucedida:{" "}
            {momentLabel(data.result.oldestLastSuccessAt)} · consultada em{" "}
            {momentLabel(data.observedAt)}.
          </p>
        </>
      )}
    </>
  );
}
