import { z } from "zod/v4";

import { ResourceSchema } from "#domain/enums.ts";

export const RecordReferenceSchema = z.object({
  itemId: z.string().min(1),
  resource: ResourceSchema,
  parentId: z.string().default(""),
  id: z.string().min(1),
});

export type RecordReference = z.infer<typeof RecordReferenceSchema>;

export const CorrectionInputSchema = RecordReferenceSchema.extend({
  field: z.enum(["category", "description", "ignored", "tag"]),
  key: z.string().min(1).max(80).optional(),
  value: z.string().max(2048).nullable(),
});

export type CorrectionInput = z.infer<typeof CorrectionInputSchema>;

const RecordChangeSchema = z.discriminatedUnion("field", [
  z.object({
    field: z.literal("tag"),
    key: z.string().min(1).max(80),
    value: z.string().max(2048).nullable(),
  }),
  z.object({
    field: z.enum(["category", "description", "ignored"]),
    value: z.string().max(2048).nullable(),
  }),
]);

export type RecordChange = z.infer<typeof RecordChangeSchema>;

export function recordChange(input: CorrectionInput): RecordChange {
  if (input.field === "tag")
    return {
      field: "tag",
      key: z.string().min(1).max(80).parse(input.key),
      value: input.value,
    };

  if (
    input.field === "ignored" &&
    input.value !== null &&
    !["0", "1"].includes(input.value)
  )
    throw new Error("ignored requires 0 or 1");

  return { field: input.field, value: input.value };
}
