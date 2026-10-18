import { z } from "zod/v4";

import type { JsonValue } from "#shared/json.types.ts";

export const JsonValueSchema = z.json();

export function parseJson(text: string): JsonValue {
  return JsonValueSchema.parse(JSON.parse(text));
}
