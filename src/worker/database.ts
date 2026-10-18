import { drizzle } from "drizzle-orm/d1";
import { z } from "zod/v4";

export const database = (db: D1Database) => drizzle(db);

// Compile Drizzle builders into native D1 statements so data and Workflow
// checkpoints keep committing in the same D1 batch, including complex SQL.
export function preparedStatement(
  db: D1Database,
  query: { toSQL(): { sql: string; params: unknown[] } },
) {
  const compiled = query.toSQL();
  return db.prepare(compiled.sql).bind(...compiled.params);
}

export function statement(
  db: D1Database,
  sql: string,
  ...params: (string | number | null)[]
) {
  return db.prepare(sql).bind(...params);
}

export async function rows<S extends z.ZodType>(
  stmt: D1PreparedStatement,
  schema: S,
): Promise<z.infer<S>[]> {
  const r = await stmt.all();
  if (!r.success) throw new Error("D1 read failed");
  return z.array(schema).parse(r.results);
}

export async function hash(value: unknown) {
  function stable(v: unknown): unknown {
    if (Array.isArray(v)) return v.map(stable);
    if (v && typeof v === "object")
      return Object.fromEntries(
        Object.entries(v)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, x]) => [k, stable(x)]),
      );
    return v;
  }
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(JSON.stringify(stable(value))),
      ),
    ),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
}
