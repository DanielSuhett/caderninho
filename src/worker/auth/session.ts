import type { Context, Next } from "hono";
import { getCookie, setCookie } from "hono/cookie";

import type { PortalSession } from "#worker/auth/repository.ts";
import type { Bindings } from "#worker/bindings.ts";
import { authService } from "#worker/composition.ts";

export const sessionCookie = "__Host-caderninho";
export const cookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: "Lax",
  path: "/",
} as const;
export type PortalEnv = {
  Bindings: Bindings;
  Variables: { session: PortalSession };
};

export async function readSession<E extends { Bindings: Bindings }>(
  c: Context<E>,
) {
  const id = getCookie(c, sessionCookie);
  return id ? authService(c.env).readSession(id) : null;
}
export async function createSession<E extends { Bindings: Bindings }>(
  c: Context<E>,
  principal: string,
  version = "",
) {
  const id = await authService(c.env).createSession(
    principal,
    version,
    getCookie(c, sessionCookie),
  );
  setCookie(c, sessionCookie, id, { ...cookieOptions, maxAge: 28800 });
}
export async function sessionMiddleware(c: Context<PortalEnv>, next: Next) {
  const session = await readSession(c);
  if (!session)
    return c.req.path.startsWith("/api/")
      ? c.json({ issue: "session" }, 401)
      : c.redirect("/account/login");
  c.set("session", session);
  await next();
}
