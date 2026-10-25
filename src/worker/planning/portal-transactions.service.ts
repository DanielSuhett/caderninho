import type { z } from "zod/v4";

import type {
  PortalTransactionListSchema,
  PortalTransactionQuery,
} from "../../contracts";
import {
  localDay,
  monthDate,
  type TransactionDetails,
  transactionMatchesText,
} from "../../domain";
import { planningCursor } from "./cursor";
import type { PlanningRepository, PlanningSnapshot } from "./entity";
import { found, transactionStream, validateSelection } from "./projection";

type PageRow = z.infer<
  typeof PortalTransactionListSchema
>["data"]["records"][number];
type InstallmentRow = PageRow["installments"][number];

function installmentKey(row: InstallmentRow) {
  if (row.installmentNumber === null || row.totalInstallments === null) {
    return null;
  }
  if (
    row.direction !== "DEBIT" ||
    row.totalInstallments < 2 ||
    row.installmentNumber < 1 ||
    row.installmentNumber > row.totalInstallments
  ) {
    return null;
  }
  const firstMonth = row.purchaseDate
    ? ""
    : monthDate(row.date, 1 - row.installmentNumber).slice(0, 7);
  return JSON.stringify([
    row.accountId,
    row.cardNumber,
    row.currency,
    row.description.trim().toLocaleLowerCase(),
    row.amountMinor,
    row.totalInstallments,
    row.purchaseDate ? `purchase:${row.purchaseDate}` : `month:${firstMonth}`,
  ]);
}

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
    (input.future ? row.anchorDate > day : row.anchorDate <= day) &&
    (!input.from || row.anchorDate >= input.from) &&
    (!input.to || row.anchorDate <= input.to) &&
    (!input.categoryId ||
      members.some((member) => member.category === input.categoryId)) &&
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
  row: import("../../domain").PlanningTransaction,
  details: TransactionDetails | undefined,
): InstallmentRow {
  return {
    accountId: row.accountId,
    amountMinor: row.amountMinor,
    cardNumber: details?.cardNumber ?? null,
    category: row.category,
    classification: row.classification ?? null,
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
  const creditAccounts = new Set(
    accountList
      .filter((account) => account.type === "CREDIT")
      .map((account) => account.id),
  );
  const groups = new Map<string, InstallmentRow[]>();
  const selected: { key: string; row: PageRow }[] = [];
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
    if (!matches(row, members, input, day) || (after && key(row) >= after)) {
      return;
    }
    retainBest({ key: key(row), row });
  }
  const stream = transactionStream(repository, snapshot);
  for await (const page of stream({
    accountId: input.accountId,
    currency: input.currency,
    include_ignored: input.include_ignored,
    personId: input.personId,
    spaceId: input.spaceId,
  })) {
    const item = record(page, details.get(page.id));
    const groupKey = creditAccounts.has(item.accountId)
      ? installmentKey(item)
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
  };
}
