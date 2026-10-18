import assert from "node:assert/strict";

import { z } from "zod/v4";

// MCP transport probes retain unrecognized JSON fields for wire parity checks.
const ResultSchema = z
  .object({
    resultType: z.string().optional(),
    taskId: z.string().optional(),
    task: z.json().optional(),
    status: z.string().optional(),
    statusMessage: z.string().optional(),
    result: z.object({ isError: z.boolean().optional() }).loose().optional(),
    content: z
      .array(
        z.object({ type: z.string(), text: z.string().optional() }).loose(),
      )
      .optional(),
    isError: z.boolean().optional(),
  })
  .loose();
const EnvelopeSchema = z
  .object({
    jsonrpc: z.string(),
    id: z.union([z.string(), z.number(), z.null()]),
    result: ResultSchema.optional(),
    error: z
      .object({
        code: z.number(),
        message: z.string(),
        data: z.json().optional(),
      })
      .optional(),
  })
  .loose();
export async function responseJson(response: Response) {
  return EnvelopeSchema.parse(await response.json());
}
export function required<T>(value: T): NonNullable<T> {
  assert.ok(value != null, "expected a present value");
  return value;
}
export const sourceUrl = (input: Parameters<typeof fetch>[0]) =>
  new URL(
    typeof input === "string" || input instanceof URL ? input : input.url,
  );
