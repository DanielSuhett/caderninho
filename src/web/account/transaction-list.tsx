import type { z } from "zod/v4";

import type { TransactionListSchema } from "../../contracts";
import { formatBalance } from "./dashboard-view";
import { DisclosureItem } from "./disclosure-item";
import { dayLabel } from "./workspace-resource";

type Transaction = z.infer<
  typeof TransactionListSchema
>["data"]["records"][number];

export function TransactionList({
  records,
  accounts,
  categories,
}: {
  records: Transaction[];
  accounts: Array<{ id: string; name: string }>;
  categories: Array<{ id: string; name: string }>;
}) {
  return (
    <ul
      aria-label="Lançamentos"
      className="transaction-list"
    >
      {records.map((row) => {
        const account =
          accounts.find((a) => a.id === row.accountId)?.name ??
          "Conta não identificada";
        const category =
          categories.find((c) => c.id === row.category)?.name ??
          row.category ??
          "Sem categoria";
        const amount =
          row.amountMinor === null
            ? "Valor indisponível"
            : formatBalance(row.amountMinor, row.currency);
        return (
          <li key={row.id}>
            <DisclosureItem
              className={`transaction-item ${amount.length > 18 || row.amountMinor === null ? "wide-amount" : ""}`}
              summary={
                <>
                  <span className="transaction-description">
                    {row.description || "Sem descrição"}
                  </span>
                  <span className="transaction-amount">
                    <strong>{amount}</strong>
                  </span>
                  <span className="transaction-account">
                    <span>{account}</span>
                    <span className="transaction-owner">{row.personName}</span>
                  </span>
                  <span className="transaction-meta">
                    <time dateTime={row.date}>{dayLabel(row.date)}</time>
                    <span className="transaction-category">{category}</span>
                    <span>
                      {row.direction === "DEBIT" ? "Saída" : "Entrada"}
                    </span>
                    {row.status === "PENDING" && (
                      <span
                        className="transaction-state"
                        data-tone="warning"
                      >
                        Pendente
                      </span>
                    )}
                    {!!row.ignored && (
                      <span className="transaction-state">
                        Ignorada nas análises
                      </span>
                    )}
                  </span>
                </>
              }
            >
              <dl className="transaction-detail">
                <div>
                  <dt>Conta</dt>
                  <dd>
                    {account}
                    <code className="transaction-account-id">
                      {row.accountId}
                    </code>
                  </dd>
                </div>
                <div>
                  <dt>Titular</dt>
                  <dd>{row.personName}</dd>
                </div>
                <div>
                  <dt>Estado</dt>
                  <dd>
                    {row.status === "PENDING" ? "Pendente" : "Confirmada"}
                  </dd>
                </div>
                <div>
                  <dt>Origem</dt>
                  <dd>
                    {row.manual ? "Lançamento manual" : "Importado da origem"}
                  </dd>
                </div>
                <div className="transaction-identifier">
                  <dt>Identificador</dt>
                  <dd>
                    <code>{row.id}</code>
                  </dd>
                </div>
              </dl>
            </DisclosureItem>
          </li>
        );
      })}
    </ul>
  );
}
