import { z } from "zod/v4";

import { Field, type Filter, FilterOperator } from "./query.entity";

const FieldSchema = z.enum(Field);

const PredicateSchema = z
  .object({
    field: FieldSchema,
    op: z.enum(FilterOperator),
    value: z.union([z.string().max(2048), z.boolean()]),
  })
  .strict();

export const FilterSchema: z.ZodType<Filter> = z.union([
  PredicateSchema,
  z
    .object({ tag: z.string().min(1).max(80), value: z.string().max(2048) })
    .strict(),
  z
    .object({
      get and() {
        return z.array(FilterSchema).min(1).max(30);
      },
    })
    .strict(),
  z
    .object({
      get or() {
        return z.array(FilterSchema).min(1).max(30);
      },
    })
    .strict(),
]);
