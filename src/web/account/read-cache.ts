// Short-lived, bounded and scoped to this mounted installation. Never persisted.
export function createReadCache(now = Date.now) {
  const entries = new Map<string, { value: unknown; expires: number }>();
  let generation = 0;
  return {
    clear() {
      generation += 1;
      entries.clear();
    },
    async read(key: string, load: () => Promise<unknown>, fresh = false) {
      const entry = entries.get(key);
      if (!fresh && entry && entry.expires > now()) {
        return entry.value;
      }
      const started = generation;
      const value = await load();
      if (started === generation) {
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
    },
  };
}
