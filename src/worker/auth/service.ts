import type { createAuthRepository } from "#worker/auth/repository.ts";

export function adminConfigured(password: string | undefined) {
  return (
    typeof password === "string" &&
    password.length >= 16 &&
    password.length <= 256
  );
}

export async function verifyPassword(
  expected: string | undefined,
  supplied: string,
) {
  if (
    !adminConfigured(expected) ||
    supplied.length < 16 ||
    supplied.length > 256
  )
    return false;
  const digest = (value: string) =>
    crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  const [a, b] = await Promise.all([digest(expected ?? ""), digest(supplied)]);
  const left = new Uint8Array(a),
    right = new Uint8Array(b);
  let difference = 0;
  for (let i = 0; i < left.length; i++)
    difference |= (left[i] ?? 0) ^ (right[i] ?? 0);
  return difference === 0;
}

export function returnPath(value: string | undefined) {
  if (!value || value.length > 4096 || !value.startsWith("/authorize?"))
    return "/account";
  const url = new URL(value, "https://internal.test");
  return url.origin === "https://internal.test" && url.pathname === "/authorize"
    ? url.pathname + url.search
    : "/account";
}

export const token = () => crypto.randomUUID() + crypto.randomUUID();

export function createAuthService(
  repository: ReturnType<typeof createAuthRepository>,
  version: string,
  now: () => number = Date.now,
) {
  return {
    async readSession(id: string) {
      if (id.length > 100) return null;
      const session = await repository.session(id, now());
      return session?.auth_version === version ? session : null;
    },
    async createSession(prior?: string) {
      const id = token();
      await repository.saveSession({
        id,
        csrf: token(),
        expires: now() + 28800000,
        version,
        ...(prior === undefined ? {} : { prior }),
      });
      return id;
    },
    allowLoginAttempt: () => repository.allowLoginAttempt(now()),
    revokeSession: (id: string) => repository.revokeSession(id),
  };
}
