import { OAuthProvider } from "@cloudflare/workers-oauth-provider";
import { Hono } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { z } from "zod/v4";

import { tryCatch } from "#shared/result.ts";
import { accessPage } from "#web/access-view.tsx";
import { consentPage } from "#web/consent-view.tsx";
import { renderPage } from "#web/document.tsx";
import { accountRoutes } from "#worker/account/controller.ts";
import { githubIdentity } from "#worker/auth/github.adapter.ts";
import { oauthSubject, recordMcpReceipt } from "#worker/auth/repository.ts";
import {
  token,
  adminConfigured,
  verifyAdminKey,
  returnPath,
  isOwner,
  pkceChallenge,
  ownerPrincipal,
} from "#worker/auth/service.ts";
import {
  readSession,
  cookieOptions,
  createSession,
  type PortalEnv,
} from "#worker/auth/session.ts";
import type { Bindings } from "#worker/bindings.ts";
import { authService } from "#worker/composition.ts";
import { boundedForm, failureStatus } from "#worker/http.ts";

const Props = z.object({
  principal: z.string(),
  receiptId: z.uuid().optional(),
});

export function oauth(
  env: Bindings,
  api: (
    request: Request,
    env: Bindings,
    principal: string,
  ) => Promise<Response>,
) {
  const origin = new URL(env.PUBLIC_ORIGIN);
  if (origin.protocol !== "https:" && origin.hostname !== "localhost")
    throw new Error("PUBLIC_ORIGIN must use HTTPS");
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
    if (request.headers.get("Origin") !== origin.origin)
      return c.text("Origem não autorizada.", 403);
    if (
      !request.headers
        .get("Content-Type")
        ?.startsWith("application/x-www-form-urlencoded")
    )
      return c.text("Formato inválido.", 415);
    const session = await readSession(c);
    if (!session)
      return c.text("Sessão expirada. Reabra a conexão pelo assistente.", 401);
    const form = await boundedForm(request),
      handle = String(form.get("handle"));
    if (form.get("decision") !== "approve") {
      const denied = await helpers.denyConsent(request, handle);
      return new Response(null, { status: 302, headers: denied.headers });
    }
    const approved = await helpers.approveConsent(request, handle);
    const details = await helpers.describeConsent(approved.request);
    const receiptId = crypto.randomUUID();
    const result = await helpers.completeAuthorization({
      request: approved.request,
      userId: oauthSubject(session.principal),
      metadata: { receiptId, name: details.clientName },
      scope: approved.request.scope,
      props: { principal: session.principal, receiptId },
    });
    approved.headers.set("Location", result.redirectTo);
    return new Response(null, { status: 302, headers: approved.headers });
  });
  routes.get("/callback", async (c) => {
    const request = c.req.raw,
      bindings = c.env,
      helpers = bindings.OAUTH_PROVIDER,
      url = new URL(request.url);
    const resumed = await helpers.finishUpstream(request),
      data = z.object({ verifier: z.string() }).parse(resumed.data),
      code = z.string().min(1).parse(url.searchParams.get("code"));
    const principal = await githubIdentity(bindings, code, data.verifier);
    if (!isOwner(bindings, principal))
      return new Response(
        "Esta instalação é privada. Entre com a conta do proprietário.",
        {
          status: 403,
        },
      );
    if (!(await authService(bindings).principalExists(principal)))
      return new Response("Conta não cadastrada nesta instalação.", {
        status: 403,
        headers: resumed.headers,
      });
    const result = await helpers.completeAuthorization({
      request: resumed.request,
      userId: oauthSubject(principal),
      metadata: {},
      scope: resumed.request.scope,
      props: { principal },
    });
    resumed.headers.set("Location", result.redirectTo);
    return new Response(null, { status: 302, headers: resumed.headers });
  });
  const authenticated = new Hono<{
    Bindings: Bindings;
    Variables: { principal: string };
  }>();
  authenticated.onError((error) => {
    throw error;
  });
  authenticated.use("*", async (c, next) => {
    const verified = z
      .object({
        props: Props,
        auth: z.object({
          scope: z.array(z.string()),
          clientId: z.string().optional(),
        }),
      })
      .parse(c.executionCtx);
    if (!verified.auth.scope.includes("finance"))
      return new Response("Forbidden", { status: 403 });
    const { principal } = verified.props;
    if (!isOwner(c.env, principal))
      return new Response("Forbidden", { status: 403 });
    if (!(await authService(c.env).principalExists(principal)))
      return new Response("Forbidden", { status: 403 });
    c.set("principal", principal);
    await next();
    // Receipt proves a request under this grant, not financial correctness or client branding.
    if (
      c.req.method === "POST" &&
      c.res.ok &&
      verified.props.receiptId &&
      verified.auth.clientId
    ) {
      // Optional evidence must not turn a successful financial read into an error.
      await tryCatch(
        recordMcpReceipt(
          c.env,
          principal,
          verified.props.receiptId,
          verified.auth.clientId,
        ),
      );
    }
  });
  authenticated.all("/mcp/*", (c) => api(c.req.raw, c.env, c.get("principal")));
  authenticated.all("/mcp", (c) => api(c.req.raw, c.env, c.get("principal")));
  return new OAuthProvider<Bindings>({
    apiRoute: "/mcp",
    authorizeEndpoint: "/authorize",
    tokenEndpoint: "/oauth/token",
    clientRegistrationEndpoint: "/oauth/register",
    scopesSupported: ["finance", "offline_access"],
    requiredScopes: ["finance"],
    resourceMetadata: {
      resource: origin.origin + "/mcp",
      authorization_servers: [origin.origin],
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
  api: (
    request: Request,
    env: Bindings,
    principal: string,
  ) => Promise<Response>,
) {
  const result = await tryCatch(oauth(env, api).fetch(request, env, ctx));
  if (result.error)
    return Response.json(
      { error: "AUTHENTICATION_OR_REQUEST_FAILED" },
      {
        status: failureStatus(result.error),
        headers: { "Cache-Control": "no-store" },
      },
    );
  return result.data;
}

const loginCookie = "__Host-caderninho-login";
const returnCookie = "__Host-caderninho-return";

export function loginRoutes() {
  const app = new Hono<PortalEnv>();
  app.get("/account/access", async (c) => {
    const target = returnPath(c.req.query("returnTo"));
    if (await readSession(c)) return c.redirect(target);
    const csrf = token();
    setCookie(c, loginCookie, csrf, { ...cookieOptions, maxAge: 600 });
    return c.html(
      renderPage(
        accessPage(
          c.env.PUBLIC_ORIGIN,
          adminConfigured(c.env),
          Boolean(
            c.env.OWNER_GITHUB_ID &&
            c.env.GITHUB_CLIENT_ID &&
            c.env.GITHUB_CLIENT_SECRET,
          ),
          csrf,
          "",
          target,
        ),
      ),
    );
  });
  app.post("/account/access", async (c) => {
    if (c.req.header("Origin") !== new URL(c.env.PUBLIC_ORIGIN).origin)
      return c.text("Origem não autorizada.", 403);
    if (
      !c.req
        .header("Content-Type")
        ?.startsWith("application/x-www-form-urlencoded")
    )
      return c.text("Formato inválido.", 415);
    const form = await boundedForm(c.req.raw);
    const csrf = getCookie(c, loginCookie);
    if (!csrf || form.get("csrf") !== csrf)
      return c.text("Atualize a página para entrar novamente.", 403);
    if (!(await authService(c.env).allowLoginAttempt())) {
      c.header("Retry-After", "60");
      return c.html(
        renderPage(
          accessPage(
            c.env.PUBLIC_ORIGIN,
            true,
            false,
            csrf,
            "Limite de tentativas. Aguarde 60 segundos e tente novamente.",
            returnPath(form.get("returnTo") ?? undefined),
          ),
        ),
        429,
      );
    }
    const principal = ownerPrincipal(c.env);
    if (!principal || !(await verifyAdminKey(c.env, form.get("key") ?? "")))
      return c.html(
        renderPage(
          accessPage(
            c.env.PUBLIC_ORIGIN,
            adminConfigured(c.env),
            false,
            csrf,
            "Chave inválida ou acesso não configurado. Confira a chave desta instalação.",
            returnPath(form.get("returnTo") ?? undefined),
          ),
        ),
        401,
      );
    await createSession(c, principal, c.env.ADMIN_KEY_SHA256);
    deleteCookie(c, loginCookie, cookieOptions);
    return c.redirect(returnPath(form.get("returnTo") ?? undefined), 303);
  });
  app.get("/account/login", async (c) => {
    const targetPath = returnPath(c.req.query("returnTo"));
    if (adminConfigured(c.env) && c.req.query("method") !== "github")
      return c.redirect(
        "/account/access?returnTo=" + encodeURIComponent(targetPath),
      );
    if (!c.env.OWNER_GITHUB_ID) return c.redirect("/account/access");
    setCookie(c, returnCookie, targetPath, { ...cookieOptions, maxAge: 600 });
    const { state, browser, verifier } = await authService(c.env).beginLogin();
    setCookie(c, loginCookie, browser, { ...cookieOptions, maxAge: 600 });
    const target = new URL("https://github.com/login/oauth/authorize");
    target.search = new URLSearchParams({
      client_id: c.env.GITHUB_CLIENT_ID,
      redirect_uri: new URL("/callback", c.env.PUBLIC_ORIGIN).href,
      state,
      code_challenge: await pkceChallenge(verifier),
      code_challenge_method: "S256",
    }).toString();
    return c.redirect(target.href);
  });
  app.get("/callback", async (c, next) => {
    const state = c.req.query("state") ?? "";
    if (!state.startsWith("portal.")) return next();
    const browser = getCookie(c, loginCookie);
    if (!browser || state.length > 100)
      return c.text("Login expirado. Entre novamente.", 400);
    const pending = await authService(c.env).consumeLogin(state, browser);
    deleteCookie(c, loginCookie, cookieOptions);
    if (!pending) return c.text("Login expirado. Entre novamente.", 400);
    const { verifier } = z.object({ verifier: z.string() }).parse(pending);
    const principal = await githubIdentity(
      c.env,
      z.string().min(1).max(1024).parse(c.req.query("code")),
      verifier,
    );
    if (!isOwner(c.env, principal))
      return c.text(
        "Esta instalação é privada. Entre com o GitHub do proprietário.",
        403,
      );
    await createSession(c, principal);
    const targetPath = returnPath(getCookie(c, returnCookie));
    deleteCookie(c, returnCookie, cookieOptions);
    return c.redirect(targetPath);
  });

  return app;
}

export function portalRoutes() {
  return accountRoutes(loginRoutes());
}
