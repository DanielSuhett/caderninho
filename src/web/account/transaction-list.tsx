import { Badge } from "@cloudflare/kumo/components/badge";
import { Banner } from "@cloudflare/kumo/components/banner";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import { DropdownMenu } from "@cloudflare/kumo/components/dropdown";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Table } from "@cloudflare/kumo/components/table";
import { Tooltip } from "@cloudflare/kumo/components/tooltip";
import {
  DotsThreeIcon,
  FlowArrowIcon,
  PencilSimpleIcon,
} from "@phosphor-icons/react";
import { type PointerEvent, type Ref, useCallback, useRef } from "react";
import type { z } from "zod/v4";

import type {
  PortalTransactionListSchema,
  TransactionListSchema,
} from "../../contracts";
import { TransactionDirection, TransactionStatus } from "../../domain";
import { formatBalance, type MoneyTone, transactionTone } from "../money";
import { MoneyValue } from "../money-value";
import { UiButton } from "../ui";
import { type AccountAppearance, AccountAvatar } from "./account-identity";
import { type CategoryAppearance, CategoryLabel } from "./category-appearance";
import { InstallmentTable } from "./installment-table";
import { RelatedInstallments } from "./related-installments";
import { useTransactionEditing } from "./transaction-actions";
import { TransactionIdentificationDetails } from "./transaction-identification";
import { useTransactionReader } from "./transaction-reader";
import { WorkspaceDialog } from "./workspace-dialog";
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
  if (row.amountMinor === null) {
    return `Valor indisponível · ${row.currency}`;
  }
  const label = formatBalance(row.amountMinor, row.currency);
  return row.direction === TransactionDirection.CREDIT &&
    BigInt(row.amountMinor) > 0n
    ? `+${label}`
    : label;
}

function TransactionAmount({
  amount,
  available,
  tone,
}: {
  amount: string;
  available: boolean;
  tone: MoneyTone;
}) {
  return (
    <span data-money-tone={tone}>
      {available ? <MoneyValue value={amount} /> : <span>{amount}</span>}
    </span>
  );
}

function directionIsExplicit(row: Transaction) {
  if (row.amountMinor === null) {
    return false;
  }
  const amount = BigInt(row.amountMinor);
  return (
    (row.direction === TransactionDirection.DEBIT && amount < 0n) ||
    (row.direction === TransactionDirection.CREDIT && amount > 0n)
  );
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
  accounts: Array<AccountAppearance & { id: string }>;
  categories: CategoryAppearance[];
  referenceDay?: string;
  showOwner?: boolean;
  showAccount?: boolean;
}) {
  return (
    <LayerCard className="financial-surface transaction-surface">
      <Table
        aria-label="Lançamentos"
        className="transaction-table"
        data-single-account={!showAccount}
        layout="fixed"
      >
        <colgroup>
          <col className="transaction-description-column" />
          {showAccount === true && (
            <col className="transaction-account-column" />
          )}
          <col className="transaction-date-column" />
          <col className="transaction-money-column" />
        </colgroup>
        <Table.Header>
          <Table.Row>
            <Table.Head>Descrição</Table.Head>
            {showAccount === true && <Table.Head>Conta</Table.Head>}
            <Table.Head>Data</Table.Head>
            <Table.Head className="money-heading">Valor e moeda</Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {records.map((row) => {
            const category = categories.find(
              (item) => item.id === row.category,
            );
            return (
              <TransactionItem
                account={
                  accounts.find((item) => item.id === row.accountId)?.name ??
                  "Conta não identificada"
                }
                appearance={accounts.find((item) => item.id === row.accountId)}
                category={category?.name ?? row.category ?? "Sem categoria"}
                categoryAppearance={category}
                key={row.id}
                referenceDay={referenceDay}
                row={row}
                showAccount={showAccount}
                showOwner={showOwner}
              />
            );
          })}
        </Table.Body>
      </Table>
    </LayerCard>
  );
}

function openTransactionRow(
  event: PointerEvent<HTMLTableRowElement>,
  trigger: HTMLButtonElement | null,
) {
  if (
    event.button !== 0 ||
    (event.target instanceof Element &&
      event.target.closest("button,a,input,select,textarea")) ||
    window.getSelection()?.toString()
  ) {
    return;
  }
  trigger?.click();
}

function TransactionItem({
  row,
  account,
  appearance,
  category,
  categoryAppearance,
  referenceDay,
  showOwner,
  showAccount,
}: {
  row: Transaction | PortalTransaction;
  account: string;
  appearance?: AccountAppearance | undefined;
  category: string;
  categoryAppearance?: CategoryAppearance | undefined;
  referenceDay: string | undefined;
  showOwner: boolean;
  showAccount: boolean;
}) {
  const trigger = useRef<HTMLButtonElement>(null);
  const editing = useTransactionEditing();
  const pendingAction = useRef<"category" | "rule" | null>(null);
  const categorize = useCallback(
    () => editing?.(row, "category"),
    [editing, row],
  );
  const createRule = useCallback(() => editing?.(row, "rule"), [editing, row]);
  const queueCategory = useCallback(() => {
    pendingAction.current = "category";
  }, []);
  const queueRule = useCallback(() => {
    pendingAction.current = "rule";
  }, []);
  const afterOpenChange = useCallback(
    (open: boolean) => {
      if (!open && pendingAction.current) {
        editing?.(row, pendingAction.current);
        pendingAction.current = null;
      }
    },
    [editing, row],
  );
  const openRow = useCallback((event: PointerEvent<HTMLTableRowElement>) => {
    // Use the native trigger so closing returns focus to this transaction.
    openTransactionRow(event, trigger.current);
  }, []);
  const installments = "installments" in row ? row.installments : [];
  const total = "totalInstallments" in row ? row.totalInstallments : null;
  const current = "installmentNumber" in row ? row.installmentNumber : null;
  const amount = amountLabel(row);
  const anchorDate = "anchorDate" in row ? row.anchorDate : row.date;
  const firstKnown = "anchorKind" in row && row.anchorKind === "first_seen";
  const variedCategories = installments.some(
    (item) => item.category !== row.category,
  );
  const displayedCategory = variedCategories ? "Categorias variadas" : category;
  const { pendingLabel, futureLabel } = transactionStates(
    row,
    installments,
    referenceDay,
  );
  return (
    <Dialog.Root onOpenChangeComplete={afterOpenChange}>
      <Table.Row
        className="transaction-row"
        data-wide-amount={amount.length > 22}
        onPointerUp={openRow}
      >
        <Table.Cell data-label="Descrição">
          <TransactionIdentity
            account={account}
            appearance={appearance}
            category={displayedCategory}
            categoryAppearance={
              variedCategories ? undefined : categoryAppearance
            }
            futureLabel={futureLabel}
            pendingLabel={pendingLabel}
            row={row}
            showOwner={showOwner}
            trigger={trigger}
          />
        </Table.Cell>
        {showAccount === true && (
          <Table.Cell data-label="Conta">{account}</Table.Cell>
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
          <strong>
            <TransactionAmount
              amount={amount}
              available={row.amountMinor !== null}
              tone={transactionTone(row)}
            />
          </strong>
          <span
            className={directionIsExplicit(row) ? "sr-only" : "table-secondary"}
          >
            {row.direction === TransactionDirection.DEBIT ? "Saída" : "Entrada"}
          </span>
          {current !== null && total !== null && (
            <span className="table-secondary">
              Parcela {current}/{total}
            </span>
          )}
          {!!editing && (
            <DropdownMenu>
              <Tooltip
                content={`Ações de ${row.description || "transação"}`}
                render={
                  <DropdownMenu.Trigger
                    render={
                      <UiButton
                        aria-label={`Ações de ${row.description || "transação"}`}
                        className="transaction-row-menu"
                        shape="square"
                        type="button"
                        variant="ghost"
                      />
                    }
                  >
                    <DotsThreeIcon size={20} />
                  </DropdownMenu.Trigger>
                }
              />
              <DropdownMenu.Content>
                <DropdownMenu.Item
                  className="flex items-center gap-2"
                  onClick={categorize}
                >
                  <PencilSimpleIcon size={16} />
                  Categorizar
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  className="flex items-center gap-2"
                  onClick={createRule}
                >
                  <FlowArrowIcon size={16} />
                  Criar regra
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu>
          )}
        </Table.Cell>
      </Table.Row>
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
          category={displayedCategory}
          categoryAppearance={variedCategories ? undefined : categoryAppearance}
          referenceDay={referenceDay}
          row={row}
        />
      </WorkspaceDialog>
    </Dialog.Root>
  );
}

function TransactionIdentity({
  row,
  account,
  appearance,
  category,
  categoryAppearance,
  showOwner,
  trigger,
  pendingLabel,
  futureLabel,
}: {
  row: Transaction | PortalTransaction;
  account: string;
  appearance: AccountAppearance | undefined;
  category: string;
  categoryAppearance: CategoryAppearance | undefined;
  showOwner: boolean;
  trigger: Ref<HTMLButtonElement>;
  pendingLabel: string;
  futureLabel: string | undefined;
}) {
  const editing = useTransactionEditing();
  const categorize = useCallback(
    () => editing?.(row, "category"),
    [editing, row],
  );
  const label = (
    <CategoryLabel
      category={categoryAppearance}
      label={category}
    />
  );
  return (
    <div className="transaction-identity-row">
      <AccountAvatar
        account={appearance ?? { name: account }}
        person={
          showOwner ? { id: row.personId, name: row.personName } : undefined
        }
      />
      <div>
        <Dialog.Trigger
          aria-label={`Ver detalhes de ${row.description || "Sem descrição"}`}
          render={
            <UiButton
              className="transaction-open"
              ref={trigger}
              type="button"
              variant="ghost"
            />
          }
        >
          {row.description || "Sem descrição"}
        </Dialog.Trigger>
        <div className="transaction-meta">
          <span className="table-secondary">
            {editing ? (
              <UiButton
                aria-label={`${category}, categorizar ${row.description || "transação"}`}
                className="transaction-category-button"
                onClick={categorize}
                type="button"
                variant="ghost"
              >
                {label}
                <PencilSimpleIcon size={14} />
              </UiButton>
            ) : (
              label
            )}
          </span>
          {!!pendingLabel && <Badge variant="warning">{pendingLabel}</Badge>}
          {!!futureLabel && <Badge variant="info">{futureLabel}</Badge>}
          {!!row.ignored && <Badge variant="secondary">Ignorada</Badge>}
        </div>
      </div>
    </div>
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
          account={appearance ?? { name: account }}
          accountId={row.accountId}
          id={row.id}
        />
      ) : (
        installments.length > 0 && (
          <InstallmentTable
            account={appearance ?? { name: account }}
            installments={installments}
            referenceDay={referenceDay}
            total={total}
          />
        )
      )}
    </div>
  );
}

function transactionStates(
  row: Transaction | PortalTransaction,
  installments: Installment[],
  referenceDay: string | undefined,
) {
  const anchorDate = "anchorDate" in row ? row.anchorDate : row.date;
  const pending = installments.filter(
    (item) => item.status === TransactionStatus.PENDING,
  ).length;
  const future = installments.filter(
    (item) => !!referenceDay && item.date > referenceDay,
  ).length;
  let pendingLabel = row.status === TransactionStatus.PENDING ? "Pendente" : "";
  if (pending > 0) {
    pendingLabel = plural(pending, "pendente", "pendentes");
  }
  let futureLabel = referenceDay && anchorDate > referenceDay ? "Futura" : "";
  if (future > 0) {
    futureLabel = plural(future, "futura", "futuras");
  }
  return { futureLabel, pendingLabel };
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
