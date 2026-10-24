import { Select } from "@cloudflare/kumo";

import { demoReferenceDay } from "../fixtures/finance";
import { monthLabel, shiftMonth } from "./account/dashboard-period";
import { AccountFilter, QuerySearch } from "./account/filter-fields";
import { TransactionList } from "./account/transaction-list";
import { EmptyView } from "./account/workspace-filters";
import { WorkspaceDetails, WorkspaceFilters } from "./account/workspace-ui";
import { type DemoData, demoTransactions } from "./demo-data";

export function DemoTransactions({
  month,
  params,
  data,
}: {
  month: string;
  params: URLSearchParams;
  data: DemoData;
}) {
  const accountId = params.get("accountId") ?? "";
  const text = params.get("text") ?? "";
  const records = demoTransactions({
    accountId,
    data,
    direction: params.get("direction") ?? "",
    month,
    text,
  });
  const search = new URLSearchParams(params);
  search.delete("currency");
  search.set("month", month);
  const action = `/demo/transactions?${new URLSearchParams({ month, ...(params.get("space") && { space: params.get("space") ?? "" }) })}`;
  const activeCount = [text, accountId, params.get("direction")].filter(
    Boolean,
  ).length;
  const account = data.accounts.find((item) => item.id === accountId);
  return (
    <>
      <WorkspaceFilters
        action={action}
        activeCount={activeCount}
        {...(account && { context: account.name })}
        leading={
          <QuerySearch
            action="/demo/transactions"
            compact
            label="Buscar transação"
            name="text"
            params={search}
          />
        }
        showClear={activeCount > 0}
      >
        {!!params.get("space") && (
          <input
            name="space"
            type="hidden"
            value={params.get("space") ?? ""}
          />
        )}
        {!!params.get("direction") && (
          <input
            name="direction"
            type="hidden"
            value={params.get("direction") ?? ""}
          />
        )}
        <Select
          className="w-full"
          defaultValue={month}
          items={Array.from({ length: 6 }, (_, index) => {
            const value = shiftMonth("2026-05", index);
            return { label: monthLabel(value), value };
          })}
          label="Mês"
          name="month"
        />
        <AccountFilter
          accounts={data.accounts}
          value={accountId}
        />
        <input
          name="text"
          type="hidden"
          value={text}
        />
      </WorkspaceFilters>
      {records.length ? (
        <TransactionList
          accounts={data.accounts}
          categories={data.categories}
          records={records}
          referenceDay={demoReferenceDay}
          showOwner={false}
        />
      ) : (
        <EmptyView title="Nenhuma transação neste recorte">
          {data.accounts.length
            ? "Altere a busca ou os filtros para consultar outros lançamentos."
            : "Este grupo ainda não tem contas ou lançamentos fictícios."}
        </EmptyView>
      )}
      {!!records.length && (
        <p className="query-context">
          {records.length} {records.length === 1 ? "transação" : "transações"}
        </p>
      )}
      <WorkspaceDetails title="Sobre esta consulta">
        <p>
          Pendentes e futuras continuam visíveis. Ignoradas ficam fora desta
          lista. Cada valor conserva sua moeda, sem conversão.
        </p>
      </WorkspaceDetails>
    </>
  );
}
