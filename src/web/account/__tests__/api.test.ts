import assert from "node:assert/strict";
import test from "node:test";

import { HttpRequestError } from "../../../shared";
import { createAccountApi } from "../account-api";

await test("panel commands preserve CSRF and never retry after an uncertain write", async () => {
  const requests: Request[] = [];
  const api = createAccountApi("https://synthetic.test", (input) => {
    requests.push(new Request(input));
    return Promise.resolve(Response.json({ ok: true }));
  });
  const { signal } = new AbortController();
  await api.command("items", "synthetic-csrf", signal, "synthetic-item");
  assert.deepEqual(await requests[0]?.json(), {
    csrf: "synthetic-csrf",
    itemId: "synthetic-item",
  });
  assert.equal(requests[0]?.redirect, "manual");
  let calls = 0;
  const uncertain = createAccountApi("https://synthetic.test", () => {
    calls += 1;
    return Promise.reject(new Error("Synthetic response lost"));
  });
  await assert.rejects(uncertain.command("sync", "synthetic-csrf", signal));
  assert.equal(calls, 1);
});
await test("expired/redirected sessions and malformed panel responses never become valid state", async () => {
  const { signal } = new AbortController();
  await Promise.all(
    [401, 403, 302].map(async (status) => {
      const api = createAccountApi(
        "https://synthetic.test",
        async () => new Response("private-body", { status }),
      );
      await assert.rejects(
        api.read(signal),
        (error) =>
          error instanceof HttpRequestError &&
          !error.message.includes("private-body"),
      );
    }),
  );
  await assert.rejects(
    createAccountApi("https://synthetic.test", async () =>
      Response.json({ accounts: [] }),
    ).read(signal),
  );
});
