import { Engine } from "json-rules-engine";
import { RE2JS } from "re2js";

import type { JsonValue } from "../../shared";
import { FaultCode } from "../enums";
import { compareDecimal, day } from "../exact";
import { fail } from "../fault.entity";
import { type FinanceRecord, NORMALIZER } from "../finance.entity";

const tagFieldPattern = /^result\.tags\.[a-zA-Z0-9_-]{1,80}$/;
const diacriticsPattern = /\p{Mn}/gu;
const templateVariablePattern = /\{\{\s*([^}]+?)\s*\}\}/g;
const signPattern = /^[-+]/;

export const RuleAction = {
  ignore: "ignore",
  set_category: "set_category",
  set_description: "set_description",
  set_tag: "set_tag",
} as const;

export type Action =
  | { op: typeof RuleAction.set_category; value: string }
  | { op: typeof RuleAction.set_description; value: string }
  | { op: typeof RuleAction.set_tag; key: string; value: string }
  | { op: typeof RuleAction.ignore };

export const Comparator = {
  eq: "eq",
  gt: "gt",
  gte: "gte",
  lt: "lt",
  lte: "lte",
  ne: "ne",
} as const;
export type Comparator = (typeof Comparator)[keyof typeof Comparator];

export const RuleOperator = {
  contains: "contains",
  dateCompare: "dateCompare",
  decimalBetween: "decimalBetween",
  decimalCompare: "decimalCompare",
  equal: "equal",
  notEqual: "notEqual",
  regex: "regex",
} as const;

export const RulePhase = {
  classify: "classify",
  enrich: "enrich",
} as const;
export type RulePhase = (typeof RulePhase)[keyof typeof RulePhase];

type Literal = string | number | boolean | null;

export type Predicate =
  | {
      fact: string;
      operator: typeof RuleOperator.equal | typeof RuleOperator.notEqual;
      value: Literal;
    }
  | {
      fact: string;
      operator: typeof RuleOperator.contains;
      value: string | Literal[];
    }
  | { fact: string; operator: typeof RuleOperator.regex; value: string }
  | {
      fact: string;
      operator: typeof RuleOperator.decimalCompare;
      value: { op: Comparator; value: string };
    }
  | {
      fact: string;
      operator: typeof RuleOperator.dateCompare;
      value: { op: Comparator; value: string };
    }
  | {
      fact: string;
      operator: typeof RuleOperator.decimalBetween;
      value: [string, string];
    };

export type Condition =
  | Predicate
  | { all: Condition[] }
  | { any: Condition[] }
  | { not: Condition };
export type RuleConditions = Exclude<Condition, Predicate>;

export interface Rule {
  conditions: RuleConditions;
  event: { type: RulePhase; params: { actions: Action[] } };
  id: string;
  is_active: boolean;
  name: string;
  priority: number;
}

export interface Catalog {
  categories: {
    id: string;
    name: string;
    group_id: string;
    aliases: string[];
  }[];
  groups: { id: string; name: string }[];
}

export interface Rules extends Catalog {
  rules: Rule[];
  version: 2;
}

export interface LegacyRules extends Catalog {
  rules: {
    id: string;
    name: string;
    priority: number;
    is_active: boolean;
    stage: RulePhase;
    when: JsonValue;
    actions: Action[];
  }[];
  version: 1;
}

export interface ConversionIssue {
  code: string;
  message: string;
  path: string;
}

export type RuleImportReport =
  | { compatible: true; document: Rules; issues: ConversionIssue[] }
  | { compatible: false; document: null; issues: ConversionIssue[] };

export interface Derived {
  category: string;
  category_group: string;
  category_group_id: string;
  category_id: string;
  description: string;
  evidence: { ruleId: string; action: Action }[];
  ignored: boolean;
  tags: Record<string, string>;
}

export interface TransactionContext {
  account_id: string;
  account_name: string;
  account_type: string;
  amount: string;
  amount_abs: string;
  counterparty_name: string;
  currency: string;
  date: string;
  description: string;
  direction: string;
  id: string;
  installment_number: string;
  operation: string;
  original_category: string;
  payment_method: string;
  total_installments: string;
}

export interface RuleEngine {
  document: Rules;
  evaluate: (transaction: TransactionContext) => Promise<Derived>;
}

const transactionFields = {
  account_id: true,
  account_name: true,
  account_type: true,
  amount: true,
  amount_abs: true,
  counterparty_name: true,
  currency: true,
  date: true,
  description: true,
  direction: true,
  id: true,
  installment_number: true,
  operation: true,
  original_category: true,
  payment_method: true,
  total_installments: true,
} satisfies Record<keyof TransactionContext, true>;

const resultFields = {
  category: true,
  category_group: true,
  category_group_id: true,
  category_id: true,
  description: true,
  ignored: true,
  tags: true,
} satisfies Record<Exclude<keyof Derived, "evidence">, true>;

export const fields = new Set([
  ...Object.keys(transactionFields).map((field) => `tx.${field}`),
  ...Object.keys(resultFields).map((field) => `result.${field}`),
]);

export const allowed = (path: string) =>
  fields.has(path) || tagFieldPattern.test(path);
export const accents = (text: string) =>
  text.normalize("NFD").replace(diacriticsPattern, "");

interface Context {
  result: Derived;
  tx: TransactionContext;
}

export function compileStoredRules({
  document,
  normalizer,
}: {
  document: Rules | LegacyRules;
  normalizer: string;
}) {
  if (document.version === 1) {
    throw new Error("RULES_V1_REQUIRES_EXPLICIT_CONVERSION_AND_ACTIVATION");
  }
  if (normalizer !== NORMALIZER) {
    throw new Error("NORMALIZER_VERSION_REQUIRES_EXPLICIT_UPGRADE");
  }
  return compileValidatedRules(document);
}

function hasField<T extends object>(
  value: T,
  key: string,
): key is string & keyof T {
  return Object.hasOwn(value, key);
}

function lookup(c: Context, p: string): JsonValue {
  if (!allowed(p)) {
    throw new Error(`Unknown field: ${p}`);
  }
  if (p.startsWith("tx.")) {
    const field = p.slice(3);
    return hasField(c.tx, field) ? c.tx[field] : null;
  }

  if (p.startsWith("result.tags.")) {
    const tag = p.slice(12);
    return Object.hasOwn(c.result.tags, tag)
      ? (c.result.tags[tag] ?? null)
      : null;
  }

  const field = p.slice(7);
  return hasField(c.result, field) ? c.result[field] : null;
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
  if (JSON.stringify(doc).length > 1_048_576) {
    throw new Error("Rules exceed 1 MiB");
  }

  const groups = new Map(doc.groups.map((g) => [g.id, g])),
    cats = new Map(doc.categories.map((c) => [c.id, c])),
    aliases = new Map<string, string>();

  const othersFound = doc.groups.find((g) => g.name === "Outros"),
    uncategorizedFound = doc.categories.find((c) => c.name === "Sem categoria");

  if (!(othersFound && uncategorizedFound)) {
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
      facts,
      phase,
      rules: active.map((rule, index) => {
        collectFacts(rule.conditions, facts);
        return {
          conditions: { all: [engineCondition(rule.conditions)] },
          event: rule.event,
          id: rule.id,
          priority: active.length - index,
        };
      }),
    };
  });
  // The validated document bounds this cache; no transaction state is shared.
  const expressions = new Map<string, RE2JS>();

  async function evaluate(tx: TransactionContext): Promise<Derived> {
    const result: Derived = {
      category: tx.original_category,
      category_group: others.name,
      category_group_id: others.id,
      category_id: "",
      description: tx.description,
      evidence: [],
      ignored: false,
      tags: {},
    };
    const context = { result, tx };

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
        category: cat.name,
        category_group: group.name,
        category_group_id: group.id,
        category_id: id,
      });
    }

    const initial = tx.original_category.trim()
      ? aliases.get(tx.original_category)
      : uncategorized.id;

    if (initial) {
      setCategory(initial);
    }

    const applied = { category: false, description: false };

    await phases.reduce(async (previous, stage) => {
      await previous;
      if (!stage.rules.length) {
        return;
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
          onSuccess: () => {
            for (const action of rule.event.params.actions) {
              if (applyAction(action, context, applied, setCategory)) {
                result.evidence.push({ action, ruleId: rule.id });
              }
            }

            if (stage.phase === RulePhase.classify && applied.category) {
              engine.stop();
            }
          },
          priority: rule.priority,
        });
      }

      await engine.run();
    }, Promise.resolve());

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
      configurable: true,
      enumerable: true,
      value: action.value,
      writable: true,
    });
  }

  if (action.op === RuleAction.ignore) {
    context.result.ignored = true;
  }
  return true;
}

function renderDescription(template: string, context: Context) {
  const missing: string[] = [];

  const text = template.replace(templateVariablePattern, (_, p: string) => {
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
      for (const m of a.value.matchAll(templateVariablePattern)) {
        const [, field] = m;

        if (!(field && fields.has(field) && field.startsWith("tx."))) {
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
  categories: [
    {
      aliases: [],
      group_id: "other",
      id: "uncategorized",
      name: "Sem categoria",
    },
  ],
  groups: [{ id: "other", name: "Outros" }],
  rules: [],
  version: 2,
};

export function txContext(r: FinanceRecord): TransactionContext {
  const amount = String(r.amount ?? "");

  return {
    account_id: r.accountId ?? "",
    account_name: r.accountName ?? "",
    account_type: r.accountType ?? "",
    amount,
    amount_abs: amount.replace(signPattern, ""),
    counterparty_name: r.counterparty ?? "",
    currency: r.currencyCode ?? "",
    date: r.accountingDate ?? "",
    description: r.description ?? "",
    direction: r.type ?? "",
    id: r.id,
    installment_number: String(r["creditCardMetadata.installmentNumber"] ?? ""),
    operation: r.operationType ?? "",
    original_category: r.category ?? "",
    payment_method: r.paymentMethod ?? "",
    total_installments: String(r["creditCardMetadata.totalInstallments"] ?? ""),
  };
}
