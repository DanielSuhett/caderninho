import { tryCatch } from "../../shared";

// Short-lived, bounded and scoped to this mounted installation. Never persisted.
export interface ReadCache<T> {
  clear: () => void;
  // A request already in flight for this key; the next read adopts it.
  prime: (key: string, request: Promise<T>) => void;
  read: (key: string, load: () => Promise<T>, fresh?: boolean) => Promise<T>;
}

export function createReadCache<T = unknown>(now = Date.now): ReadCache<T> {
  const entries = new Map<string, { value: T; expires: number }>();
  const pending = new Map<string, symbol>();
  const primed = new Map<string, Promise<T>>();
  return {
    clear() {
      entries.clear();
      pending.clear();
      primed.clear();
    },
    prime(key: string, request: Promise<T>) {
      primed.set(key, request);
      // Unclaimed failures are dropped; a later read issues its own request.
      tryCatch(request).then(
        ({ data: _data, error: _error }) => undefined,
        () => undefined,
      );
    },
    async read(key: string, load: () => Promise<T>, fresh = false) {
      const entry = entries.get(key);
      if (!fresh && entry && entry.expires > now()) {
        return entry.value;
      }
      const started = fresh ? undefined : primed.get(key);
      primed.delete(key);
      const request = Symbol("read");
      pending.set(key, request);
      try {
        const value = await (started ?? load());
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

// The last result of each view, shown at once when the user returns while it
// revalidates. Memory only, bounded, and cleared with the request caches.
const views = new Set<Map<string, unknown>>();

export interface ViewCache<T> {
  get: (key: string) => T | undefined;
  set: (key: string, value: T) => void;
}

export function createViewCache<T>(): ViewCache<T> {
  const entries = new Map<string, T>();
  views.add(entries);
  return {
    get: (key) => entries.get(key),
    set(key, value) {
      entries.delete(key);
      entries.set(key, value);
      if (entries.size > 12) {
        const oldest = entries.keys().next().value;
        if (oldest !== undefined) {
          entries.delete(oldest);
        }
      }
    },
  };
}

export function clearViews() {
  for (const entries of views) {
    entries.clear();
  }
}
