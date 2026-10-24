import { Select } from "@cloudflare/kumo";

import { monthLabel, shiftMonth } from "./account/dashboard-period";
import { AccountFilter, QuerySearch } from "./account/filter-fields";
import { TransactionList } from "./account/transaction-list";
import { EmptyView } from "./account/workspace-filters";
import { WorkspaceDetails, WorkspaceFilters } from "./account/workspace-ui";
import {
  demoAccounts,
  demoCategories,
  demoReferenceDay,
  demoTransactions,
} from "./demo-data";

export function DemoTransactions({
  month,
  params,
}: {
  month: string;
  params: URLSearchParams;
}) {
  const accountId = params.get("accountId") ?? "";
  const text = params.get("text") ?? "";
  const records = demoTransactions({ accountId, month, text });
  const search = new URLSearchParams(params);
  search.delete("currency");
  search.set("month", month);
  const action = `/demo/transactions?month=${month}`;
  const activeCount = [text, accountId].filter(Boolean).length;
  const account = demoAccounts.find((item) => item.id === accountId);
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
            label="Buscar descrição"
            name="text"
            params={search}
          />
        }
        showClear={activeCount > 0}
      >
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
          accounts={demoAccounts}
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
          accounts={demoAccounts}
          categories={demoCategories}
          records={records}
          referenceDay={demoReferenceDay}
          showOwner={false}
        />
      ) : (
        <EmptyView title="Nenhuma transação neste recorte">
          Altere a busca ou os filtros para consultar outros lançamentos.
        </EmptyView>
      )}
      <p className="query-context">
        {records.length} {records.length === 1 ? "transação" : "transações"}
      </p>
      <WorkspaceDetails title="Sobre esta consulta">
        <p>
          Pendentes e futuras continuam visíveis. Ignoradas ficam fora desta
          lista. Cada valor conserva sua moeda, sem conversão.
        </p>
      </WorkspaceDetails>
    </>
  );
}
