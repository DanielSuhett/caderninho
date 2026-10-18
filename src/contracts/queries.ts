import { z } from "zod/v4";

import type { Aggregate, Query } from "#contracts/queries.types.ts";
import { ResourceSchema } from "#domain/enums.schema.ts";
import { Resource } from "#domain/enums.ts";
import { FilterSchema } from "#domain/filter.ts";

const CursorSchema = z
  .object({
    revision: z.number().int().safe(),
    offset: z.number().int().nonnegative(),
    scope: z.string().length(64),
  })
  .strict();
export const QuerySchema = z
  .object({
    resource: ResourceSchema.default(Resource.transactions),
    filter: FilterSchema.optional(),
    limit: z.number().int().min(1).max(200).default(50),
    cursor: CursorSchema.optional(),
  })
  .strict() satisfies z.ZodType<Query>;
export const AggregateSchema = z
  .object({
    resource: ResourceSchema.default(Resource.transactions),
    filter: FilterSchema.optional(),
    metric: z.string().optional(),
  })
  .strict() satisfies z.ZodType<Aggregate>;
