import { z } from "zod/v4";

export const FieldSchema = z.enum([
  "date",
  "account",
  "item",
  "currency",
  "direction",
  "original.category",
  "effective.category",
  "effective.group",
  "original.description",
  "effective.description",
  "amountMinor",
  "status",
  "eligible",
  "ignored",
]);

export const PredicateSchema = z
  .object({
    field: FieldSchema,
    op: z.enum(["eq", "ne", "gte", "lte", "contains"]),
    value: z.union([z.string().max(2048), z.boolean()]),
  })
  .strict();

export const FilterSchema = z.union([
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

export type Filter = z.infer<typeof FilterSchema>;
