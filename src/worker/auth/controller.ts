import { OAuthProvider } from "@cloudflare/workers-oauth-provider";
import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";

import { tryCatch } from "@/shared/result";
import { accessPage } from "@/web/access-view";
import { consentPage } from "@/web/consent-view";
import { renderPage } from "@/web/document";
import { accountRoutes } from "@/worker/account/controller";

import type { Bindings } from "../bindings";
import { authService } from "../composition";
import { boundedForm, failureStatus, requestOrigin } from "../http";
import { adminConfigured, returnPath, token, verifyPassword } from "./service";
import {
  cookieOptions,
  createSession,
  type PortalEnv,
  readSession,
} from "./session";

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
    const { raw: request } = c.req,
      { env: bindings } = c,
      { OAUTH_PROVIDER: helpers } = bindings;
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
    const { raw: request } = c.req,
      { env: bindings } = c,
      { OAUTH_PROVIDER: helpers } = bindings;
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
      return new Response(null, { headers: denied.headers, status: 302 });
    }
    const approved = await helpers.approveConsent(request, handle);
    const result = await helpers.completeAuthorization({
      metadata: {},
      props: {},
      request: approved.request,
      scope: approved.request.scope,
      userId: "owner",
    });
    approved.headers.set("Location", result.redirectTo);
    return new Response(null, { headers: approved.headers, status: 302 });
  });

  return new OAuthProvider<Bindings>({
    apiHandler: {
      fetch: (request, bindings) => api(request, bindings),
    },
    apiRoute: "/mcp",
    authorizeEndpoint: "/authorize",
    clientRegistrationEndpoint: "/oauth/register",
    defaultHandler: {
      fetch: (request, bindings, ctx) => routes.fetch(request, bindings, ctx),
    },
    resourceMetadata: {
      authorization_servers: [origin],
      resource: `${origin}/mcp`,
    },
    scopesSupported: ["offline_access"],
    tokenEndpoint: "/oauth/token",
  });
}

export async function authenticatedFetch(
  request: Request,
  env: Bindings,
  ctx: ExecutionContext,
  api: McpHandler,
) {
  const { data, error } = await tryCatch(() =>
    oauth(api, requestOrigin(request)).fetch(request, env, ctx),
  );
  if (error) {
    return Response.json(
      { error: "AUTHENTICATION_OR_REQUEST_FAILED" },
      {
        headers: { "Cache-Control": "no-store" },
        status: failureStatus(error),
      },
    );
  }
  return data;
}

const loginCookie = "__Host-caderninho-login";

function loginRoutes() {
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
          configured,
          csrf,
          error: "",
          origin: requestOrigin(c.req.raw),
          target,
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
            configured: true,
            csrf,
            error: "Limite de tentativas. Aguarde 60 segundos.",
            origin: requestOrigin(c.req.raw),
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
            configured: true,
            csrf,
            error: "Senha inválida.",
            origin: requestOrigin(c.req.raw),
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

function portalRoutes() {
  return accountRoutes(loginRoutes());
}
