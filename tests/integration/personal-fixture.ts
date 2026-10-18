import { getOAuthApi } from "@cloudflare/workers-oauth-provider";
import { z } from "zod/v4";

import { AccountResponseSchema } from "@/contracts/portal-contract";
import { oauth } from "@/worker/auth/controller";
import type { Bindings } from "@/worker/bindings";

import { createExecutionContext } from "cloudflare:test";
import { env as bindings } from "cloudflare:workers";

const csrfInputPattern = /name="csrf" value="([^"]+)"/;

export const origin = "https://caderninho.test";
export const password = "synthetic-personal-password";
export function settings(): Bindings {
  const config: Omit<Bindings, "OAUTH_PROVIDER"> = {
    ADMIN_PASSWORD: password,
    CF_VERSION_METADATA: {
      id: "synthetic-version",
      tag: "test",
      timestamp: "2026-10-17T12:00:00Z",
    },
    DB: bindings.DB,
    FINANCE: {
      create({ id }) {
        return Promise.resolve({
          id,
          status() {
            return Promise.resolve({ status: "running" });
          },
        });
      },
      get(id) {
        return Promise.resolve({
          id,
          status() {
            return Promise.resolve({ status: "running" });
          },
        });
      },
    },
    OAUTH_KV: bindings.OAUTH_KV,
    PLUGGY_CLIENT_ID: "synthetic-client",
    PLUGGY_CLIENT_SECRET: "synthetic-secret",
  };
  return {
    ...config,
    OAUTH_PROVIDER: getOAuthApi(
      {
        apiHandler: { fetch: () => new Response("synthetic MCP") },
        apiRoute: "/mcp",
        authorizeEndpoint: "/authorize",
        defaultHandler: { fetch: () => new Response("synthetic portal") },
        resourceMetadata: {
          authorization_servers: [origin],
          resource: `${origin}/mcp`,
        },
        tokenEndpoint: "/oauth/token",
      },
      config,
    ),
  };
}
export function fixture(config = settings()) {
  const provider = oauth(async () => new Response("verified"), origin);
  return {
    config,
    request: (path: string, init?: RequestInit) =>
      provider.fetch(
        new Request(origin + path, init),
        config,
        createExecutionContext(),
      ),
  };
}
export function cookies(response: Response) {
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .join("; ");
}
export async function login(
  app: ReturnType<typeof fixture>,
  supplied = password,
) {
  const page = await app.request("/account/login");
  const csrf = z
    .string()
    .parse((await page.text()).match(csrfInputPattern)?.[1]);
  return app.request("/account/login", {
    body: new URLSearchParams({ csrf, password: supplied }),
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: cookies(page),
      Origin: origin,
    },
    method: "POST",
  });
}
export async function command(
  app: ReturnType<typeof fixture>,
  cookie: string,
  action: string,
  fields: Record<string, string> = {},
) {
  const state = AccountResponseSchema.parse(
    await (
      await app.request("/api/account", { headers: { Cookie: cookie } })
    ).json(),
  );
  return app.request(`/api/account/${action}`, {
    body: JSON.stringify({ csrf: state.csrf, ...fields }),
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
      Origin: origin,
    },
    method: "POST",
  });
}
