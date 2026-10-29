import { Select } from "@cloudflare/kumo/components/select";
import type { ComponentProps } from "react";

import type { PortalResponse, WorkspaceCatalog } from "../../contracts";
import { TransactionDirection, TransactionStatus } from "../../domain";
import { UiCheckbox } from "../ui-checkbox";
import { AccountFilter, CatalogField, DateRangeFields } from "./filter-fields";
import { ScopeFields } from "./workspace-filters";

// Rendered inside the filter dialog, so it downloads when the dialog opens.
export function TransactionFilterFields({
  catalog,
  accounts,
  multiplePeople,
  showOwner,
  params,
  snapshot,
}: {
  catalog: WorkspaceCatalog;
  accounts: ComponentProps<typeof AccountFilter>["accounts"];
  multiplePeople: boolean;
  showOwner: boolean;
  params: URLSearchParams;
  snapshot: PortalResponse;
}) {
  const future = params.get("future") === "on";
  return (
    <>
      <ScopeFields
        catalog={catalog}
        params={params}
        person={multiplePeople}
        snapshot={snapshot}
      />
      <input
        name="text"
        type="hidden"
        value={params.get("text") ?? ""}
      />
      {!!params.get("uncategorized") && (
        <input
          name="uncategorized"
          type="hidden"
          value="on"
        />
      )}
      <div className="advanced-filter-grid">
        <DateRangeFields
          from={params.get("from") ?? ""}
          to={params.get("to") ?? ""}
        />
        <Select
          defaultValue={params.get("direction") ?? ""}
          items={[
            { label: "Entradas e saídas", value: "" },
            { label: "Saídas", value: TransactionDirection.DEBIT },
            { label: "Entradas", value: TransactionDirection.CREDIT },
          ]}
          label="Movimento"
          name="direction"
        />
        <AccountFilter
          accounts={accounts}
          showOwner={showOwner}
          value={params.get("accountId") ?? ""}
        />
        <Select
          defaultValue={params.get("cards") ?? ""}
          items={[
            { label: "Contas e cartões", value: "" },
            { label: "Só cartões", value: "on" },
          ]}
          label="Origem"
          name="cards"
        />
        {params.get("uncategorized") !== "on" && (
          <CatalogField
            defaultValue={params.get("categoryId") ?? ""}
            items={[
              { label: "Todas as categorias", value: "" },
              ...catalog.categories
                .filter((c) => !c.hidden || c.id === params.get("categoryId"))
                .map((c) => ({
                  appearance: c,
                  label: c.name,
                  value: c.id,
                })),
            ]}
            label="Categoria"
            name="categoryId"
          />
        )}
        <Select
          defaultValue={params.get("status") ?? ""}
          items={[
            { label: "Todos", value: "" },
            {
              label: "Registradas na origem",
              value: TransactionStatus.POSTED,
            },
            {
              label: "Pendentes na origem",
              value: TransactionStatus.PENDING,
            },
          ]}
          label="Estado"
          name="status"
        />
        <div className="checkbox-label">
          <UiCheckbox
            defaultChecked={future}
            label="Lançamentos futuros"
            name="future"
          />
        </div>
        <div className="checkbox-label">
          <UiCheckbox
            defaultChecked={params.get("ignored") === "on"}
            label="Incluir ignoradas"
            name="ignored"
          />
        </div>
      </div>
    </>
  );
}
