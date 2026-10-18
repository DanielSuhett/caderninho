import assert from "node:assert/strict";

import { z } from "zod/v4";

// MCP transport probes retain unrecognized JSON fields for wire parity checks.
const ResultSchema = z
  .object({
    content: z
      .array(
        z.object({ text: z.string().optional(), type: z.string() }).loose(),
      )
      .optional(),
    isError: z.boolean().optional(),
    result: z.object({ isError: z.boolean().optional() }).loose().optional(),
    resultType: z.string().optional(),
    status: z.string().optional(),
    statusMessage: z.string().optional(),
    task: z.json().optional(),
    taskId: z.string().optional(),
  })
  .loose();
const EnvelopeSchema = z
  .object({
    error: z
      .object({
        code: z.number(),
        data: z.json().optional(),
        message: z.string(),
      })
      .optional(),
    id: z.union([z.string(), z.number(), z.null()]),
    jsonrpc: z.string(),
    result: ResultSchema.optional(),
  })
  .loose();
export async function responseJson(response: Response) {
  return EnvelopeSchema.parse(await response.json());
}
export function required<T>(value: T): NonNullable<T> {
  assert.ok(value !== null && value !== undefined, "expected a present value");
  return value;
}
export const sourceUrl = (input: Parameters<typeof fetch>[0]) =>
  new URL(
    typeof input === "string" || input instanceof URL ? input : input.url,
  );
