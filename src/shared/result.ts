export type Result<T> = { data: T; error: null } | { data: null; error: Error };

function normalizeError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

export async function tryCatch<T>(
  operation: Promise<T> | (() => T | Promise<T>),
): Promise<Result<T>> {
  try {
    return {
      data: await (typeof operation === "function" ? operation() : operation),
      error: null,
    };
  } catch (error: unknown) {
    return { data: null, error: normalizeError(error) };
  }
}

// Synchronous validation boundaries (parse and plan) that recover per item.
export function tryCatchSync<T>(operation: () => T): Result<T> {
  try {
    return { data: operation(), error: null };
  } catch (error: unknown) {
    return { data: null, error: normalizeError(error) };
  }
}
