import { z } from "zod/v4";

export const JsonValueSchema = z.json();

import type { JsonValue } from "#shared/json.types.ts";

export function parseJson(text: string): JsonValue {
  return JsonValueSchema.parse(JSON.parse(text));
}
