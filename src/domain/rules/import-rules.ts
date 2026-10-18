import { isLosslessNumber, parse } from "lossless-json";
import { z } from "zod/v4";

import type { JsonValue } from "../../shared";
import { JsonValueSchema } from "../../shared";
import { convertValidatedRules, LegacyRulesSchema } from "./convert-rules";
import {
  Comparator,
  compileValidatedRules,
  RuleAction,
  type Condition as RuleCondition,
  type RuleImportReport,
  RuleOperator,
  RulePhase,
  type Rules,
} from "./rule.entity";
import { compileRules, RuleSchema, RulesSchema } from "./rule.schema";
import type {
  SecuroCondition,
  SecuroPackage,
  SecuroRule,
} from "./rule-import.types";

const regexSpecialCharactersPattern = /[.*+?^${}()|[\]\\]/g;

const SecuroConditionSchema: z.ZodType<SecuroCondition> = z
  .object({
    get conditions() {
      return z.array(SecuroConditionSchema).optional();
    },
    field: z.string().optional(),
    op: z.string(),
    value: JsonValueSchema.optional(),
  })
  .strict();

const Package = z
  .object({
    format: z.literal("securo-categorization-rules"),
    rules: z.array(
      z
        .object({
          actions: z.array(
            z
              .object({
                key: z.string().optional(),
                op: z.string(),
                value: z.string().optional(),
              })
              .strict(),
          ),
          conditions: z.array(SecuroConditionSchema).min(1),
          conditions_op: z.enum(["and", "or"]),
          id: z.string().optional(),
          is_active: z.boolean(),
          name: z.string(),
          priority: z.number().int(),
        })
        .strict(),
    ),
    version: z.literal(1),
  })
  .strict() satisfies z.ZodType<SecuroPackage>;

const fieldMap: Record<string, string> = {
  account_id: "tx.account_id",
  amount: "tx.amount",
  category: "tx.original_category",
  currency: "tx.currency",
  date: "tx.date",
  description: "tx.description",
  type: "tx.direction",
};

export function importRules(
  input: unknown,
  catalog?: Pick<Rules, "groups" | "categories">,
): RuleImportReport {
  const native = RulesSchema.safeParse(input);

  if (native.success) {
    compileValidatedRules(native.data);

    return { compatible: true, document: native.data, issues: [] };
  }

  const legacy = LegacyRulesSchema.safeParse(input);
  if (legacy.success) {
    return convertValidatedRules(legacy.data);
  }
  const parsed = Package.safeParse(input);

  if (!parsed.success) {
    return {
      compatible: false,
      document: null,
      issues: parsed.error.issues.map((i) => ({
        code: "INVALID_PACKAGE",
        message: i.message,
        path: i.path.join("."),
      })),
    };
  }
  const issues: ConversionIssue[] = [];

  const rules = convertPackageRules(parsed.data.rules, issues);

  if (!catalog) {
    issues.push({
      code: "CATALOG_REQUIRED",
      message:
        "Securo export has no catalog; supply explicit groups, category IDs and aliases. No categories are invented.",
      path: "categories",
    });
  }

  if (issues.length || !catalog) {
    return { compatible: false, document: null, issues };
  }

  try {
    const { document } = compileRules({ version: 2, ...catalog, rules });

    return { compatible: true, document, issues };
  } catch (error) {
    return {
      compatible: false,
      document: null,
      issues: [
        {
          code: "INVALID_CONVERSION",
          message:
            error instanceof Error ? error.message : "Invalid conversion",
          path: "rules",
        },
      ],
    };
  }
}

// Preserve literal lexemes while priorities and package versions remain safe integers.
export function parseRuleJson(text: string): unknown {
  return parse(text, (key, value) => {
    if (!isLosslessNumber(value)) {
      return value;
    }

    if (key === "value") {
      return value.value;
    }
    const number = Number(value.value);

    if (!Number.isSafeInteger(number)) {
      throw new Error("UNSAFE_RULE_NUMBER");
    }

    return number;
  });
}

interface ConversionIssue {
  code: string;
  message: string;
  path: string;
}
function literal(
  value: JsonValue | undefined,
  path: string,
  issues: ConversionIssue[],
): string {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" && Number.isSafeInteger(value)) {
    return String(value);
  }
  issues.push({
    code: "INVALID_LITERAL",
    message: "Text or safe decimal literal required",
    path,
  });

  return "0";
}

function condition(
  c: SecuroCondition,
  path: string,
  issues: ConversionIssue[],
): RuleCondition {
  if (c.op === "and" || c.op === "or") {
    return groupCondition(c, path, issues);
  }

  const field = c.field ? fieldMap[c.field] : undefined;

  if (!field) {
    issues.push({
      code: "FIELD_MAPPING_REQUIRED",
      message: `Unsupported source field: ${c.field}`,
      path,
    });

    return { not: { all: [] } };
  }

  if (c.op === "equals") {
    return equality(field, c.value, path, issues);
  }

  if (c.op === Comparator.gte || c.op === Comparator.lte) {
    return {
      fact: field,
      operator:
        field === "tx.date"
          ? RuleOperator.dateCompare
          : RuleOperator.decimalCompare,
      value: { op: c.op, value: literal(c.value, path, issues) },
    };
  }

  if (c.op === "regex") {
    return {
      fact: field,
      operator: RuleOperator.regex,
      value: literal(c.value, path, issues),
    };
  }

  if (c.op === "contains" || c.op === "starts_with") {
    const text = z
      .string()
      .parse(c.value)
      .replace(regexSpecialCharactersPattern, "\\$&");

    return {
      fact: field,
      operator: RuleOperator.regex,
      value: (c.op === "starts_with" ? "^" : "") + text,
    };
  }

  issues.push({ code: "UNSUPPORTED_OPERATOR", message: c.op, path });

  return { not: { all: [] } };
}

function equality(
  field: string,
  input: JsonValue | undefined,
  path: string,
  issues: ConversionIssue[],
): RuleCondition {
  if (field === "tx.amount") {
    return {
      fact: field,
      operator: RuleOperator.decimalCompare,
      value: { op: Comparator.eq, value: literal(input, path, issues) },
    };
  }

  const value = z
    .union([z.string(), z.number().int().safe(), z.boolean(), z.null()])
    .safeParse(input ?? null);

  if (value.success) {
    return { fact: field, operator: RuleOperator.equal, value: value.data };
  }
  issues.push({
    code: "INVALID_LITERAL",
    message: "Equality requires a scalar literal",
    path,
  });

  return { not: { all: [] } };
}

function groupCondition(
  c: SecuroCondition,
  path: string,
  issues: ConversionIssue[],
): RuleCondition {
  if (!c.conditions?.length || c.field || c.value !== undefined) {
    issues.push({
      code: "INVALID_GROUP",
      message: "Group requires conditions only",
      path,
    });

    return { not: { all: [] } };
  }

  const children = c.conditions.map((v, i) =>
    condition(v, `${path}.${i}`, issues),
  );

  return c.op === "and" ? { all: children } : { any: children };
}

function convertPackageRules(source: SecuroRule[], issues: ConversionIssue[]) {
  const rules: Rules["rules"] = [];
  for (const [index, r] of source.entries()) {
    const children = r.conditions.map((c, i) =>
      condition(c, `rules.${index}.conditions.${i}`, issues),
    );

    const conditions =
      r.conditions_op === "and" ? { all: children } : { any: children };

    for (const stage of [RulePhase.classify, RulePhase.enrich] as const) {
      const actions = r.actions.filter((a) =>
        stage === RulePhase.classify
          ? a.op === RuleAction.set_category
          : a.op !== RuleAction.set_category,
      );

      if (!actions.length) {
        continue;
      }

      const candidate = RuleSchema.safeParse({
        conditions,
        event: { params: { actions }, type: stage },
        id: `${r.id ?? `securo-${index + 1}`}-${stage}`,
        is_active: r.is_active,
        name: r.name,
        priority: r.priority,
      });

      if (!candidate.success) {
        issues.push({
          code: "UNSUPPORTED_ACTION",
          message: candidate.error.message,
          path: `rules.${index}`,
        });
        continue;
      }

      rules.push(candidate.data);
    }
  }

  return rules;
}
