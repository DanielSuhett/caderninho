import { Engine } from "json-rules-engine";
import { RE2JS } from "re2js";
import { z } from "zod/v4";

import { compareDecimal, day } from "#domain/exact.ts";
import {
  ActionSchema,
  accents,
  allowed,
  CatalogSchema,
  type Condition,
  ConditionSchema,
  type Derived,
  DerivedSchema,
  fields,
  type Rule,
  RuleSchema,
  type Rules,
  RulesSchema,
  type TransactionContext,
  TransactionContextSchema,
} from "#domain/rules/rules-schema.ts";
import type { FinanceRecord } from "#domain/schemas.ts";
import type { JsonValue } from "#shared/json.ts";

export {
  ActionSchema,
  CatalogSchema,
  type Condition,
  ConditionSchema,
  type Derived,
  DerivedSchema,
  type Rule,
  RuleSchema,
  type Rules,
  RulesSchema,
  type TransactionContext,
  TransactionContextSchema,
};

type Context = { tx: TransactionContext; result: Derived };

function lookup(c: Context, p: string): JsonValue {
  if (!allowed(p)) {
    throw new Error(`Unknown field: ${p}`);
  }
  const [root, key, tag] = p.split(".");

  if (root === "tx") {
    return Object.entries(c.tx).find(([k]) => k === key)?.[1] ?? null;
  }

  if (key === "tags" && tag) {
    return Object.hasOwn(c.result.tags, tag)
      ? (c.result.tags[tag] ?? null)
      : null;
  }

  return Object.entries(c.result).find(([k]) => k === key)?.[1] ?? null;
}

function compare(n: number, op: string) {
  switch (op) {
    case "eq":
      return n === 0;
    case "ne":
      return n !== 0;
    case "gt":
      return n > 0;
    case "gte":
      return n >= 0;
    case "lt":
      return n < 0;
    case "lte":
      return n <= 0;
    default:
      throw new Error(`Unknown comparator: ${op}`);
  }
}

function checkDepth(c: Condition, depth = 0): void {
  if (depth > 24) {
    throw new Error("Condition depth exceeds 24");
  }

  if ("all" in c) {
    for (const child of c.all) {
      checkDepth(child, depth + 1);
    }
  }

  if ("any" in c) {
    for (const child of c.any) {
      checkDepth(child, depth + 1);
    }
  }

  if ("not" in c) {
    checkDepth(c.not, depth + 1);
  }
}

type EngineCondition = Condition & { priority: number };

// Unique sibling priorities preserve left-to-right short-circuiting. The engine
// otherwise evaluates siblings at the same priority concurrently.
function engineCondition(c: Condition, priority = 1): EngineCondition {
  if ("all" in c) {
    return {
      all: c.all.map((x, i) => engineCondition(x, c.all.length - i)),
      priority,
    };
  }

  if ("any" in c) {
    return {
      any: c.any.map((x, i) => engineCondition(x, c.any.length - i)),
      priority,
    };
  }

  if ("not" in c) {
    return { not: engineCondition(c.not), priority };
  }

  return { ...c, priority };
}

function operators(engine: Engine) {
  engine.addOperator(
    "regex",
    (x: JsonValue, pattern: string) =>
      typeof x === "string" &&
      RE2JS.compile(accents(pattern), RE2JS.CASE_INSENSITIVE)
        .matcher(accents(x))
        .find(),
  );
  engine.addOperator(
    "contains",
    (x: JsonValue, values: string | JsonValue[]) =>
      typeof values === "string"
        ? typeof x === "string" && values.includes(x)
        : values.includes(x),
  );
  engine.addOperator(
    "decimalCompare",
    (x: JsonValue, v: { op: string; value: string }) =>
      compare(compareDecimal(z.string().parse(x), v.value), v.op),
  );
  engine.addOperator(
    "decimalBetween",
    (x: JsonValue, v: [string, string]) =>
      compareDecimal(z.string().parse(x), v[0]) >= 0 &&
      compareDecimal(z.string().parse(x), v[1]) <= 0,
  );
  engine.addOperator(
    "dateCompare",
    (x: JsonValue, v: { op: string; value: string }) => {
      const d = day(x);

      let order = 0;

      if (d < v.value) {
        order = -1;
      } else if (d > v.value) {
        order = 1;
      }

      return compare(order, v.op);
    },
  );
}

export function compileRules(input: unknown) {
  return compileValidatedRules(RulesSchema.parse(input));
}

export function compileValidatedRules(doc: Rules) {
  if (JSON.stringify(doc).length > 1048576) {
    throw new Error("Rules exceed 1 MiB");
  }

  const groups = new Map(doc.groups.map((g) => [g.id, g])),
    cats = new Map(doc.categories.map((c) => [c.id, c])),
    aliases = new Map<string, string>();

  const othersFound = doc.groups.find((g) => g.name === "Outros"),
    uncategorizedFound = doc.categories.find((c) => c.name === "Sem categoria");

  if (!othersFound || !uncategorizedFound) {
    throw new Error("Catalog requires Outros and Sem categoria");
  }

  const others = othersFound,
    uncategorized = uncategorizedFound;

  if (
    groups.size !== doc.groups.length ||
    cats.size !== doc.categories.length
  ) {
    throw new Error("Duplicate catalog id");
  }

  for (const cat of doc.categories) {
    if (!groups.has(cat.group_id)) {
      throw new Error(`Unknown group: ${cat.id}`);
    }

    for (const alias of [cat.name, ...cat.aliases]) {
      if (
        !alias.trim() ||
        (aliases.has(alias) && aliases.get(alias) !== cat.id)
      ) {
        throw new Error(`Ambiguous alias: ${alias}`);
      }
      aliases.set(alias, cat.id);
    }
  }

  const ids = new Set<string>();

  const rules = doc.rules
    .map((r) => {
      if (ids.has(r.id)) {
        throw new Error(`Duplicate rule: ${r.id}`);
      }
      ids.add(r.id);

      for (const a of r.event.params.actions) {
        if ((a.op === "set_category") !== (r.event.type === "classify")) {
          throw new Error(`Invalid phase: ${r.id}`);
        }

        if (a.op === "set_category" && !cats.has(a.value)) {
          throw new Error(`Unknown category: ${r.id}`);
        }

        if (a.op === "set_description") {
          for (const m of a.value.matchAll(/\{\{\s*([^}]+?)\s*\}\}/g)) {
            const field = m[1];

            if (!field || !fields.has(field) || !field.startsWith("tx.")) {
              throw new Error(`Invalid template: ${r.id}`);
            }
          }
        }
      }

      checkDepth(r.conditions);

      return r;
    })
    // Stable sort retains document order for equal public priorities.
    .sort((a, b) => a.priority - b.priority);

  async function evaluate(tx: TransactionContext): Promise<Derived> {
    const result: Derived = {
      category_id: "",
      category: tx.original_category,
      category_group_id: others.id,
      category_group: others.name,
      description: tx.description,
      tags: {},
      ignored: false,
      evidence: [],
    };

    function setCategory(id: string) {
      const cat = cats.get(id);

      if (!cat) {
        throw new Error("Unknown category");
      }
      const group = groups.get(cat.group_id);

      if (!group) {
        throw new Error("Unknown group");
      }
      Object.assign(result, {
        category_id: id,
        category: cat.name,
        category_group_id: group.id,
        category_group: group.name,
      });
    }

    const initial = tx.original_category.trim()
      ? aliases.get(tx.original_category)
      : uncategorized.id;

    if (initial) {
      setCategory(initial);
    }

    let categorySet = false,
      descriptionSet = false;

    for (const phase of ["classify", "enrich"]) {
      const engine = new Engine();
      operators(engine);

      for (const field of fields) {
        engine.addFact(field, () => lookup({ tx, result }, field), {
          cache: false,
        });
      }

      const ordered = rules.filter(
        (rule) => rule.is_active && rule.event.type === phase,
      );

      for (const [index, rule] of ordered.entries()) {
        function tagFacts(c: Condition): void {
          if ("fact" in c && !fields.has(c.fact)) {
            engine.addFact(c.fact, () => lookup({ tx, result }, c.fact), {
              cache: false,
            });
          }

          if ("all" in c) {
            c.all.forEach(tagFacts);
          }

          if ("any" in c) {
            c.any.forEach(tagFacts);
          }

          if ("not" in c) {
            tagFacts(c.not);
          }
        }

        tagFacts(rule.conditions);
        engine.addRule({
          conditions: { all: [engineCondition(rule.conditions)] },
          event: rule.event,
          priority: ordered.length - index,
          onSuccess: () => {
            for (const action of rule.event.params.actions) {
              if (action.op === "set_category") {
                if (categorySet) {
                  continue;
                }
                setCategory(action.value);
                categorySet = true;
              }

              if (action.op === "set_description") {
                if (descriptionSet) {
                  continue;
                }
                const missing: string[] = [];

                const text = action.value.replace(
                  /\{\{\s*([^}]+?)\s*\}\}/g,
                  (_, p: string) => {
                    const x = lookup({ tx, result }, p);

                    if (typeof x !== "string" || !x.trim()) {
                      missing.push(p);
                    }

                    return typeof x === "string" ? x : "";
                  },
                );

                if (missing.length) {
                  continue;
                }
                result.description = text;
                descriptionSet = true;
              }

              if (action.op === "set_tag") {
                if (Object.hasOwn(result.tags, action.key)) {
                  continue;
                }
                Object.defineProperty(result.tags, action.key, {
                  value: action.value,
                  enumerable: true,
                  writable: true,
                  configurable: true,
                });
              }

              if (action.op === "ignore") {
                result.ignored = true;
              }
              result.evidence.push({ ruleId: rule.id, action });
            }

            if (phase === "classify" && categorySet) {
              engine.stop();
            }
          },
        });
      }

      await engine.run();
    }

    return result;
  }

  return { document: doc, evaluate };
}

export const EMPTY_RULES: Rules = {
  version: 2,
  groups: [{ id: "other", name: "Outros" }],
  categories: [
    {
      id: "uncategorized",
      name: "Sem categoria",
      group_id: "other",
      aliases: [],
    },
  ],
  rules: [],
};

export function txContext(r: FinanceRecord): TransactionContext {
  const text = (k: string) => {
    const value = r[k];

    if (value === null || value === undefined) {
      return "";
    }

    if (typeof value === "object") {
      throw new Error("INVALID_RULE_FIELD");
    }

    return String(value);
  };

  return {
    id: r.id,
    account_id: text("accountId"),
    account_name: text("accountName"),
    description: text("description"),
    counterparty_name: text("counterparty"),
    direction: text("type"),
    operation: text("operationType"),
    payment_method: text("paymentMethod"),
    currency: text("currencyCode"),
    account_type: text("accountType"),
    original_category: text("category"),
    amount: text("amount"),
    amount_abs: text("amount").replace(/^[-+]/, ""),
    date: text("accountingDate"),
    installment_number: text("creditCardMetadata.installmentNumber"),
    total_installments: text("creditCardMetadata.totalInstallments"),
  };
}
