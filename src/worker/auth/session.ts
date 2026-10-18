import type { Context, Next } from "hono";
import { getCookie, setCookie } from "hono/cookie";

import { WizardIssue } from "@/contracts/wizard.types";

import type { Bindings } from "../bindings";
import { authService } from "../composition";
import type { PortalSession } from "./entity";

export const sessionCookie = "__Host-caderninho";
export const cookieOptions = {
  httpOnly: true,
  path: "/",
  sameSite: "Lax",
  secure: true,
} as const;
export interface PortalEnv {
  Bindings: Bindings;
  Variables: { session: PortalSession };
}

export async function readSession<E extends { Bindings: Bindings }>(
  c: Context<E>,
) {
  const id = getCookie(c, sessionCookie);
  return await (id ? authService(c.env).readSession(id) : null);
}
export async function createSession<E extends { Bindings: Bindings }>(
  c: Context<E>,
) {
  const id = await authService(c.env).createSession(
    getCookie(c, sessionCookie),
  );
  setCookie(c, sessionCookie, id, { ...cookieOptions, maxAge: 28_800 });
}
export async function sessionMiddleware(c: Context<PortalEnv>, next: Next) {
  const session = await readSession(c);
  if (!session) {
    return c.req.path.startsWith("/api/")
      ? c.json({ issue: WizardIssue.session }, 401)
      : c.redirect("/account/login");
  }
  c.set("session", session);
  await next();
}
