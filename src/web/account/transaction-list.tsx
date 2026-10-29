import { Badge } from "@cloudflare/kumo/components/badge";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Table } from "@cloudflare/kumo/components/table";
import { FlowArrowIcon, PencilSimpleIcon } from "@phosphor-icons/react";
import {
  type PointerEvent,
  type Ref,
  useCallback,
  useRef,
  useState,
} from "react";
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
import { deferred, prefetch, useShown } from "./deferred";
import { RowMenu } from "./row-menu";
import { useTransactionEditing } from "./transaction-actions";
import { dayLabel } from "./workspace-resource";

export type Transaction = z.infer<
  typeof TransactionListSchema
>["data"]["records"][number];
export type PortalTransaction = z.infer<
  typeof PortalTransactionListSchema
>["data"]["records"][number];
type Installment = PortalTransaction["installments"][number];

const loadDetail = async () =>
  (await import("./transaction-detail-dialog")).TransactionDetailDialog;
const TransactionDetailDialog = deferred(loadDetail);
const warmDetail = () => prefetch(loadDetail);

function plural(count: number, singular: string, multiple: string) {
  return `${count} ${count === 1 ? singular : multiple}`;
}

export function amountLabel(row: Transaction) {
  if (row.amountMinor === null) {
    return `Valor indisponível · ${row.currency}`;
  }
  const label = formatBalance(row.amountMinor, row.currency);
  return row.direction === TransactionDirection.CREDIT &&
    BigInt(row.amountMinor) > 0n
    ? `+${label}`
    : label;
}

export function TransactionAmount({
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
  showAvatar = true,
}: {
  records: Array<Transaction | PortalTransaction>;
  accounts: Array<AccountAppearance & { id: string }>;
  categories: CategoryAppearance[];
  referenceDay?: string;
  showOwner?: boolean;
  // Nested lists hide the avatar when the parent already identifies the card.
  showAvatar?: boolean;
}) {
  const editing = useTransactionEditing();
  return (
    <LayerCard className="financial-surface transaction-surface">
      <Table
        aria-label="Lançamentos"
        className="transaction-table"
        layout="fixed"
      >
        <colgroup>
          <col className="transaction-description-column" />
          <col className="transaction-category-column" />
          <col className="transaction-date-column" />
          <col className="transaction-money-column" />
          {!!editing && <col className="transaction-actions-column" />}
        </colgroup>
        <Table.Header>
          <Table.Row>
            <Table.Head>Descrição</Table.Head>
            <Table.Head>Categoria</Table.Head>
            <Table.Head>Data</Table.Head>
            <Table.Head className="money-heading">Valor e moeda</Table.Head>
            {!!editing && (
              <Table.Head>
                <span className="sr-only">Ações</span>
              </Table.Head>
            )}
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
                showAvatar={showAvatar}
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

// States sit under the amount so both columns of a row keep similar heights.
function TransactionStates({
  pendingLabel,
  futureLabel,
  ignored,
}: {
  pendingLabel: string;
  futureLabel: string | undefined;
  ignored: boolean;
}) {
  if (!(pendingLabel || futureLabel || ignored)) {
    return null;
  }
  return (
    <span className="transaction-states">
      {!!pendingLabel && <Badge variant="warning">{pendingLabel}</Badge>}
      {!!futureLabel && <Badge variant="info">{futureLabel}</Badge>}
      {ignored === true && <Badge variant="secondary">Ignorada</Badge>}
    </span>
  );
}

function TransactionItem({
  row,
  account,
  appearance,
  category,
  categoryAppearance,
  referenceDay,
  showOwner,
  showAvatar,
}: {
  row: Transaction | PortalTransaction;
  account: string;
  appearance?: AccountAppearance | undefined;
  category: string;
  categoryAppearance?: CategoryAppearance | undefined;
  referenceDay: string | undefined;
  showOwner: boolean;
  showAvatar: boolean;
}) {
  const trigger = useRef<HTMLButtonElement>(null);
  const editing = useTransactionEditing();
  const [detail, setDetail] = useState(false);
  const shown = useShown(detail);
  const showDetail = useCallback(() => setDetail(true), []);
  const categorize = useCallback(
    () => editing?.(row, "category"),
    [editing, row],
  );
  const createRule = useCallback(() => editing?.(row, "rule"), [editing, row]);
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
  // Pending states only appear in the detail dialog to keep the ledger quiet.
  const { futureLabel } = transactionStates(row, installments, referenceDay);
  const actionsLabel = `Ações de ${row.description || "transação"}`;
  return (
    <>
      <Table.Row
        className="transaction-row"
        data-wide-amount={amount.length > 22}
        onPointerUp={openRow}
      >
        <Table.Cell data-label="Descrição">
          <TransactionIdentity
            account={account}
            appearance={appearance}
            open={showDetail}
            row={row}
            showAvatar={showAvatar}
            showOwner={showOwner}
            trigger={trigger}
          />
        </Table.Cell>
        <Table.Cell data-label="Categoria">
          <CategoryLabel
            category={variedCategories ? undefined : categoryAppearance}
            label={displayedCategory}
          />
        </Table.Cell>
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
          <TransactionStates
            futureLabel={futureLabel}
            ignored={row.ignored}
            pendingLabel=""
          />
        </Table.Cell>
        {!!editing && (
          <Table.Cell className="transaction-actions-cell">
            <RowMenu
              items={[
                {
                  icon: <PencilSimpleIcon size={16} />,
                  key: "category",
                  label: "Categorizar",
                  onClick: categorize,
                },
                {
                  icon: <FlowArrowIcon size={16} />,
                  key: "rule",
                  label: "Criar regra",
                  onClick: createRule,
                },
              ]}
              label={actionsLabel}
            />
          </Table.Cell>
        )}
      </Table.Row>
      {shown === true && (
        <TransactionDetailDialog
          account={account}
          appearance={appearance}
          category={displayedCategory}
          categoryAppearance={variedCategories ? undefined : categoryAppearance}
          open={detail}
          referenceDay={referenceDay}
          row={row}
          setOpen={setDetail}
        />
      )}
    </>
  );
}

function TransactionIdentity({
  row,
  account,
  appearance,
  showAvatar,
  showOwner,
  trigger,
  open,
}: {
  row: Transaction | PortalTransaction;
  account: string;
  appearance: AccountAppearance | undefined;
  showAvatar: boolean;
  showOwner: boolean;
  trigger: Ref<HTMLButtonElement>;
  open: () => void;
}) {
  return (
    <div className="transaction-identity-row">
      {showAvatar === true && (
        <AccountAvatar
          account={appearance ?? { name: account }}
          person={
            showOwner ? { id: row.personId, name: row.personName } : undefined
          }
        />
      )}
      <div>
        <UiButton
          aria-haspopup="dialog"
          aria-label={`Ver detalhes de ${row.description || "Sem descrição"}`}
          className="transaction-open"
          onClick={open}
          onFocus={warmDetail}
          onPointerEnter={warmDetail}
          ref={trigger}
          type="button"
          variant="ghost"
        >
          {row.description || "Sem descrição"}
        </UiButton>
      </div>
    </div>
  );
}

export function transactionStates(
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
