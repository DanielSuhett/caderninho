import { z } from "zod/v4";

export const JsonValueSchema = z.json();

export type JsonValue = z.infer<typeof JsonValueSchema>;

export function parseJson(text: string): JsonValue {
  return JsonValueSchema.parse(JSON.parse(text));
}
