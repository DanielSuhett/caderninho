export type Result<T> = { data: T; error: null } | { data: null; error: Error };

export function normalizeError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

export async function tryCatch<T>(promise: Promise<T>): Promise<Result<T>> {
  try {
    return { data: await promise, error: null };
  } catch (error: unknown) {
    return { data: null, error: normalizeError(error) };
  }
}
