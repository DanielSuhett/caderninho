import { z } from "zod/v4";

import { ResourceSchema } from "#domain/enums.ts";
import {
  FieldSchema,
  type Filter,
  FilterSchema,
  PredicateSchema,
} from "#domain/filter.ts";
import { RecordReferenceSchema } from "#domain/record-correction.ts";

export { FieldSchema, type Filter, FilterSchema, PredicateSchema };

export const IdentitySchema = RecordReferenceSchema;
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
