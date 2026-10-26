import {
  PlanningCursorSchema,
  type PortalQuery,
  type PortalQueryResults,
} from "../contracts";
import { matchesFinancialIdentity, transactionMatchesText } from "../domain";
import { installmentGroupKey } from "../domain/card-installments";
import { demoReferenceDay } from "../fixtures/finance";
import type { DemoData } from "./demo-data";

export function demoTransactionDetail(
  query: Extract<PortalQuery, { tool: "get_portal_transactions" }>,
  data: DemoData,
  revision: number,
): PortalQueryResults["get_portal_transactions"] {
  if (!query.transactionId) {
    return demoTransactionPage(query, data, revision);
  }
  const row = data.records.find(
    (item) =>
      item.id === query.transactionId &&
      (!query.accountId || item.accountId === query.accountId) &&
      (!query.personId || item.personId === query.personId) &&
      matchesFinancialIdentity(
        data.accounts.find((account) => account.id === item.accountId)
          ?.identity,
        query,
      ),
  );
  if (!row) {
    return {
      data: {
        cursor: null,
        records: [],
        referenceDay: demoReferenceDay,
        revision,
      },
      partial: false,
    };
  }
  const key = installmentGroupKey(row);
  const members = key
    ? data.records.filter((item) => installmentGroupKey(item) === key)
    : [];
  const numbers = members.map((item) => item.installmentNumber);
  const installments =
    new Set(numbers).size === numbers.length
      ? members.toSorted(
          (a, b) => (a.installmentNumber ?? 0) - (b.installmentNumber ?? 0),
        )
      : [];
  return {
    data: {
      cursor: null,
      records: [{ ...row, installments }],
      referenceDay: demoReferenceDay,
      revision,
    },
    partial: false,
  };
}

function demoTransactionPage(
  query: Extract<PortalQuery, { tool: "get_portal_transactions" }>,
  data: DemoData,
  revision: number,
): PortalQueryResults["get_portal_transactions"] {
  const groups = new Map<string, DemoData["records"]>();
  for (const row of data.records) {
    if (
      (!query.include_ignored && row.ignored) ||
      (query.accountId && row.accountId !== query.accountId) ||
      (query.personId && row.personId !== query.personId) ||
      !matchesFinancialIdentity(
        data.accounts.find((account) => account.id === row.accountId)?.identity,
        query,
      )
    ) {
      continue;
    }
    const key = installmentGroupKey(row) ?? row.id;
    const members = groups.get(key) ?? [];
    members.push(row);
    groups.set(key, members);
  }
  const records = [...groups.values()].flatMap((members) => {
    const first = members
      .toSorted((a, b) => a.date.localeCompare(b.date))
      .at(0);
    if (!first) {
      return [];
    }
    if (
      new Set(members.map((row) => row.installmentNumber)).size !==
      members.length
    ) {
      return members;
    }
    return [
      {
        ...first,
        anchorDate: first.purchaseDate ?? first.date,
        anchorKind: first.purchaseDate
          ? ("purchase" as const)
          : first.anchorKind,
        installments: first.totalInstallments ? members : [],
      },
    ];
  });
  const matches = (row: DemoData["records"][number]) => {
    const members = row.installments.length ? row.installments : [row];
    return (
      (query.future
        ? row.anchorDate > demoReferenceDay
        : row.anchorDate <= demoReferenceDay) &&
      (!query.from || row.anchorDate >= query.from) &&
      (!query.to || row.anchorDate <= query.to) &&
      (!query.currency || row.currency === query.currency) &&
      (!query.categoryId ||
        members.some((item) => item.category === query.categoryId)) &&
      (!query.direction ||
        members.some((item) => item.direction === query.direction)) &&
      (!query.status || members.some((item) => item.status === query.status)) &&
      (!query.text ||
        members.some((item) => transactionMatchesText(item, query.text ?? "")))
    );
  };
  const selected = records.filter(matches);
  const uncategorized = (row: DemoData["records"][number]) =>
    row.category === null ||
    row.installments.some((item) => item.category === null);
  const listed = selected
    .filter((row) => !query.uncategorized || uncategorized(row))
    .toSorted(
      (a, b) =>
        b.anchorDate.localeCompare(a.anchorDate) || b.id.localeCompare(a.id),
    );
  const { cursor, limit = 100, ...filter } = query;
  const selection = JSON.stringify(filter);
  let offset = 0;
  if (cursor) {
    const [version, scope, after] = PlanningCursorSchema.parse(
      JSON.parse(cursor),
    );
    offset = listed.findIndex((row) => row.id === after) + 1;
    if (version !== revision || scope !== selection || !offset) {
      throw new Error("RESTART_REQUIRED");
    }
  }
  const page = listed.slice(offset, offset + limit);
  const last = page.at(-1);
  return {
    data: {
      cursor:
        last && offset + limit < listed.length
          ? JSON.stringify([revision, selection, last.id])
          : null,
      records: page,
      referenceDay: demoReferenceDay,
      revision,
      uncategorizedCount: selected.filter(uncategorized).length,
    },
    partial: false,
  };
}
