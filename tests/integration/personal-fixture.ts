import { getOAuthApi } from "@cloudflare/workers-oauth-provider";
import { z } from "zod/v4";

import { AccountResponseSchema } from "#contracts/portal-contract.ts";
import { oauth } from "#worker/auth/controller.ts";
import type { Bindings } from "#worker/bindings.ts";

import { createExecutionContext } from "cloudflare:test";
import { env as bindings } from "cloudflare:workers";

export const origin = "https://caderninho.test";
export const password = "synthetic-personal-password";
export function settings() {
  const config: Omit<Bindings, "OAUTH_PROVIDER"> = {
    DB: bindings.DB,
    OAUTH_KV: bindings.OAUTH_KV,
    CF_VERSION_METADATA: {
      id: "synthetic-version",
      tag: "test",
      timestamp: "2026-10-17T12:00:00Z",
    },
    ADMIN_PASSWORD: password,
    PLUGGY_CLIENT_ID: "synthetic-client",
    PLUGGY_CLIENT_SECRET: "synthetic-secret",
    FINANCE: {
      async create({ id }) {
        return {
          id,
          async status() {
            return { status: "running" };
          },
        };
      },
      async get(id) {
        return {
          id,
          async status() {
            return { status: "running" };
          },
        };
      },
    },
  };
  return {
    ...config,
    OAUTH_PROVIDER: getOAuthApi(
      {
        apiRoute: "/mcp",
        resourceMetadata: {
          resource: `${origin}/mcp`,
          authorization_servers: [origin],
        },
        authorizeEndpoint: "/authorize",
        tokenEndpoint: "/oauth/token",
        apiHandler: { fetch: () => new Response("synthetic MCP") },
        defaultHandler: { fetch: () => new Response("synthetic portal") },
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
    .parse((await page.text()).match(/name="csrf" value="([^"]+)"/)?.[1]);
  return app.request("/account/login", {
    method: "POST",
    headers: {
      Cookie: cookies(page),
      Origin: origin,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ csrf, password: supplied }),
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
    method: "POST",
    headers: {
      Cookie: cookie,
      Origin: origin,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ csrf: state.csrf, ...fields }),
  });
}
