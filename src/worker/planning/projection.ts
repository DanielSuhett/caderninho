import type { PlanningCommand } from "../../contracts";
import {
  AccountType,
  CategoryKind,
  connectionPartial,
  type FinancialIdentity,
  type FinancialIdentityFilter,
  fixedCategoryId,
  matchesFinancialIdentity,
  type PlanningAccount,
  PlanningError,
  type PlanningState,
  type PlanningTransaction,
  pluggyCategory,
  TransactionDirection,
  type TransactionEdit,
  type TransactionOrder,
  type TransactionProjection,
  TransactionStatus,
  transactionMatchesText,
} from "../../domain";
import type { PlanningRepository, PlanningSnapshot } from "./entity";

export function found<T>(row: T | undefined): T {
  if (!row) {
    throw new Error(PlanningError.NOT_FOUND);
  }
  return row;
}
export function inSpace<T extends { id: string; spaceId: string }>(
  rows: T[],
  id: string,
  spaceId: string,
): T {
  const row = found(rows.find((item) => item.id === id));
  if (row.spaceId !== spaceId) {
    throw new Error(PlanningError.SPACE_MISMATCH);
  }
  return row;
}
export function accounts(
  snapshot: PlanningSnapshot,
  state = snapshot.state,
): PlanningAccount[] {
  const settings = new Map(state.accounts.map((row) => [row.id, row]));
  const imported = snapshot.accounts.map((row) => {
    const setting = settings.get(row.id);
    return {
      ...row,
      hidden: setting?.hidden ?? false,
      name: setting?.name ?? row.name,
      spaceId: setting?.spaceId ?? "personal",
    };
  });
  return [
    ...imported,
    ...state.accounts
      .filter((row) => row.manual)
      .map((row) => ({
        balanceMinor: row.openingBalanceMinor ?? "0",
        balanceObservedAt: null,
        connectionId: null,
        currency: row.currency ?? "BRL",
        hidden: row.hidden,
        id: row.id,
        manual: true,
        name: row.name ?? "",
        personId: row.personId ?? "self",
        personName:
          snapshot.people.find((p) => p.id === (row.personId ?? "self"))
            ?.name ?? "Eu",
        profileId: null,
        spaceId: row.spaceId,
        type: row.type ?? AccountType.BANK,
      })),
  ];
}
export function cardCatalog(snapshot: PlanningSnapshot, state: PlanningState) {
  const result = new Map<
    string,
    {
      id: string;
      accountId: string;
      identity: FinancialIdentity | null;
      number: string;
      name: string;
      hidden: boolean;
      deleted: boolean;
      identified: boolean;
      personId: string;
      personInherited: boolean;
      personName: string;
      primary: boolean;
      spaceId: string;
    }
  >();
  for (const account of accounts(snapshot, state).filter(
    (a) => a.type === AccountType.CREDIT,
  )) {
    const settings = state.accounts.find((a) => a.id === account.id);
    const main =
      settings?.primaryCard ??
      snapshot.accountDetails.find((a) => a.id === account.id)?.cardNumber ??
      "main";
    const numbers = new Set([
      main,
      snapshot.accountDetails.find((a) => a.id === account.id)?.cardNumber ??
        "main",
    ]);
    // Additional card membership is recorded by the provider adapter as accountId:number.
    for (const setting of state.cards.filter(
      (c) => c.accountId === account.id,
    )) {
      numbers.add(setting.number);
    }
    for (const number of numbers) {
      const id = `${account.id}:${number}`;
      const setting = state.cards.find((c) => c.id === id);
      const owner = snapshot.people.find((p) => p.id === setting?.personId);
      result.set(id, {
        accountId: account.id,
        deleted: setting?.deleted ?? false,
        hidden: setting?.hidden ?? account.hidden,
        id,
        identified: !!setting && setting.name !== setting.number,
        identity: account.identity ?? null,
        name: setting?.name ?? account.name,
        number,
        personId: owner?.id ?? account.personId,
        personInherited: !owner,
        personName: owner?.name ?? account.personName,
        primary: number === main,
        spaceId: account.spaceId,
      });
    }
  }
  return [...result.values()];
}
// A card owner overrides the account holder. Charges without a card number
// follow the account's primary card, so every charge has exactly one owner.
export function cardOwnership(
  snapshot: PlanningSnapshot,
  state = snapshot.state,
) {
  const entries = cardCatalog(snapshot, state).filter(
    (entry) => !entry.deleted,
  );
  const byCard = new Map(entries.map((entry) => [entry.id, entry]));
  const primary = new Map(
    entries
      .filter((entry) => entry.primary)
      .map((entry) => [entry.accountId, entry]),
  );
  return {
    includesPerson(
      account: { id: string; personId: string },
      personId: string,
    ) {
      return (
        account.personId === personId ||
        entries.some(
          (entry) =>
            entry.accountId === account.id && entry.personId === personId,
        )
      );
    },
    ofCharge(accountId: string, number: string | null | undefined) {
      return (
        (number ? byCard.get(`${accountId}:${number}`) : undefined) ??
        primary.get(accountId)
      );
    },
  };
}
export interface Selection {
  accountId?: string | undefined;
  accountIds?: string[] | undefined;
  cardBrand?: string | undefined;
  cardNumber?: string | undefined;
  categoryId?: string | undefined;
  currency?: string | undefined;
  direction?: string | undefined;
  from?: string | undefined;
  include_ignored?: boolean | undefined;
  institutionId?: string | undefined;
  investments?: boolean;
  personId?: string | undefined;
  profileId?: string | undefined;
  spaceId: string;
  status?: string | undefined;
  tagId?: string | undefined;
  text?: string | undefined;
  to?: string | undefined;
  uncategorized?: boolean | undefined;
}
export function planningSelection(
  command: PlanningCommand,
  identityFilter: FinancialIdentityFilter = {},
): Selection {
  return {
    ...identityFilter,
    spaceId: command.spaceId,
    ...("personId" in command &&
      command.personId && { personId: command.personId }),
    ...("accountId" in command &&
      command.accountId && { accountId: command.accountId }),
    ...("categoryId" in command &&
      command.categoryId && { categoryId: command.categoryId }),
    ...("currency" in command &&
      command.currency && { currency: command.currency }),
    ...("tagId" in command && command.tagId && { tagId: command.tagId }),
    ...("cardNumber" in command &&
      command.cardNumber && { cardNumber: command.cardNumber }),
    ...("direction" in command &&
      command.direction && { direction: command.direction }),
    ...("status" in command && command.status && { status: command.status }),
    ...("text" in command && command.text && { text: command.text }),
    include_ignored: "include_ignored" in command && command.include_ignored,
    ...("uncategorized" in command &&
      command.uncategorized && { uncategorized: true }),
  };
}
export function validatePeriod(input: {
  from?: string | undefined;
  to?: string | undefined;
}) {
  if (input.from && input.to && input.from > input.to) {
    throw new Error(PlanningError.INVALID_PERIOD);
  }
}
export function validateSelection(
  selection: Selection,
  snapshot: PlanningSnapshot,
) {
  validatePeriod(selection);
  const space = found(
    snapshot.state.spaces.find((item) => item.id === selection.spaceId),
  );
  if (
    selection.personId &&
    !snapshot.people.some((person) => person.id === selection.personId)
  ) {
    throw new Error(PlanningError.NOT_FOUND);
  }
  const accountList = accounts(snapshot);
  const accountMap = new Map(accountList.map((row) => [row.id, row]));
  const ownership = cardOwnership(snapshot);
  if (selection.accountId) {
    const account = found(accountMap.get(selection.accountId));
    const moved = snapshot.state.edits.some(
      (edit) =>
        edit.accountId === account.id &&
        edit.spaceId === selection.spaceId &&
        !edit.deleted,
    );
    if (
      (account.spaceId !== selection.spaceId && !moved) ||
      (selection.personId &&
        !ownership.includesPerson(account, selection.personId))
    ) {
      throw new Error(PlanningError.SPACE_MISMATCH);
    }
  }
  if (selection.categoryId) {
    inSpace(snapshot.state.categories, selection.categoryId, selection.spaceId);
  }
  if (selection.tagId) {
    inSpace(snapshot.state.tags, selection.tagId, selection.spaceId);
  }
  return { accountList, accountMap, space };
}
export function transactionStream(
  repository: Pick<PlanningRepository, "transactions">,
  snapshot: PlanningSnapshot,
  state = snapshot.state,
) {
  const accountMap = new Map(
    accounts(snapshot, state).map((row) => [row.id, row]),
  );
  const edits = new Map(state.edits.map((row) => [row.id, row]));
  const details = new Map(
    snapshot.transactionDetails.map((row) => [row.id, row]),
  );
  const ownership = cardOwnership(snapshot, state);
  function effective(row: TransactionProjection): PlanningTransaction | null {
    const edit = edits.get(row.id);
    if (edit?.deleted) {
      return null;
    }
    const account = accountMap.get(edit?.accountId ?? row.accountId);
    const owner = ownership.ofCharge(
      edit?.accountId ?? row.accountId,
      details.get(row.id)?.cardNumber,
    );
    const spaceId = edit?.spaceId ?? account?.spaceId ?? "personal";
    const automatic = pluggyCategory(row.category);
    const sourceCategory = state.categories.some(
      (category) =>
        category.id === row.category && category.spaceId === spaceId,
    )
      ? row.category
      : automatic && fixedCategoryId(spaceId, automatic);
    return {
      ...row,
      ...edit,
      category: edit?.category === undefined ? sourceCategory : edit.category,
      goalId: edit?.goalId ?? null,
      ignored: edit?.ignored ?? false,
      manual: edit?.manual ?? false,
      personId: owner?.personId ?? account?.personId ?? "self",
      personName: owner?.personName ?? account?.personName ?? "Eu",
      profileId: account?.profileId ?? null,
      spaceId,
      tagIds: edit?.tagIds ?? [],
    };
  }
  function matches(row: PlanningTransaction, selection: Selection) {
    return (
      row.spaceId === selection.spaceId &&
      (!selection.personId || row.personId === selection.personId) &&
      (!selection.profileId || row.profileId === selection.profileId) &&
      (!selection.from || row.date >= selection.from) &&
      (!selection.to || row.date <= selection.to) &&
      (!selection.accountId || row.accountId === selection.accountId) &&
      (!selection.accountIds || selection.accountIds.includes(row.accountId)) &&
      matchesFinancialIdentity(
        accountMap.get(row.accountId)?.identity,
        selection,
      ) &&
      (!selection.categoryId || row.category === selection.categoryId) &&
      (!selection.uncategorized || row.category === null) &&
      (!selection.currency || row.currency === selection.currency) &&
      (!selection.tagId || row.tagIds.includes(selection.tagId)) &&
      (!selection.direction || row.direction === selection.direction) &&
      (!selection.status || row.status === selection.status) &&
      (!selection.text || transactionMatchesText(row, selection.text)) &&
      (selection.include_ignored || !row.ignored) &&
      (!selection.cardNumber ||
        details.get(row.id)?.cardNumber === selection.cardNumber)
    );
  }
  function manualProjection(edit: TransactionEdit) {
    const account = found(accountMap.get(edit.accountId ?? ""));
    return effective({
      accountId: account.id,
      amountMinor: edit.amountMinor ?? null,
      category: edit.category ?? null,
      currency: account.currency,
      date: edit.date ?? "",
      description: edit.description ?? "",
      direction: edit.direction ?? TransactionDirection.DEBIT,
      id: edit.id,
      status: edit.status ?? TransactionStatus.POSTED,
    });
  }
  function* manualRows(selection: Selection, ids?: string[]) {
    for (const edit of state.edits.filter(
      (row) => row.manual && !row.deleted && (!ids || ids.includes(row.id)),
    )) {
      const row = manualProjection(edit);
      if (row && matches(row, selection)) {
        yield row;
      }
    }
  }
  async function* projected(
    rows: AsyncIterable<TransactionProjection[]>,
    selection: Selection,
  ) {
    for await (const sourceRows of rows) {
      for (const row of sourceRows) {
        const value = effective(row);
        if (value && matches(value, selection)) {
          yield value;
        }
      }
    }
  }
  function selectedAccountIds(selection: Selection) {
    return [...accountMap.values()]
      .filter(
        (row) =>
          row.spaceId === selection.spaceId &&
          (!selection.accountIds || selection.accountIds.includes(row.id)) &&
          (!selection.accountId || row.id === selection.accountId) &&
          matchesFinancialIdentity(row.identity, selection) &&
          (!selection.personId ||
            ownership.includesPerson(row, selection.personId)) &&
          (!selection.profileId || row.profileId === selection.profileId),
      )
      .map((row) => row.id);
  }
  return async function* (
    selection: Selection,
    ids?: string[],
    page?: { order: TransactionOrder; after: string; limit: number },
  ) {
    validatePeriod(selection);
    yield* manualRows(selection, ids);
    if (ids) {
      yield* projected(repository.transactions(ids), selection);
      return;
    }
    // Edits can move a source row into the selection across dates/accounts.
    const editedIds = [...edits.values()]
      .filter((row) => !row.manual)
      .map((row) => row.id);
    if (editedIds.length) {
      yield* projected(repository.transactions(editedIds), selection);
    }
    const sources = repository.transactions(undefined, {
      accountIds: selectedAccountIds(selection),
      excludeIds: editedIds,
      from: selection.from,
      to: selection.to,
      ...(page && {
        after: page.after,
        order: page.order,
        pageSize: Math.min(500, page.limit),
      }),
    });
    let count = 0;
    for await (const row of projected(sources, selection)) {
      yield row;
      count += 1;
      if (page && count >= page.limit) {
        return;
      }
    }
  };
}

export function planningCoverage(
  snapshot: PlanningSnapshot,
  selection: Selection,
) {
  const movedAccountIds = new Set(
    snapshot.state.edits
      .filter((edit) => !edit.deleted && edit.spaceId === selection.spaceId)
      .flatMap((edit) => (edit.accountId ? [edit.accountId] : [])),
  );
  const ownership = cardOwnership(snapshot);
  const selectedAccounts = accounts(snapshot).filter(
    (row) =>
      !selection.investments &&
      (row.spaceId === selection.spaceId || movedAccountIds.has(row.id)) &&
      (!selection.personId ||
        ownership.includesPerson(row, selection.personId)) &&
      (!selection.accountId || row.id === selection.accountId) &&
      (!selection.accountIds || selection.accountIds.includes(row.id)) &&
      matchesFinancialIdentity(row.identity, selection),
  );
  const connectionIds = new Set(
    selectedAccounts.flatMap((row) =>
      row.connectionId ? [row.connectionId] : [],
    ),
  );
  const investments = selection.investments
    ? snapshot.state.investments.filter((row) => {
        const ownerId =
          snapshot.owners.find(
            (owner) => owner.connectionId === row.connectionId,
          )?.personId ??
          row.personId ??
          "self";
        return (
          row.spaceId === selection.spaceId &&
          (!selection.personId || ownerId === selection.personId)
        );
      })
    : [];
  for (const row of investments) {
    if (row.connectionId) {
      connectionIds.add(row.connectionId);
    }
  }
  const origins = snapshot.connections.filter((row) => {
    if (connectionIds.has(row.id)) {
      return true;
    }
    const personId =
      snapshot.owners.find((owner) => owner.connectionId === row.id)
        ?.personId ?? "self";
    return (
      !selection.accountId &&
      selection.spaceId === "personal" &&
      (selection.investments || !Object.keys(row.accounts).length) &&
      (!selection.personId || personId === selection.personId)
    );
  });
  const successes = origins.map((row) => row.lastSuccessAt);
  let kind = "empty";
  if (origins.length) {
    kind = "imported";
  } else if (
    selectedAccounts.some((row) => row.manual) ||
    investments.some((row) => row.manual)
  ) {
    kind = "local_only";
  }
  return {
    connectionIds: origins.map((row) => row.id).sort(),
    kind,
    oldestLastSuccessAt:
      !successes.length || successes.some((value) => value === null)
        ? null
        : (successes.sort()[0] ?? null),
    partial: origins.some(connectionPartial),
  };
}
export async function selectedTransactions(
  stream: ReturnType<typeof transactionStream>,
  selection: Selection,
  ids?: string[],
) {
  const rows: PlanningTransaction[] = [];
  for await (const row of stream(
    { ...selection, include_ignored: true },
    ids,
  )) {
    rows.push(row);
    if (rows.length > 500) {
      throw new Error(PlanningError.SELECTION_TOO_LARGE);
    }
  }
  if (ids && (new Set(ids).size !== ids.length || rows.length !== ids.length)) {
    throw new Error(PlanningError.NOT_FOUND);
  }
  return rows;
}
export function classification(row: PlanningTransaction, state: PlanningState) {
  const category = state.categories.find(
    (item) => item.id === row.category && item.spaceId === row.spaceId,
  );
  if (category) {
    // A loan advance is neither income nor a negative repayment expense.
    if (
      row.category === fixedCategoryId(row.spaceId, "financiamento") &&
      row.direction === TransactionDirection.CREDIT
    ) {
      return CategoryKind.transfer;
    }
    return category.kind;
  }
  // Provider operation and category labels do not establish a local classification.
  return "unclassified";
}
