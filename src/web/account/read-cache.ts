// Short-lived, bounded and scoped to this mounted installation. Never persisted.
export function createReadCache(now = Date.now) {
  const entries = new Map<string, { value: unknown; expires: number }>();
  const pending = new Map<string, symbol>();
  return {
    clear() {
      entries.clear();
      pending.clear();
    },
    async read(key: string, load: () => Promise<unknown>, fresh = false) {
      const entry = entries.get(key);
      if (!fresh && entry && entry.expires > now()) {
        return entry.value;
      }
      const request = Symbol("read");
      pending.set(key, request);
      try {
        const value = await load();
        if (pending.get(key) === request) {
          entries.delete(key);
          entries.set(key, { expires: now() + 10_000, value });
          if (entries.size > 20) {
            const oldest = entries.keys().next().value;
            if (oldest !== undefined) {
              entries.delete(oldest);
            }
          }
        }
        return value;
      } finally {
        if (pending.get(key) === request) {
          pending.delete(key);
        }
      }
    },
  };
}
