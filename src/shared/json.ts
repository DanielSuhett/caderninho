import { z } from "zod/v4";

import type { JsonValue } from "./json.types";

export const JsonValueSchema = z.json();

export function parseJson(text: string): JsonValue {
  return JsonValueSchema.parse(JSON.parse(text));
}
