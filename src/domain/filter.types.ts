export const Field = {
  date: "date",
  account: "account",
  item: "item",
  currency: "currency",
  direction: "direction",
  original_category: "original.category",
  effective_category: "effective.category",
  effective_group: "effective.group",
  original_description: "original.description",
  effective_description: "effective.description",
  amountMinor: "amountMinor",
  status: "status",
  eligible: "eligible",
  ignored: "ignored",
} as const;
export type Field = (typeof Field)[keyof typeof Field];

export const FilterOperator = {
  eq: "eq",
  ne: "ne",
  gte: "gte",
  lte: "lte",
  contains: "contains",
} as const;
export type FilterOperator =
  (typeof FilterOperator)[keyof typeof FilterOperator];

export interface Predicate {
  field: Field;
  op: FilterOperator;
  value: string | boolean;
}

export type Filter =
  | Predicate
  | { tag: string; value: string }
  | { and: Filter[] }
  | { or: Filter[] };
