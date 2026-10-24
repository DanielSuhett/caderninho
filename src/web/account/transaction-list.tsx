import type { z } from "zod/v4";

import type {
  PortalTransactionListSchema,
  TransactionListSchema,
} from "../../contracts";
import { formatBalance } from "./dashboard-view";
import { DisclosureItem } from "./disclosure-item";
import { dayLabel } from "./workspace-resource";

type Transaction = z.infer<
  typeof TransactionListSchema
>["data"]["records"][number];
type PortalTransaction = z.infer<
  typeof PortalTransactionListSchema
>["data"]["records"][number];
type Installment = PortalTransaction["installments"][number];

function plural(count: number, singular: string, multiple: string) {
  return `${count} ${count === 1 ? singular : multiple}`;
}

function amountLabel(row: Transaction) {
  return row.amountMinor === null
    ? "Valor indisponível"
    : formatBalance(row.amountMinor, row.currency);
}

export function TransactionList({
  records,
  accounts,
  categories,
  referenceDay,
  showOwner = true,
}: {
  records: Array<Transaction | PortalTransaction>;
  accounts: Array<{ id: string; name: string }>;
  categories: Array<{ id: string; name: string }>;
  referenceDay?: string;
  showOwner?: boolean;
}) {
  return (
    <ul
      aria-label="Lançamentos"
      className="transaction-list"
    >
      {records.map((row) => (
        <TransactionItem
          account={
            accounts.find((item) => item.id === row.accountId)?.name ??
            "Conta não identificada"
          }
          category={
            categories.find((item) => item.id === row.category)?.name ??
            row.category ??
            "Sem categoria"
          }
          key={row.id}
          referenceDay={referenceDay}
          row={row}
          showOwner={showOwner}
        />
      ))}
    </ul>
  );
}

function TransactionItem({
  row,
  account,
  category,
  referenceDay,
  showOwner,
}: {
  row: Transaction | PortalTransaction;
  account: string;
  category: string;
  referenceDay: string | undefined;
  showOwner: boolean;
}) {
  const installments = "installments" in row ? row.installments : [];
  const total = "totalInstallments" in row ? row.totalInstallments : null;
  const current = "installmentNumber" in row ? row.installmentNumber : null;
  const amount = amountLabel(row);
  const displayedCategory = installments.some(
    (item) => item.category !== row.category,
  )
    ? "Categorias variadas"
    : category;
  return (
    <li>
      <DisclosureItem
        className={`transaction-item ${amount.length > 18 || row.amountMinor === null ? "wide-amount" : ""}`}
        summary={
          <TransactionSummary
            account={account}
            amount={amount}
            current={current}
            installments={installments}
            referenceDay={referenceDay}
            row={row}
            showOwner={showOwner}
            total={total}
          />
        }
      >
        {installments.length > 0 && (
          <InstallmentSchedule
            installments={installments}
            referenceDay={referenceDay}
            total={total}
          />
        )}
        <TransactionDetails
          account={account}
          category={displayedCategory}
          current={current}
          row={row}
          total={total}
        />
      </DisclosureItem>
    </li>
  );
}

function TransactionSummary({
  row,
  account,
  amount,
  installments,
  current,
  total,
  referenceDay,
  showOwner,
}: {
  row: Transaction | PortalTransaction;
  account: string;
  amount: string;
  installments: Installment[];
  current: number | null;
  total: number | null;
  referenceDay: string | undefined;
  showOwner: boolean;
}) {
  const anchorDate = "anchorDate" in row ? row.anchorDate : row.date;
  const firstKnown = "anchorKind" in row && row.anchorKind === "first_seen";
  const pendingCount = installments.filter(
    (item) => item.status === "PENDING",
  ).length;
  const futureCount = installments.filter(
    (item) => !!referenceDay && item.date > referenceDay,
  ).length;
  let pendingLabel: string | null = null;
  if (pendingCount > 0) {
    pendingLabel = plural(pendingCount, "pendente", "pendentes");
  } else if (installments.length === 0 && row.status === "PENDING") {
    pendingLabel = "Pendente";
  }
  let futureLabel: string | null = null;
  if (futureCount > 0) {
    futureLabel = plural(futureCount, "futura", "futuras");
  } else if (referenceDay && anchorDate > referenceDay) {
    futureLabel = "Futura";
  }
  return (
    <>
      <span className="transaction-description">
        {row.description || "Sem descrição"}
      </span>
      <span className="transaction-amount">
        <strong>{amount}</strong>
        <span>
          {row.direction === "DEBIT" ? "Saída" : "Entrada"}
          {current !== null && total !== null
            ? ` · Parcela ${current}/${total}`
            : ""}
        </span>
      </span>
      <span className="transaction-meta">
        <span className="transaction-date">
          {firstKnown ? "Primeira conhecida: " : ""}
          <time dateTime={anchorDate}>{dayLabel(anchorDate)}</time>
        </span>
        <span className="transaction-account">{account}</span>
        {showOwner === true ? <span>{row.personName}</span> : null}
        {!!pendingLabel && (
          <span
            className="transaction-state"
            data-tone="warning"
          >
            {pendingLabel}
          </span>
        )}
        {!!futureLabel && (
          <span className="transaction-state">{futureLabel}</span>
        )}
        {!!row.ignored && <span className="transaction-state">Ignorada</span>}
      </span>
    </>
  );
}

function InstallmentSchedule({
  installments,
  total,
  referenceDay,
}: {
  installments: Installment[];
  total: number | null;
  referenceDay: string | undefined;
}) {
  return (
    <section
      aria-label="Parcelas desta compra"
      className="transaction-installments"
    >
      <h3>
        {plural(
          installments.length,
          "parcela informada",
          "parcelas informadas",
        )}
        {total !== null && ` de ${total}`}
      </h3>
      <ol>
        {installments.map((item) => (
          <li key={item.id}>
            <span className="installment-number">
              {item.installmentNumber}/{item.totalInstallments}
            </span>
            <time dateTime={item.date}>{dayLabel(item.date)}</time>
            <strong>{amountLabel(item)}</strong>
            <span className="installment-states">
              {item.status === "PENDING"
                ? "Pendente na origem"
                : "Registrada na origem"}
              {!!referenceDay && item.date > referenceDay && " · Futura"}
            </span>
          </li>
        ))}
      </ol>
      {total !== null && installments.length < total && (
        <p className="muted">
          {plural(
            total - installments.length,
            "parcela ainda não recebida",
            "parcelas ainda não recebidas",
          )}{" "}
          da origem.
        </p>
      )}
      <p className="muted">
        O estado da origem não indica pagamento da fatura.
      </p>
    </section>
  );
}

function TransactionDetails({
  row,
  account,
  current,
  total,
  category,
}: {
  row: Transaction | PortalTransaction;
  account: string;
  current: number | null;
  total: number | null;
  category: string;
}) {
  const anchorDate = "anchorDate" in row ? row.anchorDate : row.date;
  const anchorKind = "anchorKind" in row ? row.anchorKind : "transaction";
  let dateLabel = "Data";
  if (anchorKind === "purchase") {
    dateLabel = "Compra em";
  } else if (anchorKind === "first_seen") {
    dateLabel = "Primeira parcela conhecida em";
  }
  return (
    <dl className="transaction-detail">
      <div className="transaction-identifier">
        <dt>Descrição completa</dt>
        <dd>{row.description || "Sem descrição"}</dd>
      </div>
      <div>
        <dt>{dateLabel}</dt>
        <dd>
          <time dateTime={anchorDate}>{dayLabel(anchorDate)}</time>
        </dd>
      </div>
      <div>
        <dt>Categoria</dt>
        <dd>{category}</dd>
      </div>
      {current !== null && total !== null && (
        <div>
          <dt>Parcela deste registro</dt>
          <dd>
            {current}/{total}
          </dd>
        </div>
      )}
      <div>
        <dt>Conta</dt>
        <dd>
          {account}
          <code className="transaction-account-id">{row.accountId}</code>
        </dd>
      </div>
      <div>
        <dt>Titular</dt>
        <dd>{row.personName}</dd>
      </div>
      <div>
        <dt>Estado deste registro</dt>
        <dd>
          {row.status === "PENDING"
            ? "Pendente na origem"
            : "Registrada na origem"}
        </dd>
      </div>
      <div>
        <dt>Origem</dt>
        <dd>{row.manual ? "Lançamento manual" : "Importado da origem"}</dd>
      </div>
      <div className="transaction-identifier">
        <dt>
          {current !== null && total !== null
            ? "Identificador desta parcela"
            : "Identificador"}
        </dt>
        <dd>
          <code>{row.id}</code>
        </dd>
      </div>
    </dl>
  );
}
