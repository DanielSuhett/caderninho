import { Hono } from "hono";
import { deleteCookie, getCookie } from "hono/cookie";
import type { z } from "zod/v4";

import type { AccountResponse } from "../../../contracts";
import {
  AccountActionSchema,
  ConnectTokenActionSchema,
  ItemActionSchema,
  WizardIssue,
} from "../../../contracts";
import { accountPage, renderPage } from "../../../web";
import {
  cookieOptions,
  type PortalEnv,
  sessionCookie,
  sessionMiddleware,
} from "../../auth/session";
import { accountService, authService } from "../../composition";
import { boundedJson, failureStatus, requestOrigin } from "../../http";
import { wizardIssue } from "../entity";

export function accountRoutes(accessRoutes: Hono<PortalEnv>) {
  const app = new Hono<PortalEnv>();
  app.onError((error, c) => {
    if (error.message === "SESSION_REQUIRED") {
      return c.json({ issue: WizardIssue.session }, 403);
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
      return c.json({ issue: WizardIssue.session }, 403);
    }
    if (!c.req.header("Content-Type")?.startsWith("application/json")) {
      return c.json({ issue: WizardIssue.unknown }, 415);
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
  const command = async <T extends { csrf: string }>(
    request: Request,
    csrf: string,
    schema: z.ZodType<T>,
  ) => {
    const parsed = schema.parse(await boundedJson(request, 8192));
    if (parsed.csrf !== csrf) {
      throw new Error("SESSION_REQUIRED");
    }
    return parsed;
  };
  app.post("/api/account/connect-token", async (c) => {
    const input = await command(
      c.req.raw,
      c.get("session").csrf,
      ConnectTokenActionSchema,
    );
    return c.json(await accountService(c.env).token(input.itemId));
  });
  app.post("/api/account/items", async (c) => {
    const input = await command(
      c.req.raw,
      c.get("session").csrf,
      ItemActionSchema,
    );
    await accountService(c.env).connectItem(input.itemId);
    return c.json({ ok: true });
  });
  app.post("/api/account/pause", async (c) => {
    await command(c.req.raw, c.get("session").csrf, AccountActionSchema);
    await accountService(c.env).pause();
    return c.json({ ok: true });
  });
  app.post("/api/account/resume", async (c) => {
    await command(c.req.raw, c.get("session").csrf, AccountActionSchema);
    await accountService(c.env).resume();
    return c.json({ ok: true });
  });
  app.post("/api/account/sync", async (c) => {
    await command(c.req.raw, c.get("session").csrf, AccountActionSchema);
    const queued = await accountService(c.env).requestSync();
    return c.json({ ok: true, queued });
  });
  app.post("/api/account/disconnect-assistants", async (c) => {
    await command(c.req.raw, c.get("session").csrf, AccountActionSchema);
    await accountService(c.env).disconnectAssistants();
    return c.json({ ok: true });
  });
  app.post("/api/account/logout", async (c) => {
    await command(c.req.raw, c.get("session").csrf, AccountActionSchema);
    const id = getCookie(c, sessionCookie);
    if (id) {
      await authService(c.env).revokeSession(id);
    }
    deleteCookie(c, sessionCookie, cookieOptions);
    return c.json({ ok: true });
  });
  return app;
}
