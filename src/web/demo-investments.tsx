import { Select } from "@cloudflare/kumo";
import { useCallback } from "react";

import { cardCommitmentsFixture } from "../fixtures/card-commitments";
import { navigateWorkspace } from "./account/account-navigation";
import { CardCommitmentsPanel } from "./account/card-commitments-panel";
import { displayCurrency } from "./account/financial-presentation";
import { PeriodPicker } from "./account/period-picker";
import { WorkspaceHeading } from "./account/workspace-ui";
import { selectedDemoMonth } from "./demo-data";
import type { createDemoSession } from "./demo-session";

export function DemoInvestments({
  session,
}: {
  session: ReturnType<typeof createDemoSession>;
}) {
  const params = new URLSearchParams(location.search);
  const month = selectedDemoMonth(params.get("month"));
  const spaceId = params.get("space") ?? "personal";
  const groups = session.spaces();
  const group = groups.find((item) => item.id === spaceId);
  const fixture = cardCommitmentsFixture({ month });
  const catalog = session.view(spaceId).categories;
  const data =
    spaceId === "personal"
      ? {
          ...fixture,
          categories: fixture.categories.map((row) => {
            const category = catalog.find((item) => item.id === row.id);
            return {
              ...row,
              color: category?.color ?? row.color,
              name: category?.name ?? row.name,
            };
          }),
        }
      : {
          ...fixture,
          accounts: [],
          categories: [],
          installments: [],
          months: [],
          totals: [],
        };
  const currencies = [...new Set(data.accounts.map((row) => row.currency))];
  const currency = displayCurrency(
    params.get("currency"),
    currencies,
    group?.currency ?? "BRL",
  );
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
  const changeGroup = useCallback((value: string | null) => {
    if (!value) {
      return;
    }
    const url = new URL(location.href);
    url.searchParams.set("space", value);
    navigateWorkspace(url);
  }, []);
  return (
    <>
      <WorkspaceHeading
        description="Parcelas e gastos já recebidos para os próximos 12 meses."
        title="Compromissos"
      >
        <div className="page-actions">
          <PeriodPicker
            fromMonth="2026-05"
            month={month}
            onChange={changeMonth}
            toMonth="2026-10"
          />
        </div>
      </WorkspaceHeading>
      <div className="filter-toolbar">
        <div className="cards-toolbar-controls">
          {" "}
          {currencies.length > 1 && (
            <Select
              items={currencies.map((value) => ({ label: value, value }))}
              label="Moeda"
              onValueChange={changeCurrency}
              value={currency}
            />
          )}
          {groups.length > 1 && (
            <Select
              items={groups.map((value) => ({
                label: value.name,
                value: value.id,
              }))}
              label="Grupo"
              onValueChange={changeGroup}
              value={spaceId}
            />
          )}
        </div>{" "}
        <p className="filter-context">
          {group?.name ?? spaceId} · Pessoa de exemplo · {currency}
        </p>
      </div>
      <CardCommitmentsPanel
        connectionsHref="/#install-title"
        currency={currency}
        data={data}
      />
    </>
  );
}
