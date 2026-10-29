import type { z } from "zod/v4";

import type {
  PortalTransactionListSchema,
  PortalTransactionQuery,
} from "../../contracts";
import {
  AccountType,
  localDay,
  type PlanningTransaction,
  type TransactionDetails,
  transactionMatchesText,
} from "../../domain";
import { installmentGroupKey } from "../../domain/card-installments";
import { transactionBillPayments } from "./bills.service";
import { planningCursor } from "./cursor";
import type { PlanningRepository, PlanningSnapshot } from "./entity";
import {
  cardCatalog,
  found,
  transactionStream,
  validateSelection,
} from "./projection";

type PageRow = z.infer<
  typeof PortalTransactionListSchema
>["data"]["records"][number];
type InstallmentRow = PageRow["installments"][number];

function pageRow(members: InstallmentRow[], ambiguous = false): PageRow {
  const sorted = members.toSorted(
    (a, b) =>
      (a.installmentNumber ?? 0) - (b.installmentNumber ?? 0) ||
      a.date.localeCompare(b.date) ||
      a.id.localeCompare(b.id),
  );
  const [first] = sorted;
  if (!first) {
    throw new Error("EMPTY_TRANSACTION_GROUP");
  }
  const purchaseDate = ambiguous ? null : first.purchaseDate;
  const anchorDate =
    purchaseDate ??
    sorted.reduce(
      (earliest, row) => (row.date < earliest ? row.date : earliest),
      first.date,
    );
  let anchorKind: PageRow["anchorKind"] = "transaction";
  if (!ambiguous && purchaseDate) {
    anchorKind = "purchase";
  } else if (!ambiguous && first.totalInstallments) {
    anchorKind = "first_seen";
  }
  return {
    ...first,
    anchorDate: ambiguous ? first.date : anchorDate,
    anchorKind,
    installments: first.totalInstallments && !ambiguous ? sorted : [],
  };
}

function matches(
  row: PageRow,
  members: InstallmentRow[],
  input: PortalTransactionQuery,
  day: string,
) {
  return (
    (!input.transactionId ||
      members.some((member) => member.id === input.transactionId)) &&
    (!!input.transactionId ||
      (input.future ? row.anchorDate > day : row.anchorDate <= day)) &&
    (!input.from || row.anchorDate >= input.from) &&
    (!input.to || row.anchorDate <= input.to) &&
    (!input.categoryId ||
      members.some((member) => member.category === input.categoryId)) &&
    (!input.uncategorized ||
      members.some((member) => member.category === null)) &&
    (!input.direction ||
      members.some((member) => member.direction === input.direction)) &&
    (!input.status ||
      members.some((member) => member.status === input.status)) &&
    (!input.text ||
      members.some((member) =>
        transactionMatchesText(member, input.text ?? ""),
      ))
  );
}

function record(
  row: PlanningTransaction,
  details: TransactionDetails | undefined,
  billPayment: InstallmentRow["billPayment"],
): InstallmentRow {
  return {
    accountId: row.accountId,
    amountMinor: row.amountMinor,
    billPayment,
    cardNumber: details?.cardNumber ?? null,
    category: row.category,
    currency: row.currency,
    date: row.date,
    description: row.description,
    direction: row.direction,
    id: row.id,
    identification: row.identification ?? null,
    ignored: row.ignored,
    installmentNumber: details?.installmentNumber ?? null,
    manual: row.manual,
    personId: row.personId,
    personName: row.personName,
    purchaseDate: details?.purchaseDate ?? null,
    status: row.status,
    totalInstallments: details?.totalInstallments ?? null,
  };
}

// Charges without a known card number follow the primary card, as in Cartões.
function cardFilter(input: PortalTransactionQuery, snapshot: PlanningSnapshot) {
  if (!input.cardId) {
    return;
  }
  const catalog = cardCatalog(snapshot, snapshot.state).filter(
    (entry) => !entry.deleted,
  );
  const card = found(
    catalog.find(
      (entry) => entry.id === input.cardId && entry.spaceId === input.spaceId,
    ),
  );
  const numbers = new Set(
    catalog
      .filter((entry) => entry.accountId === card.accountId)
      .map((entry) => entry.number),
  );
  return (row: InstallmentRow) =>
    row.accountId === card.accountId &&
    (row.cardNumber === card.number ||
      (card.primary && !numbers.has(row.cardNumber ?? "")));
}

export async function portalTransactions(
  input: PortalTransactionQuery,
  snapshot: PlanningSnapshot,
  repository: PlanningRepository,
  now: Date,
) {
  const { accountList } = validateSelection(input, snapshot);
  const day = localDay(now);
  const { cursor, limit, tool: _tool, ...filter } = input;
  const cursorState = await planningCursor({
    cursor,
    filter: { ...filter, referenceDay: day },
    revision: snapshot.revision,
  });
  const { after } = cursorState;
  const details = new Map(
    snapshot.transactionDetails.map((item) => [item.id, item]),
  );
  const ofCard = cardFilter(input, snapshot);
  const creditAccounts = new Set(
    accountList
      .filter((account) => account.type === AccountType.CREDIT)
      .map((account) => account.id),
  );
  const groups = new Map<string, InstallmentRow[]>();
  const billPayment = transactionBillPayments(snapshot);
  const selected: { key: string; row: PageRow }[] = [];
  let uncategorizedCount = 0;
  const { categoryId: _categoryId, ...reviewScope } = input;
  const reviewSelection = { ...reviewScope, uncategorized: true };
  const key = (row: PageRow) => `${row.anchorDate}:${row.id}`;
  function retainBest(candidate: { key: string; row: PageRow }) {
    if (selected.length < limit + 1) {
      selected.push(candidate);
      let index = selected.length - 1;
      while (index > 0) {
        const parent = Math.floor((index - 1) / 2);
        if (found(selected[parent]).key.localeCompare(candidate.key) <= 0) {
          break;
        }
        selected[index] = found(selected[parent]);
        index = parent;
      }
      selected[index] = candidate;
      return;
    }
    if (found(selected[0]).key.localeCompare(candidate.key) >= 0) {
      return;
    }
    let index = 0;
    while (index * 2 + 1 < selected.length) {
      const left = index * 2 + 1;
      const right = left + 1;
      const child =
        right < selected.length &&
        found(selected[right]).key.localeCompare(found(selected[left]).key) < 0
          ? right
          : left;
      if (found(selected[child]).key.localeCompare(candidate.key) >= 0) {
        break;
      }
      selected[index] = found(selected[child]);
      index = child;
    }
    selected[index] = candidate;
  }
  function add(row: PageRow, members: InstallmentRow[]) {
    if (matches(row, members, reviewSelection, day)) {
      uncategorizedCount += 1;
    }
    if (!matches(row, members, input, day) || (after && key(row) >= after)) {
      return;
    }
    retainBest({ key: key(row), row });
  }
  const stream = transactionStream(repository, snapshot);
  for await (const page of stream({
    accountId: input.accountId,
    cardBrand: input.cardBrand,
    currency: input.currency,
    include_ignored: input.include_ignored,
    institutionId: input.institutionId,
    personId: input.personId,
    spaceId: input.spaceId,
  })) {
    const extra = details.get(page.id);
    const item = record(page, extra, billPayment(page, extra));
    if (
      (ofCard && !ofCard(item)) ||
      (input.cardsOnly && !creditAccounts.has(item.accountId))
    ) {
      continue;
    }
    const groupKey = creditAccounts.has(item.accountId)
      ? installmentGroupKey(item)
      : null;
    if (!groupKey) {
      add(pageRow([item]), [item]);
      continue;
    }
    const bucket = groups.get(groupKey) ?? [];
    bucket.push(item);
    groups.set(groupKey, bucket);
  }
  for (const bucket of groups.values()) {
    const numbers = bucket.map((item) => item.installmentNumber);
    if (new Set(numbers).size !== numbers.length) {
      for (const item of bucket) {
        add(pageRow([item], true), [item]);
      }
      continue;
    }
    add(pageRow(bucket), bucket);
  }
  selected.sort((a, b) => b.key.localeCompare(a.key));
  const more = selected.length > limit;
  const records = selected.slice(0, limit).map((item) => item.row);
  const last = records.at(-1);
  return {
    cursor: more && last ? cursorState.encode(key(last)) : null,
    records,
    referenceDay: day,
    revision: snapshot.revision,
    uncategorizedCount,
  };
}
