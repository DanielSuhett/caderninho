import type { Resource } from "./enums";
import { assertMinor } from "./exact";
import type { RecordReference } from "./finance.entity";

export const Field = {
  account: "account",
  amountMinor: "amountMinor",
  currency: "currency",
  date: "date",
  direction: "direction",
  effective_category: "effective.category",
  effective_description: "effective.description",
  effective_group: "effective.group",
  eligible: "eligible",
  ignored: "ignored",
  item: "item",
  original_category: "original.category",
  original_description: "original.description",
  status: "status",
} as const;
export type Field = (typeof Field)[keyof typeof Field];

export const FilterOperator = {
  contains: "contains",
  eq: "eq",
  gte: "gte",
  lte: "lte",
  ne: "ne",
} as const;
export type FilterOperator =
  (typeof FilterOperator)[keyof typeof FilterOperator];

export interface Predicate {
  field: Field;
  op: FilterOperator;
  value: string | boolean;
}

export const FilterOperandKind = {
  amount: "amount",
  scalar: "scalar",
} as const;
export type FilterOperand =
  | { kind: typeof FilterOperandKind.amount; value: string }
  | { kind: typeof FilterOperandKind.scalar; value: string | boolean };

export type Filter =
  | Predicate
  | { tag: string; value: string }
  | { and: Filter[] }
  | { or: Filter[] };

export type Identity = RecordReference;

export interface Cursor {
  offset: number;
  revision: number;
  scope: string;
}

export interface Query {
  cursor?: Cursor | undefined;
  filter?: Filter | undefined;
  limit: number;
  resource: Resource;
}

export interface Aggregate {
  filter?: Filter | undefined;
  metric?: string | undefined;
  resource: Resource;
}

export function assertReadRevision({
  expected,
  actual,
}: {
  expected: number;
  actual: number;
}) {
  if (expected !== actual) {
    throw new Error("RESTART_REQUIRED");
  }
}

export function assertCursorScope({
  expected,
  actual,
}: {
  expected: string;
  actual: string;
}) {
  if (expected !== actual) {
    throw new Error("CURSOR_SCOPE_MISMATCH");
  }
}

export function filterOperand(filter: Predicate): FilterOperand {
  let operand: FilterOperand;
  if (filter.field === Field.amountMinor) {
    if (typeof filter.value !== "string") {
      throw new Error("Invalid amount filter");
    }
    assertMinor(filter.value);
    operand = { kind: FilterOperandKind.amount, value: filter.value };
  } else {
    operand = { kind: FilterOperandKind.scalar, value: filter.value };
  }
  if (
    filter.op === FilterOperator.contains &&
    !filter.field.endsWith("description")
  ) {
    throw new Error("contains only supports description");
  }
  return operand;
}
