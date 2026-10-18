import { z } from "zod/v4";

import { JsonValueSchema } from "@/shared/json";
import type { JsonValue } from "@/shared/json.types";

import {
  Comparator,
  type Condition,
  compileValidatedRules,
  type LegacyRules,
  type Rule,
  type RuleImportReport,
  RuleOperator,
  RulePhase,
} from "./rule.entity";
import { ActionSchema, CatalogSchema, RulesSchema } from "./rule.schema";

export const LegacyRulesSchema = CatalogSchema.extend({
  rules: z
    .array(
      z
        .object({
          actions: z.array(ActionSchema).min(1).max(32),
          id: z.string().min(1).max(128),
          is_active: z.boolean().default(true),
          name: z.string().max(2048),
          priority: z.number().int().safe(),
          stage: z.enum(RulePhase),
          when: JsonValueSchema,
        })
        .strict(),
    )
    .max(2000),
  version: z.literal(1),
}).strict() satisfies z.ZodType<LegacyRules>;

class ConversionError extends Error {
  readonly path: string;
  constructor(path: string, reason: string) {
    super(reason);
    this.path = path;
  }
}

function fail(path: string, reason: string): never {
  throw new ConversionError(path, reason);
}

function fact(v: JsonValue | undefined, path: string): string {
  const parsed = z.object({ var: z.string() }).strict().safeParse(v);

  if (!parsed.success) {
    fail(
      path,
      "Expected an explicit fact; defaults and expressions are not representable",
    );
  }

  return parsed.data.var;
}

function literal(v: JsonValue | undefined, path: string) {
  const parsed = z
    .union([z.string(), z.number().int().safe(), z.boolean(), z.null()])
    .safeParse(v);

  if (!parsed.success) {
    fail(path, "Only scalar literals are representable");
  }

  return parsed.data;
}

export function convertPredicate(
  v: JsonValue | undefined,
  path: string,
  depth = 0,
): Condition {
  if (depth > 24) {
    fail(path, "Condition depth exceeds 24");
  }

  if (typeof v === "boolean") {
    return v ? { all: [] } : { not: { all: [] } };
  }

  if (!v || Array.isArray(v) || typeof v !== "object") {
    fail(path, "Predicate must return boolean");
  }
  const entries = Object.entries(v);

  const [entry] = entries;

  if (entries.length !== 1 || !entry) {
    fail(path, "Expected one operator");
  }

  const [op, raw] = entry,
    args = Array.isArray(raw) ? raw : [raw];

  if (op === "and" || op === "or") {
    return convertGroup(raw, { depth, op, path });
  }

  if ((op === "!" || op === "!!") && args.length === 1) {
    const child = convertPredicate(args[0], `${path}.${op}`, depth + 1);

    return op === "!" ? { not: child } : child;
  }

  if (op === "===" || op === "!==") {
    return convertEquality(op, args, path);
  }

  if (op === "if") {
    return convertIf(args, path, depth);
  }

  return convertFactPredicate(op, args, path);
}

function convertGroup(
  raw: JsonValue | undefined,
  { op, path, depth }: { op: "and" | "or"; path: string; depth: number },
): Condition {
  if (!(Array.isArray(raw) && raw.length)) {
    fail(path, "Empty JSONLogic group returns null");
  }

  const children = raw.map((x, i) =>
    convertPredicate(x, `${path}.${op}.${i}`, depth + 1),
  );

  return op === "and" ? { all: children } : { any: children };
}

function convertEquality(
  op: string,
  args: (JsonValue | undefined)[],
  path: string,
): Condition {
  if (args.length !== 2) {
    fail(path, `Operator ${op} has no equivalent conversion`);
  }

  const left = z.object({ var: z.string() }).strict().safeParse(args[0]);
  const right = z.object({ var: z.string() }).strict().safeParse(args[1]);
  const operand = left.success ? args[0] : args[1];
  const value = left.success ? args[1] : args[0];

  if (!(left.success || right.success)) {
    fail(path, "Equality requires one explicit fact");
  }

  return {
    fact: fact(operand, path),
    operator: op === "===" ? RuleOperator.equal : RuleOperator.notEqual,
    value: literal(value, path),
  };
}

function convertIf(
  args: (JsonValue | undefined)[],
  path: string,
  depth: number,
): Condition {
  if (args.length < 3 || args.length % 2 === 0) {
    fail(path, "Boolean if requires an explicit boolean fallback");
  }

  const branches: Condition[] = [],
    previous: Condition[] = [];

  for (let i = 0; i + 1 < args.length; i += 2) {
    const predicate = convertPredicate(args[i], `${path}.if.${i}`, depth + 1);

    const result = convertPredicate(
      args[i + 1],
      `${path}.if.${i + 1}`,
      depth + 1,
    );

    branches.push({ all: [...previous, predicate, result] });
    previous.push({ not: predicate });
  }

  branches.push({
    all: [
      ...previous,
      convertPredicate(args.at(-1), `${path}.if.${args.length - 1}`, depth + 1),
    ],
  });

  return { any: branches };
}

function convertFactPredicate(
  op: string,
  args: (JsonValue | undefined)[],
  path: string,
): Condition {
  if (op === "in" && args.length === 2) {
    const values = z
      .union([
        z.string(),
        z.array(
          z.union([z.string(), z.number().int().safe(), z.boolean(), z.null()]),
        ),
      ])
      .safeParse(args[1]);

    if (!values.success) {
      fail(path, "Membership requires a literal string or scalar array");
    }

    return {
      fact: fact(args[0], path),
      operator: RuleOperator.contains,
      value: values.data,
    };
  }

  if (op === "opf.regex" && args.length === 2) {
    return {
      fact: fact(args[0], path),
      operator: RuleOperator.regex,
      value: z.string().parse(args[1]),
    };
  }

  if (op === "opf.decimal_between" && args.length === 3) {
    return {
      fact: fact(args[0], path),
      operator: RuleOperator.decimalBetween,
      value: [z.string().parse(args[1]), z.string().parse(args[2])],
    };
  }

  if (
    (op === "opf.decimal_compare" || op === "opf.date_compare") &&
    args.length === 3
  ) {
    return {
      fact: fact(args[0], path),
      operator:
        op === "opf.decimal_compare"
          ? RuleOperator.decimalCompare
          : RuleOperator.dateCompare,
      value: {
        op: z.enum(Comparator).parse(args[1]),
        value: z.string().parse(args[2]),
      },
    };
  }
  fail(path, `Operator ${op} has no equivalent conversion`);
}

export function convertValidatedRules(document: LegacyRules): RuleImportReport {
  const issues: { path: string; code: string; message: string }[] = [];
  const rules: Rule[] = [];

  for (const [index, rule] of document.rules.entries()) {
    try {
      const condition = convertPredicate(rule.when, `rules.${index}.when`);
      rules.push({
        conditions: "fact" in condition ? { all: [condition] } : condition,
        event: { params: { actions: rule.actions }, type: rule.stage },
        id: rule.id,
        is_active: rule.is_active,
        name: rule.name,
        priority: rule.priority,
      });
    } catch (error) {
      issues.push({
        code: "UNREPRESENTABLE_EXPRESSION",
        message: error instanceof Error ? error.message : "Invalid expression",
        path:
          error instanceof ConversionError ? error.path : `rules.${index}.when`,
      });
    }
  }

  if (issues.length) {
    return { compatible: false, document: null, issues };
  }

  try {
    const converted = RulesSchema.parse({ ...document, rules, version: 2 });
    compileValidatedRules(converted);

    return { compatible: true, document: converted, issues };
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
