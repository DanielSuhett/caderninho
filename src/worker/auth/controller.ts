import { OAuthProvider } from "@cloudflare/workers-oauth-provider";
import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { z } from "zod/v4";

import { tryCatch } from "#shared/result.ts";
import { accessPage } from "#web/access-view.tsx";
import { consentPage } from "#web/consent-view.tsx";
import { renderPage } from "#web/document.tsx";
import { accountRoutes } from "#worker/account/controller.ts";
import {
  adminConfigured,
  returnPath,
  token,
  verifyPassword,
} from "#worker/auth/service.ts";
import {
  cookieOptions,
  createSession,
  type PortalEnv,
  readSession,
} from "#worker/auth/session.ts";
import type { Bindings } from "#worker/bindings.ts";
import { authService } from "#worker/composition.ts";
import { boundedForm, failureStatus, requestOrigin } from "#worker/http.ts";

type McpHandler = (request: Request, env: Bindings) => Promise<Response>;

export function oauth(api: McpHandler, origin: string) {
  const routes = new Hono<{ Bindings: Bindings }>();
  routes.onError((error) => {
    throw error;
  });
  routes.route("/", portalRoutes());
  routes.get("/authorize", async (c) => {
    if (!(await readSession(c))) {
      const url = new URL(c.req.url);
      return c.redirect(
        "/account/login?returnTo=" +
          encodeURIComponent(url.pathname + url.search),
      );
    }
    const request = c.req.raw,
      bindings = c.env,
      helpers = bindings.OAUTH_PROVIDER;
    const auth = await helpers.parseAuthRequest(request),
      details = await helpers.describeConsent(auth),
      consent = await helpers.beginConsent(auth);
    consent.headers.set("Content-Type", "text/html; charset=utf-8");
    consent.headers.set("Referrer-Policy", "same-origin");
    consent.headers.set(
      "Content-Security-Policy",
      "default-src 'none'; font-src 'self'; style-src 'self' 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
    );
    return new Response(renderPage(consentPage(details, consent.handle)), {
      headers: consent.headers,
    });
  });
  routes.post("/authorize", async (c) => {
    const request = c.req.raw,
      bindings = c.env,
      helpers = bindings.OAUTH_PROVIDER;
    if (request.headers.get("Origin") !== origin) {
      return c.text("Origem não autorizada.", 403);
    }
    if (
      !request.headers
        .get("Content-Type")
        ?.startsWith("application/x-www-form-urlencoded")
    ) {
      return c.text("Formato inválido.", 415);
    }
    const session = await readSession(c);
    if (!session) {
      return c.text("Sessão expirada. Reabra a conexão pelo assistente.", 401);
    }
    const form = await boundedForm(request),
      handle = String(form.get("handle"));
    if (form.get("decision") !== "approve") {
      const denied = await helpers.denyConsent(request, handle);
      return new Response(null, { status: 302, headers: denied.headers });
    }
    const approved = await helpers.approveConsent(request, handle);
    const result = await helpers.completeAuthorization({
      request: approved.request,
      userId: "owner",
      metadata: {},
      scope: approved.request.scope,
      props: {},
    });
    approved.headers.set("Location", result.redirectTo);
    return new Response(null, { status: 302, headers: approved.headers });
  });

  const authenticated = new Hono<{ Bindings: Bindings }>();
  authenticated.onError((error) => {
    throw error;
  });
  authenticated.use("*", async (c, next) => {
    const verified = z
      .object({
        props: z.object({}).strict(),
        auth: z.object({ scope: z.array(z.string()) }),
      })
      .parse(c.executionCtx);
    if (!verified.auth.scope.includes("finance")) {
      return c.text("Forbidden", 403);
    }
    await next();
  });
  authenticated.all("/mcp/*", (c) => api(c.req.raw, c.env));
  authenticated.all("/mcp", (c) => api(c.req.raw, c.env));
  return new OAuthProvider<Bindings>({
    apiRoute: "/mcp",
    authorizeEndpoint: "/authorize",
    tokenEndpoint: "/oauth/token",
    clientRegistrationEndpoint: "/oauth/register",
    scopesSupported: ["finance", "offline_access"],
    requiredScopes: ["finance"],
    resourceMetadata: {
      resource: `${origin}/mcp`,
      authorization_servers: [origin],
    },
    apiHandler: {
      fetch: (request, bindings, ctx) =>
        authenticated.fetch(request, bindings, ctx),
    },
    defaultHandler: {
      fetch: (request, bindings, ctx) => routes.fetch(request, bindings, ctx),
    },
  });
}

export async function authenticatedFetch(
  request: Request,
  env: Bindings,
  ctx: ExecutionContext,
  api: McpHandler,
) {
  const result = await tryCatch(
    oauth(api, requestOrigin(request)).fetch(request, env, ctx),
  );
  if (result.error) {
    return Response.json(
      { error: "AUTHENTICATION_OR_REQUEST_FAILED" },
      {
        status: failureStatus(result.error),
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
  return result.data;
}

const loginCookie = "__Host-caderninho-login";

export function loginRoutes() {
  const app = new Hono<PortalEnv>();
  app.get("/account/login", async (c) => {
    const target = returnPath(c.req.query("returnTo"));
    if (await readSession(c)) {
      return c.redirect(target);
    }
    const csrf = token();
    setCookie(c, loginCookie, csrf, { ...cookieOptions, maxAge: 600 });
    const configured = adminConfigured(c.env.ADMIN_PASSWORD);
    return c.html(
      renderPage(
        accessPage({
          origin: requestOrigin(c.req.raw),
          configured: configured,
          csrf: csrf,
          error: "",
          target: target,
        }),
      ),
      configured ? 200 : 503,
    );
  });
  app.post("/account/login", async (c) => {
    if (c.req.header("Origin") !== requestOrigin(c.req.raw)) {
      return c.text("Origem não autorizada.", 403);
    }
    if (
      !c.req
        .header("Content-Type")
        ?.startsWith("application/x-www-form-urlencoded")
    ) {
      return c.text("Formato inválido.", 415);
    }
    if (!adminConfigured(c.env.ADMIN_PASSWORD)) {
      return c.text("Acesso não configurado.", 503);
    }
    const form = await boundedForm(c.req.raw);
    const csrf = getCookie(c, loginCookie);
    if (!csrf || form.get("csrf") !== csrf) {
      return c.text("Atualize a página para entrar novamente.", 403);
    }
    if (!(await authService(c.env).allowLoginAttempt())) {
      c.header("Retry-After", "60");
      return c.html(
        renderPage(
          accessPage({
            origin: requestOrigin(c.req.raw),
            configured: true,
            csrf: csrf,
            error: "Limite de tentativas. Aguarde 60 segundos.",
            target: returnPath(form.get("returnTo") ?? undefined),
          }),
        ),
        429,
      );
    }
    if (
      !(await verifyPassword(c.env.ADMIN_PASSWORD, form.get("password") ?? ""))
    ) {
      return c.html(
        renderPage(
          accessPage({
            origin: requestOrigin(c.req.raw),
            configured: true,
            csrf: csrf,
            error: "Senha inválida.",
            target: returnPath(form.get("returnTo") ?? undefined),
          }),
        ),
        401,
      );
    }
    await createSession(c);
    deleteCookie(c, loginCookie, cookieOptions);
    return c.redirect(returnPath(form.get("returnTo") ?? undefined), 303);
  });
  return app;
}

export function portalRoutes() {
  return accountRoutes(loginRoutes());
}
