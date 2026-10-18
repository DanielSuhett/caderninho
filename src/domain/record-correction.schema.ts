import { z } from "zod/v4";

import { ResourceSchema } from "#domain/enums.schema.ts";
import {
  CorrectionField,
  type CorrectionInput,
  type RecordReference,
} from "#domain/record-correction.types.ts";

export const RecordReferenceSchema = z.object({
  itemId: z.string().min(1),
  resource: ResourceSchema,
  parentId: z.string().default(""),
  id: z.string().min(1),
}) satisfies z.ZodType<RecordReference>;

export const CorrectionInputSchema = RecordReferenceSchema.extend({
  field: z.enum(CorrectionField),
  key: z.string().min(1).max(80).optional(),
  value: z.string().max(2048).nullable(),
}) satisfies z.ZodType<CorrectionInput>;
