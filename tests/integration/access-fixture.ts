import { getOAuthApi } from "@cloudflare/workers-oauth-provider";
import { z } from "zod/v4";

import { PortalResponseSchema } from "../../src/contracts";
import worker from "../../src/worker";
import type { Bindings } from "../../src/worker/bindings";
import { required } from "../support";
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
    LOGIN_LIMITER: { limit: async () => ({ success: true }) },
    OAUTH_KV: bindings.OAUTH_KV,
    PLUGGY_CLIENT_ID: "synthetic-client",
    PLUGGY_CLIENT_SECRET: "synthetic-secret",
    RULES: {
      create({ id }) {
        return Promise.resolve({
          id,
          status() {
            return Promise.resolve({ status: "queued" });
          },
        });
      },
    },
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
  return {
    config,
    request: (path: string, init?: RequestInit) =>
      worker.fetch(
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
  trustedIp?: string,
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
      ...(trustedIp && { "CF-Connecting-IP": trustedIp }),
    },
    method: "POST",
  });
}
export async function command(
  app: ReturnType<typeof fixture>,
  cookie: string,
  action: string,
  fields: Record<string, unknown> = {},
) {
  const state = PortalResponseSchema.parse(
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

const consentHandlePattern = /name="handle" value="([^"]+)"/;
export async function grant(
  app: ReturnType<typeof fixture>,
  ownerCookie: string,
  name = "Synthetic assistant",
) {
  const registered = await app.request("/oauth/register", {
    body: JSON.stringify({
      client_name: name,
      grant_types: ["authorization_code", "refresh_token"],
      redirect_uris: ["http://localhost:8123/callback"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });

  const client = z
    .object({ client_id: z.string() })
    .parse(await registered.json());
  const verifier = "a".repeat(64);
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier),
  );
  const challenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replaceAll("=", "")
    .replaceAll("+", "-")
    .replaceAll("/", "_");
  const authorize =
    "/authorize?" +
    new URLSearchParams({
      client_id: client.client_id,
      code_challenge: challenge,
      code_challenge_method: "S256",
      redirect_uri: "http://localhost:8123/callback",
      response_type: "code",
      scope: "offline_access",
      state: "synthetic-state",
    });

  const consent = await app.request(authorize, {
    headers: { Cookie: ownerCookie },
  });

  const html = await consent.text();

  const handle = z.string().parse(html.match(consentHandlePattern)?.[1]);
  const approved = await app.request("/authorize", {
    body: new URLSearchParams({ decision: "approve", handle }),
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: `${ownerCookie}; ${cookies(consent)}`,
      Origin: origin,
    },
    method: "POST",
  });

  const code = required(
    new URL(required(approved.headers.get("Location"))).searchParams.get(
      "code",
    ),
  );
  const response = await app.request("/oauth/token", {
    body: new URLSearchParams({
      client_id: client.client_id,
      code,
      code_verifier: verifier,
      grant_type: "authorization_code",
      redirect_uri: "http://localhost:8123/callback",
    }),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    method: "POST",
  });

  return z.object({ access_token: z.string() }).parse(await response.json())
    .access_token;
}
