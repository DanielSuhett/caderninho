import { Engine } from "json-rules-engine";
import { RE2JS } from "re2js";

import { FaultCode } from "#domain/enums.ts";
import { compareDecimal, day } from "#domain/exact.ts";
import { fail } from "#domain/fault.ts";
import type { FinanceRecord } from "#domain/finance.types.ts";
import { accents, allowed, fields } from "#domain/rules/rule-fields.ts";
import {
  type Action,
  Comparator,
  type Condition,
  type Derived,
  type Rule,
  RuleAction,
  RuleOperator,
  RulePhase,
  type Rules,
  type TransactionContext,
} from "#domain/rules/rules.types.ts";
import type { JsonValue } from "#shared/json.types.ts";

type Context = { tx: TransactionContext; result: Derived };

function lookup(c: Context, p: string): JsonValue {
  if (!allowed(p)) {
    throw new Error(`Unknown field: ${p}`);
  }
  if (p.startsWith("tx.")) {
    const transaction: Record<string, string> = c.tx;
    return transaction[p.slice(3)] ?? null;
  }

  if (p.startsWith("result.tags.")) {
    const tag = p.slice(12);
    return Object.hasOwn(c.result.tags, tag)
      ? (c.result.tags[tag] ?? null)
      : null;
  }

  const result: Record<string, JsonValue> = c.result;
  return result[p.slice(7)] ?? null;
}

function compare(n: number, op: string) {
  switch (op) {
    case Comparator.eq:
      return n === 0;
    case Comparator.ne:
      return n !== 0;
    case Comparator.gt:
      return n > 0;
    case Comparator.gte:
      return n >= 0;
    case Comparator.lt:
      return n < 0;
    case Comparator.lte:
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

function decimalFact(value: JsonValue) {
  if (typeof value !== "string") {
    fail(FaultCode.INVALID_ARGUMENT);
  }
  return value;
}

function operators(engine: Engine, expressions: Map<string, RE2JS>) {
  engine.addOperator(RuleOperator.regex, (x: JsonValue, pattern: string) => {
    if (typeof x !== "string") {
      return false;
    }
    let expression = expressions.get(pattern);
    if (!expression) {
      expression = RE2JS.compile(accents(pattern), RE2JS.CASE_INSENSITIVE);
      expressions.set(pattern, expression);
    }
    return expression.matcher(accents(x)).find();
  });
  engine.addOperator(
    RuleOperator.contains,
    (x: JsonValue, values: string | JsonValue[]) =>
      typeof values === "string"
        ? typeof x === "string" && values.includes(x)
        : values.includes(x),
  );
  engine.addOperator(
    RuleOperator.decimalCompare,
    (x: JsonValue, v: { op: string; value: string }) =>
      compare(compareDecimal(decimalFact(x), v.value), v.op),
  );
  engine.addOperator(
    RuleOperator.decimalBetween,
    (x: JsonValue, v: [string, string]) => {
      const amount = decimalFact(x);
      return (
        compareDecimal(amount, v[0]) >= 0 && compareDecimal(amount, v[1]) <= 0
      );
    },
  );
  engine.addOperator(
    RuleOperator.dateCompare,
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

  const others = othersFound,
    uncategorized = uncategorizedFound;

  const ids = new Set<string>();

  const rules = doc.rules
    .map((r) => {
      if (ids.has(r.id)) {
        throw new Error(`Duplicate rule: ${r.id}`);
      }
      ids.add(r.id);

      validateRuleActions(r, cats);

      checkDepth(r.conditions);

      return r;
    })
    // Stable sort retains document order for equal public priorities.
    .sort((a, b) => a.priority - b.priority);

  const phases = [RulePhase.classify, RulePhase.enrich].map((phase) => {
    const active = rules.filter(
      (rule) => rule.is_active && rule.event.type === phase,
    );
    const facts = new Set(fields);
    return {
      phase,
      facts,
      rules: active.map((rule, index) => {
        collectFacts(rule.conditions, facts);
        return {
          id: rule.id,
          conditions: { all: [engineCondition(rule.conditions)] },
          event: rule.event,
          priority: active.length - index,
        };
      }),
    };
  });
  // The validated document bounds this cache; no transaction state is shared.
  const expressions = new Map<string, RE2JS>();

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
    const context = { tx, result };

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

    const applied = { category: false, description: false };

    for (const stage of phases) {
      if (!stage.rules.length) {
        continue;
      }
      const engine = new Engine();
      operators(engine, expressions);

      for (const field of stage.facts) {
        engine.addFact(field, () => lookup(context, field), {
          cache: false,
        });
      }

      for (const rule of stage.rules) {
        engine.addRule({
          conditions: rule.conditions,
          event: rule.event,
          priority: rule.priority,
          onSuccess: () => {
            for (const action of rule.event.params.actions) {
              if (applyAction(action, context, applied, setCategory)) {
                result.evidence.push({ ruleId: rule.id, action });
              }
            }

            if (stage.phase === RulePhase.classify && applied.category) {
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

function applyAction(
  action: Action,
  context: Context,
  applied: { category: boolean; description: boolean },
  setCategory: (id: string) => void,
): boolean {
  if (action.op === RuleAction.set_category) {
    if (applied.category) {
      return false;
    }
    setCategory(action.value);
    applied.category = true;
  }

  if (action.op === RuleAction.set_description) {
    if (applied.description) {
      return false;
    }
    const text = renderDescription(action.value, context);
    if (text === undefined) {
      return false;
    }
    context.result.description = text;
    applied.description = true;
  }

  if (action.op === RuleAction.set_tag) {
    if (Object.hasOwn(context.result.tags, action.key)) {
      return false;
    }
    Object.defineProperty(context.result.tags, action.key, {
      value: action.value,
      enumerable: true,
      writable: true,
      configurable: true,
    });
  }

  if (action.op === RuleAction.ignore) {
    context.result.ignored = true;
  }
  return true;
}

function renderDescription(template: string, context: Context) {
  const missing: string[] = [];

  const text = template.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, p: string) => {
    const x = lookup(context, p);

    if (typeof x !== "string" || !x.trim()) {
      missing.push(p);
    }

    return typeof x === "string" ? x : "";
  });

  return missing.length ? undefined : text;
}

function validateRuleActions(
  r: Rule,
  cats: Map<string, Rules["categories"][number]>,
) {
  for (const a of r.event.params.actions) {
    if (
      (a.op === RuleAction.set_category) !==
      (r.event.type === RulePhase.classify)
    ) {
      throw new Error(`Invalid phase: ${r.id}`);
    }

    if (a.op === RuleAction.set_category && !cats.has(a.value)) {
      throw new Error(`Unknown category: ${r.id}`);
    }

    if (a.op === RuleAction.set_description) {
      for (const m of a.value.matchAll(/\{\{\s*([^}]+?)\s*\}\}/g)) {
        const field = m[1];

        if (!field || !fields.has(field) || !field.startsWith("tx.")) {
          throw new Error(`Invalid template: ${r.id}`);
        }
      }
    }
  }
}

function collectFacts(condition: Condition, facts: Set<string>): void {
  if ("fact" in condition && !fields.has(condition.fact)) {
    facts.add(condition.fact);
  }
  if ("all" in condition) {
    for (const child of condition.all) {
      collectFacts(child, facts);
    }
  }
  if ("any" in condition) {
    for (const child of condition.any) {
      collectFacts(child, facts);
    }
  }
  if ("not" in condition) {
    collectFacts(condition.not, facts);
  }
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
  const amount = String(r.amount ?? "");

  return {
    id: r.id,
    account_id: r.accountId ?? "",
    account_name: r.accountName ?? "",
    description: r.description ?? "",
    counterparty_name: r.counterparty ?? "",
    direction: r.type ?? "",
    operation: r.operationType ?? "",
    payment_method: r.paymentMethod ?? "",
    currency: r.currencyCode ?? "",
    account_type: r.accountType ?? "",
    original_category: r.category ?? "",
    amount,
    amount_abs: amount.replace(/^[-+]/, ""),
    date: r.accountingDate ?? "",
    installment_number: String(r["creditCardMetadata.installmentNumber"] ?? ""),
    total_installments: String(r["creditCardMetadata.totalInstallments"] ?? ""),
  };
}
