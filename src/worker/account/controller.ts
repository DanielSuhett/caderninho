import { Hono } from "hono";
import { getCookie, deleteCookie } from "hono/cookie";
import { z } from "zod/v4";

import {
  AccountActionSchema,
  AccountResponseSchema,
} from "#contracts/portal-contract.ts";
import { CredentialsSchema } from "#contracts/wizard-contract.ts";
import { tryCatch } from "#shared/result.ts";
import { renderPage } from "#web/document.tsx";
import { accountPage } from "#web/portal-view.tsx";
import { wizardIssue } from "#worker/account/errors.ts";
import { oauthSubject } from "#worker/auth/repository.ts";
import {
  sessionMiddleware,
  cookieOptions,
  sessionCookie as cookie,
  type PortalEnv,
} from "#worker/auth/session.ts";
import { accountService, authService } from "#worker/composition.ts";
import { boundedForm, failureStatus, boundedJson } from "#worker/http.ts";

export function accountRoutes(accessRoutes: Hono<PortalEnv>) {
  const app = new Hono<PortalEnv>();
  app.onError(
    (error) =>
      new Response(
        "Não foi possível concluir. Volte à sua conta e tente novamente.",
        {
          status: failureStatus(error),
          headers: {
            "Cache-Control": "no-store",
            "Content-Type": "text/plain; charset=utf-8",
            "X-Content-Type-Options": "nosniff",
          },
        },
      ),
  );
  app.use("*", async (c, next) => {
    await next();
    c.header("Cache-Control", "no-store");
    c.header("Referrer-Policy", "same-origin");
    c.header("X-Content-Type-Options", "nosniff");
    c.header(
      "Content-Security-Policy",
      "default-src 'none'; font-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; frame-src https://connect.pluggy.ai; img-src 'self' data:; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
    );
  });
  app.get("/", (c) => c.redirect("/account/setup"));
  app.route("/", accessRoutes);
  app.use("/account", sessionMiddleware);
  app.use("/account/*", async (c, next) => {
    if (["/account/login", "/account/access"].includes(c.req.path))
      return next();
    return sessionMiddleware(c, next);
  });
  app.get("/account/setup", (c) => {
    const step = z.coerce
      .number()
      .int()
      .min(1)
      .max(4)
      .safeParse(c.req.query("step"));
    return c.redirect(
      step.success
        ? "/account?mission=" +
            (step.data === 1 ? 2 : step.data) +
            (c.req.query("issue")
              ? "&issue=" + encodeURIComponent(c.req.query("issue") ?? "")
              : "")
        : "/account",
    );
  });
  app.post("/account/wizard/:action", async (c) => {
    const session = c.get("session");
    if (c.req.header("Origin") !== new URL(c.env.PUBLIC_ORIGIN).origin)
      return c.json({ issue: "session" }, 403);
    if (
      !c.req
        .header("Content-Type")
        ?.startsWith("application/x-www-form-urlencoded")
    )
      return c.json({ issue: "unknown" }, 415);
    const form = await boundedForm(c.req.raw);
    if (form.get("csrf") !== session.csrf)
      return c.json({ issue: "session" }, 403);
    const action = c.req.param("action");
    const result = await tryCatch(
      (async () => {
        if (action === "credentials") {
          if (form.get("consent") !== "yes")
            throw new Error("CONSENT_REQUIRED");
          const credentials = CredentialsSchema.safeParse({
            clientId: form.get("clientId"),
            clientSecret: form.get("clientSecret"),
          });
          if (!credentials.success) throw new Error("UPSTREAM_AUTH");
          await accountService(c.env, session.principal).saveCredentials(
            credentials.data,
          );
          return { next: "/account/setup?step=3" };
        }
        if (action === "token") {
          const update = form.get("itemId");
          return accountService(c.env, session.principal).token(
            update ?? undefined,
          );
        }
        if (action === "item") {
          await accountService(c.env, session.principal).connectItem(
            z.string().uuid().parse(form.get("itemId")),
          );
          return { next: "/account/setup?step=4" };
        }
        throw new Error("UNKNOWN_ACTION");
      })(),
    );
    if (result.error) {
      const issue = wizardIssue(result.error);
      if (c.req.header("Accept") === "application/json")
        return c.json(
          { issue },
          issue === "unknown" ? failureStatus(result.error) : 400,
        );
      return c.redirect(
        "/account/setup?step=" +
          (action === "credentials" ? "2" : "3") +
          "&issue=" +
          issue,
        303,
      );
    }
    if (c.req.header("Accept") === "application/json")
      return c.json(result.data);
    return c.redirect(
      action === "credentials"
        ? "/account/setup?step=3"
        : "/account/setup?step=4",
      303,
    );
  });
  app.get("/api/account", sessionMiddleware, async (c) => {
    const session = c.get("session");
    const [data, account] = await Promise.all([
      accountService(c.env, session.principal).playground(
        c.req.query("cursor"),
      ),
      accountService(c.env, session.principal).status(),
    ]);
    return c.json(
      AccountResponseSchema.parse({
        data,
        account,
        csrf: session.csrf,
        origin: c.env.PUBLIC_ORIGIN,
        rotate: Boolean(c.env.CREDENTIAL_PREVIOUS_KEY),
      }),
    );
  });
  app.post("/api/account/*", sessionMiddleware, async (c) => {
    if (c.req.header("Origin") !== new URL(c.env.PUBLIC_ORIGIN).origin)
      return c.json({ issue: "session" }, 403);
    const input = AccountActionSchema.parse(await boundedJson(c.req.raw));
    const action = c.req.path.slice("/api/account/".length);
    if (
      ![
        "wizard/credentials",
        "wizard/token",
        "wizard/item",
        "pause",
        "resume",
        "sync",
        "rotate-key",
        "revoke",
        "logout",
      ].includes(action)
    )
      return c.notFound();
    const url = new URL(c.req.url);
    url.pathname = "/account/" + action;
    const headers = new Headers(c.req.raw.headers);
    headers.set("Content-Type", "application/x-www-form-urlencoded");
    headers.set("Accept", "application/json");
    headers.delete("Content-Length");
    const response = await app.fetch(
      new Request(url, {
        method: "POST",
        headers,
        body: new URLSearchParams({ ...input.fields, csrf: input.csrf }),
      }),
      c.env,
    );
    if (response.status >= 300 && response.status < 400) {
      const result = c.json({ ok: true });
      const cookie = response.headers.get("Set-Cookie");
      if (cookie) result.headers.set("Set-Cookie", cookie);
      return result;
    }
    return response;
  });
  app.get("/account", (c) => c.html(renderPage(accountPage())));
  app.post("/account/:action", async (c) => {
    const session = c.get("session");
    if (c.req.header("Origin") !== new URL(c.env.PUBLIC_ORIGIN).origin)
      return c.text("Origem não autorizada.", 403);
    if (
      !c.req
        .header("Content-Type")
        ?.startsWith("application/x-www-form-urlencoded")
    )
      return c.text("Formato inválido.", 415);
    // Bound the stream before parsing; Content-Length alone is client-controlled.
    const body = await boundedForm(c.req.raw);
    if (body.get("csrf") !== session.csrf)
      return c.text("Sessão inválida. Atualize a página.", 403);
    const action = c.req.param("action");
    if (action === "revoke") {
      const grant = z.string().min(1).max(256).parse(body.get("grantId"));
      await c.env.OAUTH_PROVIDER.revokeGrant(
        grant,
        oauthSubject(session.principal),
      );
      return c.redirect("/account?mission=5", 303);
    }
    if (action === "logout") {
      const id = getCookie(c, cookie);
      if (id) await authService(c.env).revokeSession(id);
      deleteCookie(c, cookie, cookieOptions);
      return c.redirect("/", 303);
    }
    if (action === "pause") {
      await accountService(c.env, session.principal).pause();
      return c.redirect("/account?notice=paused", 303);
    }
    if (action === "resume") {
      await accountService(c.env, session.principal).resume();
      return c.redirect("/account?notice=resumed", 303);
    }
    if (action === "rotate-key") {
      const rotated = await tryCatch(
        accountService(c.env, session.principal).rotate(),
      );
      if (rotated.error)
        return c.text(
          "Não foi possível concluir a troca. Preserve as duas chaves e o backup, confira a configuração e tente novamente. Nenhum histórico foi removido.",
          400,
        );
      return c.redirect("/account?notice=rotated", 303);
    }
    if (action === "sync") {
      const requested = await accountService(
        c.env,
        session.principal,
      ).requestSync();
      return c.redirect(
        "/account?notice=" + (requested ? "queued" : "waiting"),
        303,
      );
    }
    return c.notFound();
  });
  return app;
}
