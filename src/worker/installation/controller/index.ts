import { Hono } from "hono";
import { deleteCookie } from "hono/cookie";
import type { z } from "zod/v4";

import {
  AccountActionSchema,
  AuditSelectionSchema,
  CatalogSelectionSchema,
  ConnectTokenActionSchema,
  HouseholdCommandSchema,
  InstitutionCatalogSelectionSchema,
  ItemActionSchema,
  PortalMutationSchema,
  PortalQuerySchema,
  RevokeGrantSchema,
  RULE_IMPORT_MAX_BYTES,
  RuleJobCommandSchema,
  RuleJobSelectionSchema,
  RulePreviewSchema,
  SyncActionSchema,
  SyncHistorySelectionSchema,
} from "../../../contracts";
import { accountPage, renderPage } from "../../../web";
import {
  assistantGrants,
  revokeAssistantGrant,
  revokeAssistantGrants,
} from "../../auth/grants";
import {
  cookieOptions,
  type PortalEnv,
  sessionCookie,
  sessionMiddleware,
} from "../../auth/session";
import {
  auditRepository,
  householdService,
  installationService,
  institutionCatalog,
  planningService,
  ruleJobService,
  rulePreview,
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
    if (!c.res.headers.has("Content-Security-Policy")) {
      c.header(
        "Content-Security-Policy",
        "default-src 'none'; font-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; frame-src https://connect.pluggy.ai; img-src 'self' data: https://cdn.pluggy.ai/assets/connector-icons/; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
      );
    }
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
    maximum = 32_768,
  ) => {
    const input = schema.parse(await boundedJson(request, maximum));
    if (input.csrf !== csrf) {
      throw new Error("SESSION_REQUIRED");
    }
    return input;
  };
  app.get("/account", (c) => c.html(renderPage(accountPage())));
  for (const path of [
    "cards",
    "transactions",
    "investments",
    "rules",
    "groups",
    "sync",
    "connections",
    "audit",
    "design-system",
  ]) {
    app.get(`/account/${path}`, (c) => c.html(renderPage(accountPage())));
  }
  app.get("/api/account/audit", async (c) => {
    const input = AuditSelectionSchema.parse(c.req.query());
    const [report, grants] = await Promise.all([
      auditRepository(c.env).report(input.days, new Date()),
      assistantGrants(c.env.OAUTH_PROVIDER, input.grantCursor),
    ]);
    return c.json({ ...report, ...grants });
  });
  app.post("/api/account/revoke-grant", async (c) => {
    const input = await command(
      c.req.raw,
      c.get("session").csrf,
      RevokeGrantSchema,
    );
    await revokeAssistantGrant(c.env.OAUTH_PROVIDER, input.grantId);
    return c.json({ ok: true });
  });
  app.get("/api/account/institutions", async (c) => {
    InstitutionCatalogSelectionSchema.parse(c.req.query());
    return c.json({ records: await institutionCatalog() });
  });
  app.get("/api/account/catalog", async (c) => {
    const input = CatalogSelectionSchema.parse(c.req.query());
    return c.json(await workspaceCatalog(c.env, input.spaceId));
  });
  app.post("/api/account/query", async (c) => {
    const input = await command(
      c.req.raw,
      c.get("session").csrf,
      PortalQuerySchema,
      RULE_IMPORT_MAX_BYTES + 16_384,
    );
    const service = planningService(c.env);
    if (input.query.tool === "get_portal_cards") {
      return c.json(await service.cards(input.query));
    }
    if (input.query.tool === "get_portal_transactions") {
      return c.json(await service.portalTransactions(input.query));
    }
    if (
      input.query.tool === "get_overview" ||
      input.query.tool === "generate_chart" ||
      input.query.tool === "get_investments"
    ) {
      return c.json(
        await service.execute(input.query, {
          cardBrand: input.query.cardBrand,
          institutionId: input.query.institutionId,
        }),
      );
    }
    return c.json(await service.execute(input.query));
  });
  app.post("/api/account/planning", async (c) => {
    const input = await command(
      c.req.raw,
      c.get("session").csrf,
      PortalMutationSchema,
      RULE_IMPORT_MAX_BYTES + 16_384,
    );
    return c.json(await planningService(c.env).execute(input.command));
  });
  app.get("/api/account/rule-jobs", async (c) => {
    const selection = RuleJobSelectionSchema.parse(c.req.query());
    const service = ruleJobService(c.env);
    const job =
      "id" in selection
        ? await service.read(selection.id)
        : await service.latest(selection.spaceId);
    return c.json({ job });
  });
  // One chunk carries at most RULE_JOB_CHUNK_RULES rules, each bounded by the rule schema.
  app.post("/api/account/rule-jobs", async (c) => {
    const input = await command(
      c.req.raw,
      c.get("session").csrf,
      RuleJobCommandSchema,
      2_097_152,
    );
    return c.json({ job: await ruleJobService(c.env).command(input) });
  });
  app.post("/api/account/rule-preview", async (c) => {
    const input = await command(
      c.req.raw,
      c.get("session").csrf,
      RulePreviewSchema,
      RULE_IMPORT_MAX_BYTES,
    );
    return c.json(await rulePreview(c.env, input));
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
    const id = await installationService(c.env).connect(
      input.itemId,
      input.profileId,
    );
    if (!input.deferImport) {
      await syncService(c.env).request([id], true);
    }
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
