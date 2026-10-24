import assert from "node:assert/strict";
import test from "node:test";

import { HttpRequestError } from "../../../shared";
import { createAccountApi } from "../account-api";
import {
  AccountRequestError,
  accountFailureMessage,
} from "../account-feedback";

await test("credential rejection exposes only the allowlisted cause and never retries a setup write", async () => {
  let calls = 0;
  const api = createAccountApi("https://synthetic.test", () => {
    calls += 1;
    return Promise.resolve(
      new Response("private-upstream-body", {
        headers: { "X-Caderninho-Error": "UPSTREAM_AUTH" },
        status: 400,
      }),
    );
  });
  await assert.rejects(
    api.manage(
      {
        action: "create_profile",
        clientId: "synthetic-client",
        clientSecret: "synthetic-secret",
        csrf: "synthetic-csrf",
        name: "Pluggy Ana",
        person: { name: "Ana" },
      },
      new AbortController().signal,
    ),
    (error) => {
      assert.ok(error instanceof AccountRequestError);
      assert.equal(error.code, "UPSTREAM_AUTH");
      assert.ok(
        accountFailureMessage(error).includes("Client ID e o Client Secret"),
      );
      assert.equal(error.message.includes("private-upstream-body"), false);
      return true;
    },
  );
  assert.equal(calls, 1);
  const untrusted = createAccountApi(
    "https://synthetic.test",
    async () =>
      new Response("private-body", {
        headers: { "X-Caderninho-Error": "private-secret" },
        status: 400,
      }),
  );
  await assert.rejects(
    untrusted.command("sync", "csrf", new AbortController().signal),
    (error) =>
      error instanceof HttpRequestError && !error.message.includes("private"),
  );
});

await test("panel commands preserve CSRF and never retry after an uncertain write", async () => {
  const requests: Request[] = [];
  const api = createAccountApi("https://synthetic.test", (input) => {
    requests.push(new Request(input));
    return Promise.resolve(Response.json({ ok: true }));
  });
  const { signal } = new AbortController();
  await api.command("items", "synthetic-csrf", signal, {
    itemId: "synthetic-item",
  });
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
