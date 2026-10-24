import {
  Badge,
  Banner,
  InlineCopyText,
  LayerCard,
  LayerDialog,
  Table,
} from "@cloudflare/kumo";
import type { z } from "zod/v4";

import type {
  PortalTransactionListSchema,
  TransactionListSchema,
} from "../../contracts";
import { formatBalance } from "../money";
import { UiButton } from "../ui";
import { dayLabel } from "./workspace-resource";
import { RecordReference } from "./workspace-ui";

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
  showAccount = true,
}: {
  records: Array<Transaction | PortalTransaction>;
  accounts: Array<{ id: string; name: string }>;
  categories: Array<{ id: string; name: string }>;
  referenceDay?: string;
  showOwner?: boolean;
  showAccount?: boolean;
}) {
  return (
    <LayerCard className="financial-surface">
      <Table
        aria-label="Lançamentos"
        className="transaction-table"
        data-single-account={!showAccount}
      >
        <Table.Header>
          <Table.Row>
            <Table.Head>Descrição</Table.Head>
            {showAccount === true && <Table.Head>Conta</Table.Head>}
            <Table.Head>Data</Table.Head>
            <Table.Head className="money-heading">Valor e moeda</Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body>
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
              showAccount={showAccount}
              showOwner={showOwner}
            />
          ))}
        </Table.Body>
      </Table>
    </LayerCard>
  );
}

function TransactionItem({
  row,
  account,
  category,
  referenceDay,
  showOwner,
  showAccount,
}: {
  row: Transaction | PortalTransaction;
  account: string;
  category: string;
  referenceDay: string | undefined;
  showOwner: boolean;
  showAccount: boolean;
}) {
  const installments = "installments" in row ? row.installments : [];
  const total = "totalInstallments" in row ? row.totalInstallments : null;
  const current = "installmentNumber" in row ? row.installmentNumber : null;
  const amount = amountLabel(row);
  const anchorDate = "anchorDate" in row ? row.anchorDate : row.date;
  const firstKnown = "anchorKind" in row && row.anchorKind === "first_seen";
  const displayedCategory = installments.some(
    (item) => item.category !== row.category,
  )
    ? "Categorias variadas"
    : category;
  const { pendingLabel, futureLabel } = transactionStates(
    row,
    installments,
    referenceDay,
  );
  return (
    <LayerDialog.Root>
      <Table.Row>
        <Table.Cell data-label="Descrição">
          <LayerDialog.Trigger
            aria-label={`Ver detalhes de ${row.description || "Sem descrição"}`}
            render={
              <UiButton
                className="transaction-open"
                type="button"
                variant="ghost"
              />
            }
          >
            {row.description || "Sem descrição"}
          </LayerDialog.Trigger>
          <span className="table-secondary">{displayedCategory}</span>
          <div className="transaction-states">
            {!!pendingLabel && <Badge variant="warning">{pendingLabel}</Badge>}
            {!!futureLabel && <Badge variant="info">{futureLabel}</Badge>}
            {!!row.ignored && <Badge variant="secondary">Ignorada</Badge>}
          </div>
        </Table.Cell>
        {showAccount === true && (
          <Table.Cell data-label="Conta">
            {account}
            {showOwner === true && (
              <span className="table-secondary">{row.personName}</span>
            )}
          </Table.Cell>
        )}
        <Table.Cell data-label="Data">
          {firstKnown === true && (
            <span className="table-secondary">Primeira conhecida</span>
          )}
          <time dateTime={anchorDate}>{dayLabel(anchorDate)}</time>
        </Table.Cell>
        <Table.Cell
          className="money-cell"
          data-label="Valor e moeda"
        >
          <strong>{amount}</strong>
          <span className="table-secondary">
            {row.direction === "DEBIT" ? "Saída" : "Entrada"}
            {current !== null && total !== null
              ? ` · Parcela ${current}/${total}`
              : ""}
          </span>
        </Table.Cell>
      </Table.Row>
      <LayerDialog.Content
        closeLabel="Fechar detalhes"
        size="lg"
      >
        <LayerDialog.Title>
          <span className="text-xl">Detalhes da transação</span>
        </LayerDialog.Title>
        <LayerDialog.Body>
          <TransactionDetailContent
            account={account}
            category={displayedCategory}
            referenceDay={referenceDay}
            row={row}
          />
        </LayerDialog.Body>
      </LayerDialog.Content>
    </LayerDialog.Root>
  );
}

export function TransactionDetailContent({
  row,
  account,
  category,
  referenceDay,
}: {
  row: Transaction | PortalTransaction;
  account: string;
  category: string;
  referenceDay?: string | undefined;
}) {
  const installments = "installments" in row ? row.installments : [];
  const total = "totalInstallments" in row ? row.totalInstallments : null;
  const current = "installmentNumber" in row ? row.installmentNumber : null;
  return (
    <>
      <p className="transaction-dialog-amount">
        <strong>{amountLabel(row)}</strong>
        <span>{row.direction === "DEBIT" ? "Saída" : "Entrada"}</span>
      </p>
      {row.ignored === true && (
        <Banner
          description="Este lançamento permanece disponível para consulta e está marcado como ignorado."
          title="Transação ignorada"
        />
      )}
      {installments.length > 0 && (
        <InstallmentSchedule
          installments={installments}
          referenceDay={referenceDay}
          total={total}
        />
      )}
      <TransactionDetails
        account={account}
        category={category}
        current={current}
        row={row}
        total={total}
      />
    </>
  );
}

function transactionStates(
  row: Transaction | PortalTransaction,
  installments: Installment[],
  referenceDay: string | undefined,
) {
  const anchorDate = "anchorDate" in row ? row.anchorDate : row.date;
  const pending = installments.filter(
    (item) => item.status === "PENDING",
  ).length;
  const future = installments.filter(
    (item) => !!referenceDay && item.date > referenceDay,
  ).length;
  let pendingLabel = row.status === "PENDING" ? "Pendente" : "";
  if (pending > 0) {
    pendingLabel = plural(pending, "pendente", "pendentes");
  }
  let futureLabel = referenceDay && anchorDate > referenceDay ? "Futura" : "";
  if (future > 0) {
    futureLabel = plural(future, "futura", "futuras");
  }
  return { futureLabel, pendingLabel };
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
              {!!item.ignored && " · Ignorada"}
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
    <>
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
          <dd>{account}</dd>
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
      </dl>
      <RecordReference>
        <div className="transaction-identifier">
          <dt>Identificador da conta</dt>
          <dd>
            <InlineCopyText
              labels={{
                copied: "Conta copiada",
                copyAction: "Copiar identificador da conta",
              }}
            >
              {row.accountId}
            </InlineCopyText>
          </dd>
        </div>
        <div className="transaction-identifier">
          <dt>
            {current !== null && total !== null
              ? "Identificador desta parcela"
              : "Identificador"}
          </dt>
          <dd>
            <InlineCopyText
              labels={{
                copied: "Identificador copiado",
                copyAction: "Copiar identificador",
              }}
            >
              {row.id}
            </InlineCopyText>
          </dd>
        </div>
      </RecordReference>
    </>
  );
}
