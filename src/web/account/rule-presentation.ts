import type { WorkspaceCatalog } from "../../contracts";
import {
  type RuleCondition,
  RuleOperator,
  TransactionDirection,
} from "../../domain";
import { formatBalance } from "../money";
import type { CategoryAppearance } from "./category-appearance";
import { conditionFields } from "./rule-draft";

export type RuleSource = Pick<
  WorkspaceCatalog["rules"][number],
  "accountId" | "direction" | "filter" | "text"
>;
export interface RuleContext {
  accounts: { id: string; name: string; personName: string }[];
  people: { id: string; name: string }[];
}
export interface RuleTerm {
  field: string;
  monetary: boolean;
  operator: string | null;
  value: string;
}
export interface RuleCompositionModel {
  alternatives: {
    id: string;
    conditions: (RuleTerm & { id: string })[];
  }[];
  category: string;
  categoryAppearance?: CategoryAppearance | undefined;
  enabled: boolean;
  scope: RuleTerm[];
}

function occurrenceKey(value: string, occurrences: Map<string, number>) {
  const occurrence = (occurrences.get(value) ?? 0) + 1;
  occurrences.set(value, occurrence);
  return `${value}:${occurrence}`;
}
const operators: Record<string, string> = {
  contains: "contém",
  equals: "é",
  gte: "≥",
  lte: "≤",
  not_contains: "não contém",
  starts_with: "começa com",
};
const values: Record<string, string> = {
  CREDIT: "Entrada",
  DEBIT: "Saída",
  PENDING: "Pendente na origem",
  POSTED: "Registrada na origem",
};

function presentCondition(
  condition: RuleCondition,
  context: RuleContext,
  currency: string | null,
): RuleTerm {
  let { value } = condition;
  if (condition.field === "direction" || condition.field === "status") {
    value = values[condition.value] ?? condition.value;
  }
  if (condition.field === "description") {
    value = `“${condition.value}”`;
  }
  if (condition.field === "accountId") {
    const account = context.accounts.find((row) => row.id === condition.value);
    value = account
      ? `${account.name} · ${account.personName}`
      : "Conta não identificada";
  }
  if (condition.field === "personId") {
    value =
      context.people.find((row) => row.id === condition.value)?.name ??
      "Pessoa não identificada";
  }
  if (condition.field === "amount") {
    value = currency
      ? formatBalance(condition.value, currency)
      : "Valor sem moeda definida";
  }
  if (condition.field === "date") {
    value = condition.value.split("-").reverse().join("/");
  }
  const field =
    conditionFields.find((row) => row.value === condition.field)?.label ??
    condition.field;
  return {
    field,
    monetary: condition.field === "amount" && !!currency,
    operator: operators[condition.operator] ?? condition.operator,
    value,
  };
}

export function buildRuleComposition({
  rule,
  accounts,
  people,
  category,
  categoryAppearance,
  enabled,
}: RuleContext & {
  rule: RuleSource;
  category: string;
  categoryAppearance?: CategoryAppearance | undefined;
  enabled: boolean;
}): RuleCompositionModel {
  const context = { accounts, people };
  const currency = rule.filter?.currency ?? null;
  const scope: RuleTerm[] = [
    {
      field: "Moeda",
      monetary: false,
      operator: null,
      value: currency ?? "Todas as moedas",
    },
  ];
  const required: RuleCondition[] = [];
  if (rule.accountId) {
    required.push({
      field: "accountId",
      operator: RuleOperator.equals,
      value: rule.accountId,
    });
  }
  if (rule.direction) {
    required.push({
      field: "direction",
      operator: RuleOperator.equals,
      value: rule.direction,
    });
  }
  if (rule.filter && rule.text) {
    required.push({
      field: "description",
      operator: RuleOperator.contains,
      value: rule.text,
    });
  }
  scope.push(
    ...required.map((condition) =>
      presentCondition(condition, context, currency),
    ),
  );
  const alternatives = rule.filter?.alternatives ?? [
    {
      conditions: [
        {
          field: "description",
          operator: RuleOperator.contains,
          value: rule.text,
        } as const,
      ],
    },
  ];
  const branches = new Map<string, number>();
  return {
    alternatives: alternatives.map((alternative) => {
      const conditions = new Map<string, number>();
      return {
        conditions: alternative.conditions.map((condition) => ({
          ...presentCondition(condition, context, currency),
          id: occurrenceKey(JSON.stringify(condition), conditions),
        })),
        id: occurrenceKey(JSON.stringify(alternative), branches),
      };
    }),
    category,
    categoryAppearance,
    enabled,
    scope,
  };
}

export function ruleSummary({ rule }: { rule: RuleSource }) {
  if (!rule.filter) {
    return `Contém “${rule.text}”`;
  }
  const { alternatives } = rule.filter;
  const conditions = alternatives.flatMap((row) => row.conditions);
  const description = conditions.find(
    (c) => c.field === "description" && c.operator === RuleOperator.contains,
  );
  const direction = conditions.find(
    (c) => c.field === "direction" && c.operator === RuleOperator.equals,
  );
  if (
    alternatives.length === 1 &&
    description &&
    conditions.every((c) => c === description || c === direction)
  ) {
    let movement = "Transações";
    if (direction) {
      movement =
        direction.value === TransactionDirection.DEBIT ? "Saídas" : "Entradas";
    }
    return `${movement} com “${description.value}”`;
  }
  if (!conditions.length) {
    return "Condições não disponíveis";
  }
  return [
    alternatives.length > 1 ? `${alternatives.length} alternativas` : "",
    `${conditions.length} ${conditions.length === 1 ? "condição" : "condições"}`,
  ]
    .filter(Boolean)
    .join(" · ");
}
