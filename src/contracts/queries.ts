import { z } from "zod/v4";

import { ResourceSchema } from "#domain/enums.ts";
import { RecordReferenceSchema } from "#domain/record-correction.ts";

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

export const IdentitySchema = z.object({
  principal: z.string().min(1),
  ...RecordReferenceSchema.shape,
});
export type Identity = z.infer<typeof IdentitySchema>;

export const CursorSchema = z
  .object({
    revision: z.number().int().safe(),
    offset: z.number().int().nonnegative(),
    scope: z.string().length(64),
  })
  .strict();
export const QuerySchema = z
  .object({
    resource: ResourceSchema.default("transactions"),
    filter: FilterSchema.optional(),
    limit: z.number().int().min(1).max(200).default(50),
    cursor: CursorSchema.optional(),
  })
  .strict();
export const AggregateSchema = z
  .object({
    resource: ResourceSchema.default("transactions"),
    filter: FilterSchema.optional(),
    metric: z.string().optional(),
  })
  .strict();
export type Query = z.infer<typeof QuerySchema>;
export type Aggregate = z.infer<typeof AggregateSchema>;
