import type { PlanningCommand } from "../../contracts";
import type {
  PlanningAccount,
  PlanningState,
  PlanningTransaction,
  TransactionProjection,
} from "../../domain";
import {
  CLASSIFICATION_VERSION,
  connectionPartial,
  fixedCategoryId,
  pluggyCategory,
  transactionMatchesText,
} from "../../domain";
import type { PlanningRepository, PlanningSnapshot } from "./entity";

export function found<T>(row: T | undefined): T {
  if (!row) {
    throw new Error("NOT_FOUND");
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
    throw new Error("SPACE_MISMATCH");
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
        type: row.type ?? "BANK",
      })),
  ];
}
export interface Selection {
  accountId?: string | undefined;
  accountIds?: string[] | undefined;
  cardNumber?: string | undefined;
  categoryId?: string | undefined;
  currency?: string | undefined;
  direction?: string | undefined;
  from?: string | undefined;
  include_ignored?: boolean | undefined;
  investments?: boolean;
  personId?: string | undefined;
  profileId?: string | undefined;
  spaceId: string;
  status?: string | undefined;
  tagId?: string | undefined;
  text?: string | undefined;
  to?: string | undefined;
}
export function planningSelection(command: PlanningCommand): Selection {
  return {
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
  };
}
export function validatePeriod(input: {
  from?: string | undefined;
  to?: string | undefined;
}) {
  if (input.from && input.to && input.from > input.to) {
    throw new Error("INVALID_PERIOD");
  }
}
export function transactionStream(
  repository: PlanningRepository,
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
  function effective(row: TransactionProjection): PlanningTransaction | null {
    const edit = edits.get(row.id);
    if (edit?.deleted) {
      return null;
    }
    const account = accountMap.get(edit?.accountId ?? row.accountId);
    const spaceId = edit?.spaceId ?? account?.spaceId ?? "personal";
    const automatic =
      snapshot.clefEnabled &&
      row.classification?.version === CLASSIFICATION_VERSION
        ? row.classification.category
        : pluggyCategory(row.category);
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
      personId: account?.personId ?? "self",
      personName: account?.personName ?? "Eu",
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
      (!selection.categoryId || row.category === selection.categoryId) &&
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
  function manualProjection(edit: import("../../domain").TransactionEdit) {
    const account = found(accountMap.get(edit.accountId ?? ""));
    return effective({
      accountId: account.id,
      amountMinor: edit.amountMinor ?? null,
      category: edit.category ?? null,
      currency: account.currency,
      date: edit.date ?? "",
      description: edit.description ?? "",
      direction: edit.direction ?? "DEBIT",
      id: edit.id,
      status: edit.status ?? "POSTED",
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
          (!selection.personId || row.personId === selection.personId) &&
          (!selection.profileId || row.profileId === selection.profileId),
      )
      .map((row) => row.id);
  }
  return async function* (
    selection: Selection,
    ids?: string[],
    page?: { order: "id" | "date_desc"; after: string; limit: number },
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
  const selectedAccounts = accounts(snapshot).filter(
    (row) =>
      !selection.investments &&
      (row.spaceId === selection.spaceId || movedAccountIds.has(row.id)) &&
      (!selection.personId || row.personId === selection.personId) &&
      (!selection.accountId || row.id === selection.accountId) &&
      (!selection.accountIds || selection.accountIds.includes(row.id)),
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
      throw new Error("SELECTION_TOO_LARGE");
    }
  }
  if (ids && (new Set(ids).size !== ids.length || rows.length !== ids.length)) {
    throw new Error("NOT_FOUND");
  }
  return rows;
}
export function classification(
  row: PlanningTransaction,
  state: PlanningState,
  operationType: string | null,
) {
  const category = state.categories.find(
    (item) => item.id === row.category && item.spaceId === row.spaceId,
  );
  if (category) {
    // A loan advance is neither income nor a negative repayment expense.
    if (
      row.category === fixedCategoryId(row.spaceId, "financiamento") &&
      row.direction === "CREDIT"
    ) {
      return "transfer";
    }
    return category.kind;
  }
  if (
    operationType &&
    [
      "PIX",
      "TED",
      "DOC",
      "TRANSFERENCIA_MESMA_INSTITUICAO",
      "PAGAMENTO",
      "PAGAMENTO_FATURA",
      "RESGATE_APLIC_FINANCEIRA",
      "OPERACAO_CREDITO",
    ].includes(operationType)
  ) {
    return "unclassified";
  }
  // Provider category names are not a stable classification contract.
  return "unclassified";
}
