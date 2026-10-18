import assert from "node:assert/strict";

import { test } from "vitest";

import worker from "#worker/index.ts";

import { settings } from "./personal-fixture.ts";
import { createExecutionContext } from "cloudflare:test";

test("public landing serves pre-rendered assets without authentication or storage", async () => {
  let requested = "";
  const response = await worker.fetch(
    new Request("https://caderninho.test/"),
    {
      ...settings(),
      ASSETS: {
        connect() {
          throw new Error("Unexpected asset socket connection");
        },
        async fetch(request: Request) {
          requested = request.url;
          return new Response("synthetic pre-rendered landing", {
            headers: { "content-type": "text/html" },
          });
        },
      },
    },
    createExecutionContext(),
  );
  assert.equal(requested, "https://caderninho.test/");
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("location"), null);
  assert.equal(response.headers.get("set-cookie"), null);
  assert.match(
    response.headers.get("content-security-policy") ?? "",
    /default-src 'none'/,
  );
  assert.equal(await response.text(), "synthetic pre-rendered landing");
});
