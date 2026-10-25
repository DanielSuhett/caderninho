import { PlanningCursorSchema } from "../../contracts";
import { PlanningError } from "../../domain";
import { hash } from "../../shared";

export async function planningCursor(input: {
  cursor?: string | undefined;
  filter: unknown;
  revision: number;
}) {
  const scope = await hash(input.filter);
  let after = "";
  if (input.cursor) {
    let value: unknown;
    try {
      value = JSON.parse(decodeURIComponent(input.cursor));
    } catch {
      value = null;
    }
    const [revision, selection, key] = PlanningCursorSchema.parse(value);
    if (revision !== input.revision || selection !== scope) {
      throw new Error(PlanningError.RESTART_REQUIRED);
    }
    after = key;
  }
  return {
    after,
    encode: (key: string) =>
      encodeURIComponent(JSON.stringify([input.revision, scope, key])),
  };
}
