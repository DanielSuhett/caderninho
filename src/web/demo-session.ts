import type { z } from "zod/v4";

import type {
  PortalMutationSchema,
  PortalQuery,
  PortalQueryResults,
  WorkspaceCatalog,
} from "../contracts";
import { activeRules, categoryCatalog, ruleMatches } from "../domain";
import {
  type DemoRecord,
  demoAccounts,
  demoLedger,
  demoPeople,
} from "../fixtures/finance";
import { workspaceFixture } from "../fixtures/workspace";
import type { OrganizationApi } from "./account/account-api";
import type { DemoData } from "./demo-data";
import { randomId } from "./random-id";

type Group = Omit<WorkspaceCatalog, "spaces">;
type ParsedMutation = z.output<typeof PortalMutationSchema>["command"];
type RuleCommand = Extract<
  ParsedMutation,
  { tool: "create_rule" | "update_rule" }
>;
function required<T>(value: T | undefined): T {
  if (value === undefined) {
    throw new Error("NOT_FOUND");
  }
  return value;
}
function validateRule(command: RuleCommand, group: Group, data: DemoData) {
  if (!(command.text || command.filter)) {
    throw new Error("INVALID_RULE");
  }
  required(
    group.categories.find((category) => category.id === command.categoryId),
  );
  const accounts = new Set(data.accounts.map((account) => account.id));
  if (command.accountId && !accounts.has(command.accountId)) {
    throw new Error("NOT_FOUND");
  }
  for (const condition of command.filter?.alternatives.flatMap(
    (alternative) => alternative.conditions,
  ) ?? []) {
    if (condition.field === "accountId" && !accounts.has(condition.value)) {
      throw new Error("NOT_FOUND");
    }
    if (
      condition.field === "personId" &&
      !demoPeople.some((person) => person.id === condition.value)
    ) {
      throw new Error("NOT_FOUND");
    }
  }
}

function updateDemoCategory(
  group: Group,
  command: Extract<ParsedMutation, { tool: "update_category" }>,
) {
  const row = required(group.categories.find((item) => item.id === command.id));
  if (
    row.system &&
    (command.name !== undefined || command.hidden !== undefined)
  ) {
    throw new Error("SYSTEM_CATEGORY");
  }
  if (command.groupId) {
    required(group.categoryGroups.find((item) => item.id === command.groupId));
  }
  if (command.name !== undefined) {
    row.name = command.name;
  }
  if (command.hidden !== undefined) {
    row.hidden = command.hidden;
  }
  if (command.icon !== undefined) {
    row.icon = command.icon;
  }
  if (command.color !== undefined) {
    row.color = command.color;
  }
  if (command.groupId !== undefined) {
    row.groupId = command.groupId;
  }
}

function mutateCategoryCatalog(group: Group, command: ParsedMutation) {
  switch (command.tool) {
    case "create_category_group": {
      group.categoryGroups.push({
        color: command.color,
        icon: command.icon,
        id: `demo:${randomId()}`,
        name: command.name,
      });
      return true;
    }
    case "update_category_group": {
      const row = required(
        group.categoryGroups.find((item) => item.id === command.id),
      );
      if (command.name !== undefined) {
        row.name = command.name;
      }
      if (command.icon !== undefined) {
        row.icon = command.icon;
      }
      if (command.color !== undefined) {
        row.color = command.color;
      }
      return true;
    }
    case "delete_category_group": {
      required(group.categoryGroups.find((item) => item.id === command.id));
      for (const row of group.categories) {
        if (row.groupId === command.id) {
          row.groupId = null;
        }
      }
      group.categoryGroups = group.categoryGroups.filter(
        (item) => item.id !== command.id,
      );
      return true;
    }
    case "update_category": {
      updateDemoCategory(group, command);
      return true;
    }
    default:
      return false;
  }
}

function local<T>(signal: AbortSignal, operation: () => T): Promise<T> {
  return Promise.resolve().then(() => {
    signal.throwIfAborted();
    return operation();
  });
}

// Each tab owns one synthetic session. No fetch, storage, Worker bindings or real credentials.
export function createDemoSession({
  catalog = workspaceFixture(),
  ledger = demoLedger,
}: {
  catalog?: WorkspaceCatalog;
  ledger?: DemoRecord[];
} = {}) {
  let spaces = structuredClone(catalog.spaces);
  let groups = new Map<string, Group>([["personal", structuredClone(catalog)]]);
  let records = structuredClone(ledger);
  let revision = 0;
  const listeners = new Set<() => void>();
  const receipts = new Map<string, string>();
  function publish() {
    revision += 1;
    for (const listener of listeners) {
      listener();
    }
  }
  function view(spaceId = "personal"): DemoData {
    const group = groups.get(spaceId);
    return {
      accounts: spaceId === "personal" ? demoAccounts : [],
      categories: group?.categories ?? [],
      records: spaceId === "personal" ? records : [],
    };
  }
  function mutate(command: ParsedMutation) {
    const group = required(groups.get(command.spaceId));
    if (mutateCategoryCatalog(group, command)) {
      return;
    }
    switch (command.tool) {
      case "create_rule":
      case "update_rule": {
        validateRule(command, group, view(command.spaceId));
        const id =
          command.tool === "update_rule"
            ? required(group.rules.find((rule) => rule.id === command.id)).id
            : `demo:${randomId()}`;
        const {
          accountId,
          categoryId,
          direction,
          enabled,
          filter,
          name,
          priority,
          text,
        } = command;
        group.rules = [
          ...group.rules.filter((rule) => rule.id !== id),
          {
            accountId,
            categoryId,
            direction,
            enabled,
            filter,
            id,
            name,
            priority,
            text,
          },
        ];
        break;
      }
      case "delete_rule":
        required(group.rules.find((rule) => rule.id === command.id));
        group.rules = group.rules.filter((rule) => rule.id !== command.id);
        break;
      case "create_space": {
        const id = `demo:${randomId()}`;
        const { name, type, currency, monthStartDay } = command;
        spaces = [
          ...spaces,
          {
            budgetEnabled: false,
            currency,
            id,
            monthlyBudgetMinor: null,
            monthStartDay,
            name,
            type,
          },
        ];
        groups.set(id, {
          ...categoryCatalog(id),
          rules: [],
          tags: [],
        } satisfies Group);
        break;
      }
      case "update_space": {
        if (command.spaceId !== command.id) {
          throw new Error("SPACE_MISMATCH");
        }
        const space = required(spaces.find((item) => item.id === command.id));
        spaces = spaces.map((item) =>
          item.id === space.id
            ? {
                ...item,
                ...(command.name !== undefined && { name: command.name }),
                ...(command.type !== undefined && { type: command.type }),
                ...(command.monthStartDay !== undefined && {
                  monthStartDay: command.monthStartDay,
                }),
              }
            : item,
        );
        break;
      }
      case "delete_space": {
        if (command.spaceId !== command.id) {
          throw new Error("SPACE_MISMATCH");
        }
        if (command.id === "personal") {
          throw new Error("SPACE_PROTECTED");
        }
        if (
          group.rules.length ||
          group.tags.length ||
          view(command.id).accounts.length
        ) {
          throw new Error("SPACE_NOT_EMPTY");
        }
        groups.delete(command.id);
        spaces = spaces.filter((space) => space.id !== command.id);
        break;
      }
      default:
        throw new Error("UNSUPPORTED_DEMO_OPERATION");
    }
  }
  const queries: Partial<{
    [Tool in keyof PortalQueryResults]: (
      query: PortalQuery & { tool: Tool },
    ) => PortalQueryResults[Tool];
  }> = {
    get_accounts: (query) => ({
      data: {
        records: view(query.spaceId).accounts.map((account) => ({
          id: account.id,
          name: account.name,
          personId: account.personId,
          personName:
            demoPeople.find((person) => person.id === account.personId)?.name ??
            "Pessoa de exemplo",
        })),
      },
    }),
  };
  const api: OrganizationApi = {
    catalog: (spaceId, signal) =>
      local(signal, () =>
        structuredClone({ ...required(groups.get(spaceId)), spaces }),
      ),
    planning: async (command, _csrf, signal) => {
      const { PortalMutationSchema: mutationSchema } = await import(
        "../contracts"
      );
      return local(signal, () => {
        const payload = JSON.stringify(command);
        const previous = receipts.get(command.idempotency_key);
        if (previous && previous !== payload) {
          throw new Error("IDEMPOTENCY_CONFLICT");
        }
        if (!previous) {
          mutate(mutationSchema.parse({ command, csrf: _csrf }).command);
          receipts.set(command.idempotency_key, payload);
          publish();
        }
        return { ok: true };
      });
    },
    previewRule: (input, signal) =>
      local(signal, () => {
        const eligible = view(input.spaceId).records.filter(
          (row) => !row.ignored,
        );
        const matches = eligible.filter((row) => ruleMatches(row, input));
        return {
          count: matches.length,
          examined: eligible.length,
          partial: false,
          revision,
          samples: matches
            .slice(0, 5)
            .map(
              ({
                id,
                accountId,
                amountMinor,
                currency,
                date,
                description,
                personName,
              }) => ({
                accountId,
                amountMinor,
                currency,
                date,
                description,
                id,
                personName,
              }),
            ),
          truncated: false,
        };
      }),
    query: (query, _csrf, signal) =>
      local(signal, () => {
        const read = queries[query.tool];
        if (!read) {
          throw new Error("UNSUPPORTED_DEMO_OPERATION");
        }
        return read(query);
      }),
  };
  return {
    api,
    applyRules(spaceId: string) {
      const rules = activeRules(required(groups.get(spaceId)).rules);
      const scoped = new Set(
        view(spaceId)
          .records.filter((row) => !row.ignored)
          .map((row) => row.id),
      );
      let matched = 0;
      let changed = 0;
      records = records.map((row) => {
        if (!scoped.has(row.id)) {
          return row;
        }
        const rule = rules.find((candidate) =>
          ruleMatches(row, { ...candidate, filter: candidate.filter ?? null }),
        );
        if (!rule) {
          return row;
        }
        matched += 1;
        if (row.category === rule.categoryId) {
          return row;
        }
        changed += 1;
        return { ...row, category: rule.categoryId };
      });
      publish();
      return { changed, matched };
    },
    reset() {
      spaces = structuredClone(catalog.spaces);
      groups = new Map([["personal", structuredClone(catalog)]]);
      records = structuredClone(ledger);
      receipts.clear();
      publish();
    },
    revision: () => revision,
    spaces: () => structuredClone(spaces),
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    view,
  };
}
