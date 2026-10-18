import { drizzle } from "drizzle-orm/d1";

export const database = (db: D1Database) => drizzle(db);

export function required<T>(row: T | undefined): T {
  if (row === undefined) {
    throw new Error("ROW_NOT_FOUND");
  }
  return row;
}
