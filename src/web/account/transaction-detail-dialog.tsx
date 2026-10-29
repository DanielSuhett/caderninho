import { Badge } from "@cloudflare/kumo/components/badge";
import { Banner } from "@cloudflare/kumo/components/banner";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import { FlowArrowIcon, PencilSimpleIcon } from "@phosphor-icons/react";
import { useCallback, useRef } from "react";

import { TransactionDirection, TransactionStatus } from "../../domain";
import { transactionTone } from "../money";
import { UiButton } from "../ui";
import { type AccountAppearance, AccountAvatar } from "./account-identity";
import { type CategoryAppearance, CategoryLabel } from "./category-appearance";
import { InstallmentTable } from "./installment-table";
import { RelatedInstallments } from "./related-installments";
import { useTransactionEditing } from "./transaction-actions";
import { TransactionIdentificationDetails } from "./transaction-identification";
import {
  amountLabel,
  type PortalTransaction,
  type Transaction,
  TransactionAmount,
  transactionStates,
} from "./transaction-list";
import { useTransactionReader } from "./transaction-reader";
import { WorkspaceDialog } from "./workspace-dialog";
import { dayLabel } from "./workspace-resource";

export function TransactionDetailDialog({
  open,
  setOpen,
  row,
  account,
  appearance,
  category,
  categoryAppearance,
  referenceDay,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
  row: Transaction | PortalTransaction;
  account: string;
  appearance: AccountAppearance | undefined;
  category: string;
  categoryAppearance: CategoryAppearance | undefined;
  referenceDay: string | undefined;
}) {
  const editing = useTransactionEditing();
  const pendingAction = useRef<"category" | "rule" | null>(null);
  const queueCategory = useCallback(() => {
    pendingAction.current = "category";
  }, []);
  const queueRule = useCallback(() => {
    pendingAction.current = "rule";
  }, []);
  // The editor opens once the detail has closed, so focus can move to it.
  const afterOpenChange = useCallback(
    (next: boolean) => {
      if (!next && pendingAction.current) {
        editing?.(row, pendingAction.current);
        pendingAction.current = null;
      }
    },
    [editing, row],
  );
  return (
    <Dialog.Root
      onOpenChange={setOpen}
      onOpenChangeComplete={afterOpenChange}
      open={open}
    >
      <WorkspaceDialog
        actions={
          editing ? (
            <>
              <Dialog.Close
                render={
                  <UiButton
                    onClick={queueCategory}
                    type="button"
                    variant="primary"
                  />
                }
              >
                <PencilSimpleIcon size={18} />
                Categorizar
              </Dialog.Close>
              <Dialog.Close
                render={
                  <UiButton
                    onClick={queueRule}
                    type="button"
                    variant="outline"
                  />
                }
              >
                <FlowArrowIcon size={18} />
                Criar regra
              </Dialog.Close>
            </>
          ) : undefined
        }
        closeLabel="Fechar detalhes"
        size="xl"
        title="Detalhes da transação"
      >
        <TransactionDetailContent
          account={account}
          appearance={appearance}
          category={category}
          categoryAppearance={categoryAppearance}
          referenceDay={referenceDay}
          row={row}
        />
      </WorkspaceDialog>
    </Dialog.Root>
  );
}

export function TransactionDetailContent({
  row,
  account,
  category,
  categoryAppearance,
  referenceDay,
  appearance,
}: {
  row: Transaction | PortalTransaction;
  account: string;
  category: string;
  categoryAppearance?: CategoryAppearance | undefined;
  referenceDay?: string | undefined;
  appearance?: AccountAppearance | undefined;
}) {
  const installments = "installments" in row ? row.installments : [];
  const total =
    "totalInstallments" in row
      ? row.totalInstallments
      : (row.identification?.creditCardMetadata?.totalInstallments ?? null);
  const reader = useTransactionReader();
  const current = "installmentNumber" in row ? row.installmentNumber : null;
  const { pendingLabel } = transactionStates(row, installments, referenceDay);
  return (
    <div className="transaction-dialog-content">
      <div className="transaction-detail-summary">
        <AccountAvatar
          account={appearance ?? { name: account }}
          person={{ id: row.personId, name: row.personName }}
        />
        <h3>{row.description || "Sem descrição"}</h3>
        <p className="transaction-dialog-amount">
          <strong>
            <TransactionAmount
              amount={amountLabel(row)}
              available={row.amountMinor !== null}
              tone={transactionTone(row)}
            />
          </strong>
          <span>
            {row.direction === TransactionDirection.DEBIT ? "Saída" : "Entrada"}
          </span>
          {!!pendingLabel && <Badge variant="warning">{pendingLabel}</Badge>}
        </p>
      </div>
      {row.ignored === true && (
        <Banner
          description="Este lançamento permanece disponível para consulta e está marcado como ignorado."
          title="Transação ignorada"
        />
      )}
      <TransactionDetails
        account={account}
        category={category}
        categoryAppearance={categoryAppearance}
        current={current}
        row={row}
        total={total}
      />
      <TransactionIdentificationDetails
        currency={row.currency}
        identification={row.identification}
      />
      {reader && total !== null && total > 1 ? (
        <RelatedInstallments
          accountId={row.accountId}
          id={row.id}
        />
      ) : (
        installments.length > 0 && (
          <InstallmentTable
            installments={installments}
            referenceDay={referenceDay}
            total={total}
          />
        )
      )}
    </div>
  );
}

function TransactionDetails({
  row,
  account,
  current,
  total,
  category,
  categoryAppearance,
}: {
  row: Transaction | PortalTransaction;
  account: string;
  current: number | null;
  total: number | null;
  category: string;
  categoryAppearance?: CategoryAppearance | undefined;
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
      <div>
        <dt>{dateLabel}</dt>
        <dd>
          <time dateTime={anchorDate}>{dayLabel(anchorDate)}</time>
        </dd>
      </div>
      <div>
        <dt>Categoria</dt>
        <dd>
          <CategoryLabel
            category={categoryAppearance}
            label={category}
          />
        </dd>
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
          {row.status === TransactionStatus.PENDING
            ? "Pendente na origem"
            : "Registrada na origem"}
        </dd>
      </div>
      <div>
        <dt>Origem</dt>
        <dd>{row.manual ? "Lançamento manual" : "Importado da origem"}</dd>
      </div>
    </dl>
  );
}
