import type { Context, Next } from "hono";
import { getSignedCookie, setSignedCookie } from "hono/cookie";
import { z } from "zod/v4";

import { PortalIssue } from "../../../contracts";
import { hash } from "../../../shared";
import type { Bindings } from "../../bindings";
import type { PortalSession } from "../entity";
import { adminAccess, token } from "../service";

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

const SessionSchema = z.object({
  csrf: z.string().min(1),
  expires: z.number().int().positive(),
}) satisfies z.ZodType<PortalSession>;
const sessionMaxAge = 28_800;

export function configuredAccess<E extends { Bindings: Bindings }>(
  c: Context<E>,
) {
  return adminAccess({
    accessHash: c.env.ADMIN_ACCESS_HASH,
    password: c.env.ADMIN_PASSWORD,
  });
}

function signingSecret<E extends { Bindings: Bindings }>(c: Context<E>) {
  return hash({
    password: configuredAccess(c)?.secret,
    purpose: sessionCookie,
    version: c.env.CF_VERSION_METADATA.id,
  });
}

export async function readSession<E extends { Bindings: Bindings }>(
  c: Context<E>,
) {
  if (!configuredAccess(c)) {
    return null;
  }
  const value = await getSignedCookie(c, await signingSecret(c), sessionCookie);
  if (!value) {
    return null;
  }
  try {
    const session = SessionSchema.safeParse(JSON.parse(value));
    if (!session.success || session.data.expires <= Date.now()) {
      return null;
    }
    return session.data;
  } catch {
    return null;
  }
}
export async function createSession<E extends { Bindings: Bindings }>(
  c: Context<E>,
) {
  const session: PortalSession = {
    csrf: token(),
    expires: Date.now() + sessionMaxAge * 1000,
  };
  await setSignedCookie(
    c,
    sessionCookie,
    JSON.stringify(session),
    await signingSecret(c),
    { ...cookieOptions, maxAge: sessionMaxAge },
  );
}
export async function sessionMiddleware(c: Context<PortalEnv>, next: Next) {
  const session = await readSession(c);
  if (!session) {
    return c.req.path.startsWith("/api/")
      ? c.json({ issue: PortalIssue.session }, 401)
      : c.redirect("/account/login");
  }
  c.set("session", session);
  await next();
}
