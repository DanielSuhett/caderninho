import { z } from "zod/v4";

import { OperationStatusSchema } from "#contracts/operation.ts";

// D1 row, serialized payloads and checkpoint layout are private to persistence.
export const OperationSchema = z.object({
  id: z.string(),
  kind: z.string(),
  input: z.string(),
  input_hash: z.string(),
  rules_revision: z.string(),
  reference_day: z.string(),
  status: OperationStatusSchema,
  phase: z.string(),
  cancel_requested: z.number(),
  dispatched: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
  progress: z.string(),
  result: z.string().nullable(),
  error: z.string().nullable(),
});
export type Operation = z.infer<typeof OperationSchema>;

export const ProgressSchema = z.object({
  pages: z.number().default(0),
  received: z.number().default(0),
  new: z.number().default(0),
  changed: z.number().default(0),
  unchanged: z.number().default(0),
  classified: z.number().default(0),
  resources: z.number().default(0),
  errors: z.number().default(0),
  duplicates: z.number().default(0),
});
export const CheckpointSchema = z.object({
  cursor: z.string().nullable(),
  creation_floor: z.string().nullable(),
  maximum_created_at: z.string().nullable(),
  page: z.number(),
  done: z.number(),
  expected_total: z.number().nullable(),
  collected: z.number(),
});
