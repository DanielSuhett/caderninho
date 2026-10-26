import { Badge } from "@cloudflare/kumo/components/badge";
import { Table } from "@cloudflare/kumo/components/table";
import type { z } from "zod/v4";

import type { PortalTransactionListSchema } from "../../contracts";
import { TransactionStatus } from "../../domain";
import { formatBalance, transactionTone } from "../money";
import { MoneyValue } from "../money-value";
import { type AccountAppearance, AccountAvatar } from "./account-identity";
import { InfoTip } from "./info-tip";
import { dayLabel } from "./workspace-resource";

export type Installment = z.infer<
  typeof PortalTransactionListSchema
>["data"]["records"][number]["installments"][number];

export function InstallmentTable({
  installments,
  total,
  referenceDay,
  account,
}: {
  installments: Installment[];
  total: number | null;
  referenceDay?: string | undefined;
  account: AccountAppearance;
}) {
  const missing = total === null ? 0 : Math.max(0, total - installments.length);
  return (
    <section
      aria-label="Parcelas desta compra"
      className="installment-table-section"
    >
      <h3>
        Parcelas{" "}
        <span className="table-secondary">
          {installments.length}
          {total !== null && ` de ${total}`} recebidas
        </span>
      </h3>
      <Table
        aria-label="Parcelas recebidas desta compra"
        className="installment-table"
      >
        <Table.Header>
          <Table.Row>
            <Table.Head>Parcela</Table.Head>
            <Table.Head>Data</Table.Head>
            <Table.Head className="installment-value">Valor</Table.Head>
            <Table.Head>Lançamento</Table.Head>
            <Table.Head>
              Fatura
              <InfoTip label="pagamento da fatura">
                Paga quando há conciliação bancária ou marcação manual da fatura
                vinculada. Sem essa evidência, o pagamento permanece não
                informado.
              </InfoTip>
            </Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {installments.map((item) => (
            <Table.Row key={item.id}>
              <Table.Cell className="installment-identity">
                <AccountAvatar
                  account={account}
                  person={{ id: item.personId, name: item.personName }}
                />
                <span>
                  {item.installmentNumber}/{item.totalInstallments}
                </span>
              </Table.Cell>
              <Table.Cell className="installment-date">
                <time dateTime={item.date}>{dayLabel(item.date)}</time>
              </Table.Cell>
              <Table.Cell className="installment-value">
                <span data-money-tone={transactionTone(item)}>
                  {item.amountMinor === null ? (
                    `Indisponível · ${item.currency}`
                  ) : (
                    <MoneyValue
                      value={formatBalance(item.amountMinor, item.currency)}
                    />
                  )}
                </span>
              </Table.Cell>
              <Table.Cell className="installment-source">
                <span className="installment-states">
                  <Badge
                    variant={
                      item.status === TransactionStatus.PENDING
                        ? "warning"
                        : "secondary"
                    }
                  >
                    {item.status === TransactionStatus.PENDING
                      ? "Pendente"
                      : "Confirmada"}
                  </Badge>
                  {!!referenceDay && item.date > referenceDay && (
                    <Badge variant="info">Futura</Badge>
                  )}
                  {item.ignored === true && (
                    <Badge variant="secondary">Ignorada</Badge>
                  )}
                </span>
              </Table.Cell>
              <Table.Cell className="installment-payment">
                {item.billPayment ? (
                  <Badge
                    variant={item.billPayment === "bank" ? "success" : "info"}
                  >
                    {item.billPayment === "bank" ? "Paga" : "Marcada paga"}
                  </Badge>
                ) : (
                  <span className="table-secondary">
                    Pagamento não informado
                  </span>
                )}
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
      {missing > 0 && (
        <p className="analysis-footnote">
          {missing}{" "}
          {missing === 1
            ? "parcela ainda não recebida"
            : "parcelas ainda não recebidas"}
          .
        </p>
      )}
    </section>
  );
}
