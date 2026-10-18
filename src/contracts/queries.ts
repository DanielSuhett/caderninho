import { z } from "zod/v4";

import { FilterSchema, Resource, ResourceSchema } from "../domain";
import type { Aggregate, Query } from "./queries.types";

const CursorSchema = z
  .object({
    offset: z.number().int().nonnegative(),
    revision: z.number().int().safe(),
    scope: z.string().length(64),
  })
  .strict();
export const QuerySchema = z
  .object({
    cursor: CursorSchema.optional(),
    filter: FilterSchema.optional(),
    limit: z.number().int().min(1).max(200).default(50),
    resource: ResourceSchema.default(Resource.transactions),
  })
  .strict() satisfies z.ZodType<Query>;
export const AggregateSchema = z
  .object({
    filter: FilterSchema.optional(),
    metric: z.string().optional(),
    resource: ResourceSchema.default(Resource.transactions),
  })
  .strict() satisfies z.ZodType<Aggregate>;
