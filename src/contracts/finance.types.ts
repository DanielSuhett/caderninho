import type { Filter } from "#domain/filter.types.ts";
import type { Catalog } from "#domain/rules/rules.types.ts";
import type { JsonValue } from "#shared/json.types.ts";

export const RuleCommandAction = {
  validate: "validate",
  save: "save",
  activate: "activate",
  read: "read",
} as const;
export type RuleCommandAction =
  (typeof RuleCommandAction)[keyof typeof RuleCommandAction];

export const RuleImportMode = {
  dry_run: "dry-run",
  save: "save",
  activate: "activate",
} as const;
export type RuleImportMode =
  (typeof RuleImportMode)[keyof typeof RuleImportMode];

export interface RuleCommand {
  action: RuleCommandAction;
  document?: JsonValue | undefined;
  revision?: string | undefined;
  catalog?: Catalog | undefined;
}

export interface PreviewInput {
  filter?: Filter | undefined;
  itemIds: string[];
  revision: string;
  limit: number;
}

export interface SubscriptionInput {
  from: string;
  to: string;
  currency: string;
  limit: number;
}

export interface LiveBalanceInput {
  itemId: string;
  accountId: string;
}
