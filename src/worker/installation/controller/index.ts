import { Hono } from "hono";
import { deleteCookie } from "hono/cookie";
import type { z } from "zod/v4";

import {
  AccountActionSchema,
  CatalogSelectionSchema,
  ConnectTokenActionSchema,
  HouseholdCommandSchema,
  ItemActionSchema,
  PortalQuerySchema,
  SyncActionSchema,
  SyncHistorySelectionSchema,
} from "../../../contracts";
import { accountPage, renderPage } from "../../../web";
import { revokeAssistantGrants } from "../../auth/grants";
import {
  cookieOptions,
  type PortalEnv,
  sessionCookie,
  sessionMiddleware,
} from "../../auth/session";
import {
  householdService,
  installationService,
  planningService,
  synchronizationHistory,
  syncService,
  workspaceCatalog,
} from "../../composition";
import { boundedJson, requestOrigin } from "../../http";

export function installationRoutes(access: Hono<PortalEnv>) {
  const app = new Hono<PortalEnv>();
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
  app.route("/", access);
  app.use("/account", sessionMiddleware);
  app.use("/account/*", sessionMiddleware);
  app.use("/api/account", sessionMiddleware);
  app.use("/api/account/*", sessionMiddleware);
  app.use("/api/account/*", async (c, next) => {
    if (c.req.method !== "POST") {
      return next();
    }
    if (c.req.header("Origin") !== requestOrigin(c.req.raw)) {
      return c.json({ error: "ORIGIN_REQUIRED" }, 403);
    }
    if (!c.req.header("Content-Type")?.startsWith("application/json")) {
      return c.json({ error: "CONTENT_TYPE_REQUIRED" }, 415);
    }
    await next();
  });
  const command = async <T extends { csrf: string }>(
    request: Request,
    csrf: string,
    schema: z.ZodType<T>,
  ) => {
    const input = schema.parse(await boundedJson(request, 8192));
    if (input.csrf !== csrf) {
      throw new Error("SESSION_REQUIRED");
    }
    return input;
  };
  app.get("/account", (c) => c.html(renderPage(accountPage())));
  for (const path of [
    "transactions",
    "rules",
    "groups",
    "sync",
    "connections",
  ]) {
    app.get(`/account/${path}`, (c) => c.html(renderPage(accountPage())));
  }
  app.get("/api/account/catalog", async (c) => {
    const input = CatalogSelectionSchema.parse(c.req.query());
    return c.json(await workspaceCatalog(c.env, input.spaceId));
  });
  app.post("/api/account/query", async (c) => {
    const input = await command(
      c.req.raw,
      c.get("session").csrf,
      PortalQuerySchema,
    );
    return c.json(await planningService(c.env).execute(input.query));
  });
  app.get("/api/account/history", async (c) =>
    c.json(
      await synchronizationHistory(
        c.env,
        SyncHistorySelectionSchema.parse(c.req.query()),
      ),
    ),
  );
  app.get("/api/account", async (c) =>
    c.json({
      ...(await installationService(c.env).state()),
      csrf: c.get("session").csrf,
      origin: requestOrigin(c.req.raw),
    }),
  );
  app.post("/api/account/manage", async (c) => {
    const input = await command(
      c.req.raw,
      c.get("session").csrf,
      HouseholdCommandSchema,
    );
    return c.json(await householdService(c.env).execute(input));
  });
  app.post("/api/account/connect-token", async (c) => {
    const input = await command(
      c.req.raw,
      c.get("session").csrf,
      ConnectTokenActionSchema,
    );
    return c.json(
      await installationService(c.env).token(input.itemId, input.profileId),
    );
  });
  app.post("/api/account/items", async (c) => {
    const input = await command(
      c.req.raw,
      c.get("session").csrf,
      ItemActionSchema,
    );
    await installationService(c.env).connect(input.itemId, input.profileId);
    return c.json({ ok: true });
  });
  app.post("/api/account/sync", async (c) => {
    const input = await command(
      c.req.raw,
      c.get("session").csrf,
      SyncActionSchema,
    );
    const sync = syncService(c.env);
    await sync.recover();
    return c.json(await sync.request(input.connectionIds));
  });
  app.post("/api/account/disconnect-assistants", async (c) => {
    await command(c.req.raw, c.get("session").csrf, AccountActionSchema);
    await revokeAssistantGrants(c.env.OAUTH_PROVIDER);
    return c.json({ ok: true });
  });
  app.post("/api/account/logout", async (c) => {
    await command(c.req.raw, c.get("session").csrf, AccountActionSchema);
    deleteCookie(c, sessionCookie, cookieOptions);
    return c.json({ ok: true });
  });
  return app;
}
