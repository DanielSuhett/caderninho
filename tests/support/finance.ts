import { prepareEntity as prepare } from "@/worker/composition";
import { entityStatements } from "@/worker/finance/entities.repository";

export async function prepareEntity(
  db: D1Database,
  input: Parameters<typeof prepare>[1],
) {
  const prepared = await prepare(db, input);
  return { ...prepared, statements: entityStatements(db, prepared.mutation) };
}
