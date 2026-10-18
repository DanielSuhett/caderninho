import type { Filter } from "../domain";
import type { Catalog } from "../domain/rules";
import type { JsonValue } from "../shared";

export const RuleCommandAction = {
  activate: "activate",
  read: "read",
  save: "save",
  validate: "validate",
} as const;
export type RuleCommandAction =
  (typeof RuleCommandAction)[keyof typeof RuleCommandAction];

export const RuleImportMode = {
  activate: "activate",
  dry_run: "dry-run",
  save: "save",
} as const;
export type RuleImportMode =
  (typeof RuleImportMode)[keyof typeof RuleImportMode];

export interface RuleCommand {
  action: RuleCommandAction;
  catalog?: Catalog | undefined;
  document?: JsonValue | undefined;
  revision?: string | undefined;
}

export interface PreviewInput {
  filter?: Filter | undefined;
  itemIds: string[];
  limit: number;
  revision: string;
}

export interface SubscriptionInput {
  currency: string;
  from: string;
  limit: number;
  to: string;
}

export interface LiveBalanceInput {
  accountId: string;
}
