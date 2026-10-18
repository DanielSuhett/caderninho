import { isLosslessNumber, parse } from "lossless-json";
import { z } from "zod/v4";

import {
  convertRules,
  LegacyRulesSchema,
} from "#domain/rules/convert-rules.ts";
import {
  compileRules,
  type Condition as RuleCondition,
  RuleSchema,
  type Rules,
  RulesSchema,
} from "#domain/rules/rules.ts";
import { type JsonValue, JsonValueSchema } from "#shared/json.ts";

const Condition = z
  .object({
    op: z.string(),
    field: z.string().optional(),
    value: JsonValueSchema.optional(),
    get conditions() {
      return z.array(Condition).optional();
    },
  })
  .strict();

const Package = z
  .object({
    format: z.literal("securo-categorization-rules"),
    version: z.literal(1),
    rules: z.array(
      z
        .object({
          id: z.string().optional(),
          name: z.string(),
          conditions_op: z.enum(["and", "or"]),
          conditions: z.array(Condition).min(1),
          actions: z.array(
            z
              .object({
                op: z.string(),
                value: z.string().optional(),
                key: z.string().optional(),
              })
              .strict(),
          ),
          priority: z.number().int(),
          is_active: z.boolean(),
        })
        .strict(),
    ),
  })
  .strict();

const fieldMap: Record<string, string> = {
  description: "tx.description",
  account_id: "tx.account_id",
  type: "tx.direction",
  amount: "tx.amount",
  date: "tx.date",
  currency: "tx.currency",
  category: "tx.original_category",
};

export function importRules(
  input: unknown,
  catalog?: Pick<Rules, "groups" | "categories">,
) {
  const native = RulesSchema.safeParse(input);

  if (native.success) {
    compileRules(native.data);

    return { compatible: true, document: native.data, issues: [] };
  }

  if (LegacyRulesSchema.safeParse(input).success) {
    return convertRules(input);
  }
  const parsed = Package.safeParse(input);

  if (!parsed.success) {
    return {
      compatible: false,
      document: null,
      issues: parsed.error.issues.map((i) => ({
        path: i.path.join("../../../../apps/worker/application"),
        code: "INVALID_PACKAGE",
        message: i.message,
      })),
    };
  }
  const issues: ConversionIssue[] = [];

  const rules = convertPackageRules(parsed.data.rules, issues);

  if (!catalog) {
    issues.push({
      path: "categories",
      code: "CATALOG_REQUIRED",
      message:
        "Securo export has no catalog; supply explicit groups, category IDs and aliases. No categories are invented.",
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
          path: "rules",
          code: "INVALID_CONVERSION",
          message:
            error instanceof Error ? error.message : "Invalid conversion",
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

type ConversionIssue = { path: string; code: string; message: string };
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
    path,
    code: "INVALID_LITERAL",
    message: "Text or safe decimal literal required",
  });

  return "0";
}

function condition(
  c: z.infer<typeof Condition>,
  path: string,
  issues: ConversionIssue[],
): RuleCondition {
  if (c.op === "and" || c.op === "or") {
    return groupCondition(c, path, issues);
  }

  const field = c.field ? fieldMap[c.field] : undefined;

  if (!field) {
    issues.push({
      path,
      code: "FIELD_MAPPING_REQUIRED",
      message: `Unsupported source field: ${c.field}`,
    });

    return { not: { all: [] } };
  }

  if (c.op === "equals") {
    return equality(field, c.value, path, issues);
  }

  if (c.op === "gte" || c.op === "lte") {
    return {
      fact: field,
      operator: field === "tx.date" ? "dateCompare" : "decimalCompare",
      value: { op: c.op, value: literal(c.value, path, issues) },
    };
  }

  if (c.op === "regex") {
    return {
      fact: field,
      operator: "regex",
      value: literal(c.value, path, issues),
    };
  }

  if (c.op === "contains" || c.op === "starts_with") {
    const text = z
      .string()
      .parse(c.value)
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    return {
      fact: field,
      operator: "regex",
      value: (c.op === "starts_with" ? "^" : "") + text,
    };
  }

  issues.push({ path, code: "UNSUPPORTED_OPERATOR", message: c.op });

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
      operator: "decimalCompare",
      value: { op: "eq", value: literal(input, path, issues) },
    };
  }

  const value = z
    .union([z.string(), z.number().int().safe(), z.boolean(), z.null()])
    .safeParse(input ?? null);

  if (value.success) {
    return { fact: field, operator: "equal", value: value.data };
  }
  issues.push({
    path,
    code: "INVALID_LITERAL",
    message: "Equality requires a scalar literal",
  });

  return { not: { all: [] } };
}

function groupCondition(
  c: z.infer<typeof Condition>,
  path: string,
  issues: ConversionIssue[],
): RuleCondition {
  if (!c.conditions?.length || c.field || c.value !== undefined) {
    issues.push({
      path,
      code: "INVALID_GROUP",
      message: "Group requires conditions only",
    });

    return { not: { all: [] } };
  }

  const children = c.conditions.map((v, i) =>
    condition(v, `${path}../../../../apps/worker/application${i}`, issues),
  );

  return c.op === "and" ? { all: children } : { any: children };
}

function convertPackageRules(
  source: z.infer<typeof Package>["rules"],
  issues: ConversionIssue[],
) {
  const rules: Rules["rules"] = [];
  for (const [index, r] of source.entries()) {
    const children = r.conditions.map((c, i) =>
      condition(c, `rules.${index}.conditions.${i}`, issues),
    );

    const conditions =
      r.conditions_op === "and" ? { all: children } : { any: children };

    for (const stage of ["classify", "enrich"] as const) {
      const actions = r.actions.filter((a) =>
        stage === "classify"
          ? a.op === "set_category"
          : a.op !== "set_category",
      );

      if (!actions.length) {
        continue;
      }

      const candidate = RuleSchema.safeParse({
        id: `${r.id ?? `securo-${index + 1}`}-${stage}`,
        name: r.name,
        priority: r.priority,
        is_active: r.is_active,
        conditions,
        event: { type: stage, params: { actions } },
      });

      if (!candidate.success) {
        issues.push({
          path: `rules.${index}`,
          code: "UNSUPPORTED_ACTION",
          message: candidate.error.message,
        });
        continue;
      }

      rules.push(candidate.data);
    }
  }

  return rules;
}
