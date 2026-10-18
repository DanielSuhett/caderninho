import { Hono } from "hono";
import { deleteCookie, getCookie } from "hono/cookie";

import {
  AccountActionSchema,
  type AccountResponse,
  ConnectTokenActionSchema,
  ItemActionSchema,
} from "#contracts/portal-contract.ts";
import { renderPage } from "#web/document.tsx";
import { accountPage } from "#web/portal-view.tsx";
import { wizardIssue } from "#worker/account/errors.ts";
import {
  cookieOptions,
  type PortalEnv,
  sessionCookie,
  sessionMiddleware,
} from "#worker/auth/session.ts";
import { accountService, authService } from "#worker/composition.ts";
import { boundedJson, failureStatus, requestOrigin } from "#worker/http.ts";

export function accountRoutes(accessRoutes: Hono<PortalEnv>) {
  const app = new Hono<PortalEnv>();
  app.onError((error, c) => {
    if (error.message === "SESSION_REQUIRED") {
      return c.json({ issue: "session" }, 403);
    }
    if (c.req.path.startsWith("/api/")) {
      return c.json({ issue: wizardIssue(error) }, failureStatus(error));
    }
    return c.text(
      "Não foi possível concluir. Volte ao seu painel e tente novamente.",
      failureStatus(error),
    );
  });
  app.use("*", async (c, next) => {
    requestOrigin(c.req.raw);
    await next();
    c.header("Cache-Control", "no-store");
    c.header("Referrer-Policy", "same-origin");
    c.header("X-Content-Type-Options", "nosniff");
    c.header(
      "Content-Security-Policy",
      "default-src 'none'; font-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; frame-src https://connect.pluggy.ai; img-src 'self' data:; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
    );
  });
  app.route("/", accessRoutes);
  app.use("/account", sessionMiddleware);
  app.use("/api/account", sessionMiddleware);
  app.use("/api/account/*", sessionMiddleware);
  app.use("/api/account/*", async (c, next) => {
    if (c.req.method !== "POST") {
      return next();
    }
    if (c.req.header("Origin") !== requestOrigin(c.req.raw)) {
      return c.json({ issue: "session" }, 403);
    }
    if (!c.req.header("Content-Type")?.startsWith("application/json")) {
      return c.json({ issue: "unknown" }, 415);
    }
    await next();
  });
  app.get("/account", (c) => c.html(renderPage(accountPage())));
  app.get("/api/account", async (c) =>
    c.json({
      ...(await accountService(c.env).state()),
      csrf: c.get("session").csrf,
      origin: requestOrigin(c.req.raw),
    } satisfies AccountResponse),
  );
  const command = async (request: Request, csrf: string) => {
    const input = await boundedJson(request, 8192);
    const parsed = AccountActionSchema.loose().parse(input);
    if (parsed.csrf !== csrf) {
      throw new Error("SESSION_REQUIRED");
    }
    return input;
  };
  app.post("/api/account/connect-token", async (c) => {
    const input = ConnectTokenActionSchema.parse(
      await command(c.req.raw, c.get("session").csrf),
    );
    return c.json(await accountService(c.env).token(input.itemId));
  });
  app.post("/api/account/items", async (c) => {
    const input = ItemActionSchema.parse(
      await command(c.req.raw, c.get("session").csrf),
    );
    await accountService(c.env).connectItem(input.itemId);
    return c.json({ ok: true });
  });
  app.post("/api/account/pause", async (c) => {
    AccountActionSchema.parse(await command(c.req.raw, c.get("session").csrf));
    await accountService(c.env).pause();
    return c.json({ ok: true });
  });
  app.post("/api/account/resume", async (c) => {
    AccountActionSchema.parse(await command(c.req.raw, c.get("session").csrf));
    await accountService(c.env).resume();
    return c.json({ ok: true });
  });
  app.post("/api/account/sync", async (c) => {
    AccountActionSchema.parse(await command(c.req.raw, c.get("session").csrf));
    const queued = await accountService(c.env).requestSync();
    return c.json({ ok: true, queued });
  });
  app.post("/api/account/disconnect-assistants", async (c) => {
    AccountActionSchema.parse(await command(c.req.raw, c.get("session").csrf));
    const grants: string[] = [];
    let cursor: string | undefined;
    do {
      const page = await c.env.OAUTH_PROVIDER.listUserGrants("owner", {
        limit: 20,
        ...(cursor === undefined ? {} : { cursor }),
      });
      grants.push(...page.items.map((grant) => grant.id));
      cursor = page.cursor;
    } while (cursor);
    for (const grant of grants) {
      await c.env.OAUTH_PROVIDER.revokeGrant(grant, "owner");
    }
    return c.json({ ok: true });
  });
  app.post("/api/account/logout", async (c) => {
    AccountActionSchema.parse(await command(c.req.raw, c.get("session").csrf));
    const id = getCookie(c, sessionCookie);
    if (id) {
      await authService(c.env).revokeSession(id);
    }
    deleteCookie(c, sessionCookie, cookieOptions);
    return c.json({ ok: true });
  });
  return app;
}
