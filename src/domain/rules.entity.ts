import type { PlanningTransaction, Rule } from "./planning.entity";
import { transactionCounterparty } from "./transaction.entity";

export const RuleOperator = {
  contains: "contains",
  equals: "equals",
  gte: "gte",
  lte: "lte",
  not_contains: "not_contains",
  starts_with: "starts_with",
} as const;
export type RuleOperator = (typeof RuleOperator)[keyof typeof RuleOperator];

type TextOperator =
  | typeof RuleOperator.contains
  | typeof RuleOperator.not_contains
  | typeof RuleOperator.equals
  | typeof RuleOperator.starts_with;
type OrderedOperator =
  | typeof RuleOperator.equals
  | typeof RuleOperator.gte
  | typeof RuleOperator.lte;

type RuleTransaction = Pick<
  PlanningTransaction,
  | "accountId"
  | "amountMinor"
  | "currency"
  | "date"
  | "description"
  | "direction"
  | "identification"
  | "personId"
  | "status"
>;

type OrderedRule = Pick<Rule, "priority" | "id"> & { pack?: Rule["pack"] };
export function compareRules(a: OrderedRule, b: OrderedRule) {
  return (
    Number(!!a.pack) - Number(!!b.pack) ||
    a.priority - b.priority ||
    (a.id < b.id ? -1 : Number(a.id > b.id))
  );
}
export function activeRules<T extends OrderedRule & Pick<Rule, "enabled">>(
  rules: readonly T[],
) {
  return rules.filter((rule) => rule.enabled).toSorted(compareRules);
}

export type RuleCondition =
  | {
      field: "description" | "receiverName";
      operator: TextOperator;
      value: string;
    }
  | {
      // CPF or CNPJ digits; punctuation is ignored on both sides.
      field: "receiverDocument";
      operator: typeof RuleOperator.equals;
      value: string;
    }
  | {
      field: "direction" | "status" | "accountId" | "personId";
      operator: typeof RuleOperator.equals;
      value: string;
    }
  | {
      field: "date" | "amount";
      operator: OrderedOperator;
      value: string;
    };
export interface RuleFilter {
  alternatives: { conditions: RuleCondition[] }[];
  currency: string | null;
}
const capitals = /[A-Z]/g;
// SQLite lower() is ASCII-only. Keep preview, explicit application and import identical.
export const ruleText = (value: string) =>
  value.replace(capitals, (letter) => letter.toLowerCase());
const textFields = new Set<RuleCondition["field"]>([
  "description",
  "receiverName",
]);
function conditionActual(
  row: RuleTransaction,
  field: Exclude<RuleCondition["field"], "amount">,
) {
  if (field === "description") {
    return ruleText(row.description);
  }
  if (field === "receiverName" || field === "receiverDocument") {
    const counterparty = transactionCounterparty(row.identification);
    const value =
      field === "receiverName" ? counterparty.name : counterparty.document;
    return value === null ? null : ruleText(value);
  }
  return row[field];
}
function conditionMatches(row: RuleTransaction, condition: RuleCondition) {
  if (condition.field === "amount") {
    if (row.amountMinor === null) {
      return false;
    }
    const signed = BigInt(row.amountMinor);
    const amount = signed < 0n ? -signed : signed;
    const expected = BigInt(condition.value);
    if (condition.operator === RuleOperator.gte) {
      return amount >= expected;
    }
    if (condition.operator === RuleOperator.lte) {
      return amount <= expected;
    }
    return amount === expected;
  }
  const actual = conditionActual(row, condition.field);
  // Transactions without a counterparty match no beneficiary condition.
  if (actual === null) {
    return false;
  }
  const expected = textFields.has(condition.field)
    ? ruleText(condition.value)
    : condition.value;
  switch (condition.operator) {
    case RuleOperator.contains:
      return actual.includes(expected);
    case RuleOperator.not_contains:
      return !actual.includes(expected);
    case RuleOperator.starts_with:
      return actual.startsWith(expected);
    case RuleOperator.gte:
      return actual >= expected;
    case RuleOperator.lte:
      return actual <= expected;
    default:
      return actual === expected;
  }
}
export function ruleMatches(
  row: RuleTransaction,
  rule: Pick<Rule, "text" | "accountId" | "direction" | "filter">,
) {
  return (
    (!rule.accountId || rule.accountId === row.accountId) &&
    (!rule.direction || rule.direction === row.direction) &&
    (!rule.text || ruleText(row.description).includes(ruleText(rule.text))) &&
    (!rule.filter ||
      ((!rule.filter.currency || row.currency === rule.filter.currency) &&
        rule.filter.alternatives.some((alternative) =>
          alternative.conditions.every((condition) =>
            conditionMatches(row, condition),
          ),
        )))
  );
}
