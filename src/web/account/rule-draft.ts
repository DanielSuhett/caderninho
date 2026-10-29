import { RulePreviewSchema, type WorkspaceCatalog } from "../../contracts";
import {
  documentDigits,
  minor,
  type RuleCondition,
  RuleOperator,
  TransactionDirection,
  TransactionStatus,
} from "../../domain";
import { randomId } from "../random-id";

export interface DraftCondition {
  field: string;
  id: string;
  operator: string;
  value: string;
}
export interface DraftAlternative {
  conditions: DraftCondition[];
  id: string;
}
export function conditionDraft(field = "description"): DraftCondition {
  const operators: Record<string, string> = {
    amount: RuleOperator.gte,
    date: RuleOperator.gte,
    description: RuleOperator.contains,
    receiverName: RuleOperator.contains,
  };
  const values: Record<string, string> = {
    direction: TransactionDirection.DEBIT,
    status: TransactionStatus.POSTED,
  };
  return {
    field,
    id: randomId(),
    operator: operators[field] ?? RuleOperator.equals,
    value: values[field] ?? "",
  };
}
function amountInput(value: string, currency: string) {
  const scale =
    new Intl.NumberFormat("pt-BR", {
      currency,
      style: "currency",
    }).resolvedOptions().maximumFractionDigits ?? 2;
  if (!scale) {
    return value;
  }
  const padded = value.padStart(scale + 1, "0");
  return `${padded.slice(0, -scale)},${padded.slice(-scale)}`;
}
export function initialAlternatives(
  rule?: WorkspaceCatalog["rules"][number],
  description?: string,
): DraftAlternative[] {
  let operator: RuleOperator = RuleOperator.contains;
  if (description) {
    operator =
      description.length > 160 ? RuleOperator.starts_with : RuleOperator.equals;
  }
  const source = rule?.filter?.alternatives ?? [
    {
      conditions: [
        {
          field: "description",
          operator,
          value: rule?.text ?? description?.slice(0, 160) ?? "",
        },
      ],
    },
  ];
  return source.map((alternative) => ({
    conditions: alternative.conditions.map((condition) => ({
      ...condition,
      id: randomId(),
      value:
        condition.field === "amount"
          ? amountInput(condition.value, rule?.filter?.currency ?? "BRL")
          : condition.value,
    })),
    id: randomId(),
  }));
}
function draftValue(condition: DraftCondition, currency: string) {
  if (condition.field === "amount") {
    return minor(condition.value.replace(",", "."), currency);
  }
  if (condition.field === "receiverDocument") {
    return documentDigits(condition.value);
  }
  return condition.value;
}
export function parseRuleDraft(input: {
  csrf: string;
  spaceId: string;
  currency: string;
  alternatives: DraftAlternative[];
  text: string;
  accountId: string | null;
  direction: string | null;
}) {
  try {
    return RulePreviewSchema.safeParse({
      accountId: input.accountId,
      csrf: input.csrf,
      direction: input.direction,
      filter: {
        alternatives: input.alternatives.map((alternative) => ({
          conditions: alternative.conditions.map((condition) => ({
            field: condition.field,
            operator: condition.operator,
            value: draftValue(condition, input.currency),
          })),
        })),
        currency: input.currency || null,
      },
      spaceId: input.spaceId,
      text: input.text,
    });
  } catch {
    return RulePreviewSchema.safeParse({});
  }
}
const debit: RuleCondition = {
  field: "direction",
  operator: RuleOperator.equals,
  value: TransactionDirection.DEBIT,
};
export const rulePresets = [
  {
    direction: debit,
    name: "Supermercados",
    terms: ["mercado", "supermercado"],
  },
  { direction: debit, name: "Assinaturas", terms: ["netflix", "spotify"] },
  {
    direction: {
      field: "direction",
      operator: RuleOperator.equals,
      value: TransactionDirection.CREDIT,
    },
    name: "Salário",
    terms: ["salário"],
  },
  { direction: debit, name: "PIX enviados", terms: ["pix"] },
] as const;
