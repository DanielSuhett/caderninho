import type { JsonValue } from "#shared/json.types.ts";

export const RuleAction = {
  set_category: "set_category",
  set_description: "set_description",
  set_tag: "set_tag",
  ignore: "ignore",
} as const;

export type Action =
  | { op: typeof RuleAction.set_category; value: string }
  | { op: typeof RuleAction.set_description; value: string }
  | { op: typeof RuleAction.set_tag; key: string; value: string }
  | { op: typeof RuleAction.ignore };

export const Comparator = {
  eq: "eq",
  ne: "ne",
  gt: "gt",
  gte: "gte",
  lt: "lt",
  lte: "lte",
} as const;
export type Comparator = (typeof Comparator)[keyof typeof Comparator];

export const RuleOperator = {
  equal: "equal",
  notEqual: "notEqual",
  contains: "contains",
  regex: "regex",
  decimalCompare: "decimalCompare",
  dateCompare: "dateCompare",
  decimalBetween: "decimalBetween",
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
  id: string;
  name: string;
  priority: number;
  is_active: boolean;
  conditions: RuleConditions;
  event: { type: RulePhase; params: { actions: Action[] } };
}

export interface Catalog {
  groups: { id: string; name: string }[];
  categories: {
    id: string;
    name: string;
    group_id: string;
    aliases: string[];
  }[];
}

export interface Rules extends Catalog {
  version: 2;
  rules: Rule[];
}

export interface LegacyRules extends Catalog {
  version: 1;
  rules: {
    id: string;
    name: string;
    priority: number;
    is_active: boolean;
    stage: RulePhase;
    when: JsonValue;
    actions: Action[];
  }[];
}

export interface ConversionIssue {
  path: string;
  code: string;
  message: string;
}

export type RuleImportReport =
  | { compatible: true; document: Rules; issues: ConversionIssue[] }
  | { compatible: false; document: null; issues: ConversionIssue[] };

export type Derived = {
  category_id: string;
  category: string;
  category_group_id: string;
  category_group: string;
  description: string;
  tags: Record<string, string>;
  ignored: boolean;
  evidence: { ruleId: string; action: Action }[];
};

export type TransactionContext = {
  id: string;
  account_id: string;
  account_name: string;
  description: string;
  counterparty_name: string;
  direction: string;
  operation: string;
  payment_method: string;
  currency: string;
  account_type: string;
  original_category: string;
  amount: string;
  amount_abs: string;
  date: string;
  installment_number: string;
  total_installments: string;
};

export interface RuleEngine {
  document: Rules;
  evaluate(transaction: TransactionContext): Promise<Derived>;
}
