// Count metadata from the actual statements, including Drizzle raw reads and
// atomic batches. A Proxy preserves the native statement payload used by batch.
export function measuredDatabase(binding: D1Database) {
  const totals = { rowsRead: 0, rowsWritten: 0, sizeBytes: 0, statements: 0 };
  function record(meta: D1Meta) {
    totals.rowsRead += meta.rows_read;
    totals.rowsWritten += meta.rows_written;
    totals.statements += 1;
    totals.sizeBytes = Math.max(totals.sizeBytes, meta.size_after);
  }
  function statement(prepared: D1PreparedStatement): D1PreparedStatement {
    return new Proxy(prepared, {
      get(target, key) {
        if (key === "bind") {
          return (...values: unknown[]) => statement(target.bind(...values));
        }
        if (key === "all" || key === "run") {
          return async () => {
            const result = await target.all();
            record(result.meta);
            return result;
          };
        }
        if (key === "raw") {
          return async (options?: { columnNames?: boolean }) => {
            const result = await target.all<Record<string, unknown>>();
            record(result.meta);
            const names = Object.keys(result.results[0] ?? {});
            const rows = result.results.map((row) =>
              names.map((name) => row[name]),
            );
            return options?.columnNames ? [names, ...rows] : rows;
          };
        }
        const value: unknown = Reflect.get(target, key);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
  }
  const db = new Proxy(binding, {
    get(target, key) {
      if (key === "prepare") {
        return (query: string) => statement(target.prepare(query));
      }
      if (key === "batch") {
        return async (statements: D1PreparedStatement[]) => {
          const results = await target.batch(statements);
          for (const result of results) {
            record(result.meta);
          }
          return results;
        };
      }
      const value: unknown = Reflect.get(target, key);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  return {
    db,
    reset() {
      totals.rowsRead = 0;
      totals.rowsWritten = 0;
      totals.statements = 0;
      totals.sizeBytes = 0;
    },
    totals,
  };
}
