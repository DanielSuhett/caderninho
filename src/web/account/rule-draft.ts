import { RulePreviewSchema, type WorkspaceCatalog } from "../../contracts";
import { minor, type RuleCondition } from "../../domain";
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
export const conditionFields = [
  { label: "Descrição", value: "description" },
  { label: "Movimento", value: "direction" },
  { label: "Estado", value: "status" },
  { label: "Conta", value: "accountId" },
  { label: "Pessoa", value: "personId" },
  { label: "Valor absoluto", value: "amount" },
  { label: "Data", value: "date" },
];
export function conditionDraft(field = "description"): DraftCondition {
  const operators: Record<string, string> = {
    amount: "gte",
    date: "gte",
    description: "contains",
  };
  const values: Record<string, string> = {
    direction: "DEBIT",
    status: "POSTED",
  };
  return {
    field,
    id: randomId(),
    operator: operators[field] ?? "equals",
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
): DraftAlternative[] {
  const source = rule?.filter?.alternatives ?? [
    {
      conditions: [
        { field: "description", operator: "contains", value: rule?.text ?? "" },
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
            value:
              condition.field === "amount"
                ? minor(condition.value.replace(",", "."), input.currency)
                : condition.value,
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
  operator: "equals",
  value: "DEBIT",
};
export const rulePresets = [
  {
    direction: debit,
    name: "Supermercados",
    terms: ["mercado", "supermercado"],
  },
  { direction: debit, name: "Assinaturas", terms: ["netflix", "spotify"] },
  {
    direction: { field: "direction", operator: "equals", value: "CREDIT" },
    name: "Salário",
    terms: ["salário"],
  },
  { direction: debit, name: "PIX enviados", terms: ["pix"] },
] as const;
