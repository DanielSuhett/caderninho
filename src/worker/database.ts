import { drizzle } from "drizzle-orm/d1";

export const database = (db: D1Database) => drizzle(db);

export function required<T>(row: T | undefined): T {
  if (row === undefined) {
    throw new Error("ROW_NOT_FOUND");
  }
  return row;
}

export async function hash(value: unknown) {
  function stable(v: unknown): unknown {
    if (Array.isArray(v)) {
      return v.map(stable);
    }
    if (v && typeof v === "object") {
      return Object.fromEntries(
        Object.entries(v)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, x]) => [k, stable(x)]),
      );
    }
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
