import assert from "node:assert/strict";

import { afterEach, test, vi } from "vitest";
import { z } from "zod/v4";

import { sourceUrl } from "#testing/helpers.ts";
import { mockNetwork, syntheticJwt } from "#testing/network.ts";
import { githubIdentity } from "#worker/auth/github.adapter.ts";
import type { Bindings } from "#worker/bindings.ts";

afterEach(() => vi.unstubAllGlobals());
const settings = {
  GITHUB_CLIENT_ID: "synthetic-id",
  GITHUB_CLIENT_SECRET: "synthetic-secret",
  PUBLIC_ORIGIN: "https://caderninho.test",
} as Bindings;
test("Ky GitHub OAuth preserves PKCE form, authorization and identity", async () => {
  let calls = 0;
  mockNetwork(async (input, init) => {
    calls++;
    if (
      sourceUrl(input).href === "https://github.com/login/oauth/access_token"
    ) {
      const form = new URLSearchParams(z.string().parse(init?.body));
      assert.equal(form.get("code_verifier"), "synthetic-verifier");
      assert.equal(
        form.get("redirect_uri"),
        "https://caderninho.test/callback",
      );
      return Response.json({ access_token: syntheticJwt() });
    }
    assert.equal(sourceUrl(input).href, "https://api.github.com/user");
    assert.equal(
      new Headers(init?.headers).get("Authorization"),
      "Bearer " + syntheticJwt(),
    );
    return Response.json({ id: 123 });
  });
  assert.equal(
    await githubIdentity(settings, "synthetic-code", "synthetic-verifier"),
    "github:123",
  );
  assert.equal(calls, 2);
});
test("Ky OAuth failure keeps its public message and never retries", async () => {
  for (const status of [302, 503]) {
    let calls = 0;
    mockNetwork(async () => {
      calls++;
      return new Response("private", {
        status,
        headers: { Location: "https://private.invalid" },
      });
    });
    await assert.rejects(
      githubIdentity(settings, "synthetic-code", "synthetic-verifier"),
      /UPSTREAM_AUTH_UNAVAILABLE/,
    );
    assert.equal(calls, 1);
  }
});
