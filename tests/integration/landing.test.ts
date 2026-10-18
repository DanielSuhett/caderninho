import assert from "node:assert/strict";

import { test } from "vitest";

import type { Bindings } from "#worker/bindings.ts";
import worker from "#worker/index.ts";

test("public landing serves pre-rendered assets without authentication or storage", async () => {
  let requested = "";
  const response = await worker.fetch(new Request("https://caderninho.test/"), {
    ASSETS: {
      async fetch(request: Request) {
        requested = request.url;
        return new Response("synthetic pre-rendered landing", {
          headers: { "content-type": "text/html" },
        });
      },
    },
  } as Bindings);
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
