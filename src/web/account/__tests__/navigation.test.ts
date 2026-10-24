import assert from "node:assert/strict";
import test from "node:test";

import { isWorkspaceUrl } from "../account-navigation";
import { createReadCache } from "../read-cache";

await test("navigation only handles internal workspace destinations, retaining native auth and anchor navigation", () => {
  const current = new URL("https://example.test/account");
  assert.equal(
    isWorkspaceUrl(
      new URL("/account/transactions?person=ana&cursor=page2", current),
      current,
    ),
    true,
  );
  for (const destination of [
    "https://other.test/account",
    "/account/login",
    "/account/logout",
    "/account/unknown",
    "/api/account",
    "/account#workspace-content",
    "/",
  ]) {
    assert.equal(
      isWorkspaceUrl(new URL(destination, current), current),
      false,
      destination,
    );
  }
});

await test("demo navigation keeps GET filters client-side without crossing the public and private shells", () => {
  const current = new URL("https://example.test/demo?month=2026-10");
  for (const path of [
    "/demo?month=2026-09&currency=USD",
    "/demo/",
    "/demo/transactions?month=2026-10&text=mercado",
    "/demo/transactions/?month=2026-10&accountId=checking",
  ]) {
    assert.equal(isWorkspaceUrl(new URL(path, current), current), true, path);
  }
  for (const path of [
    "/account",
    "/account/login",
    "/",
    "/demo#install-title",
  ]) {
    assert.equal(isWorkspaceUrl(new URL(path, current), current), false, path);
  }
  assert.equal(
    isWorkspaceUrl(new URL("/demo", current), new URL("/account", current)),
    false,
  );
});

await test("read cache separates filters, expires after ten seconds and explicit refresh bypasses it", async () => {
  let clock = 0;
  let calls = 0;
  const cache = createReadCache(() => clock);
  const load = () => {
    calls += 1;
    return Promise.resolve(calls);
  };
  assert.equal(await cache.read("ana:personal", load), 1);
  assert.equal(await cache.read("ana:personal", load), 1);
  assert.equal(await cache.read("bruno:personal", load), 2);
  assert.equal(await cache.read("ana:family", load), 3);
  clock = 9999;
  assert.equal(await cache.read("ana:personal", load), 1);
  clock = 10_000;
  assert.equal(await cache.read("ana:personal", load), 4);
  assert.equal(await cache.read("ana:personal", load, true), 5);
  assert.equal(await cache.read("ana:personal", load), 5);
});

await test("cache invalidation prevents an older in-flight read from repopulating data after mutation", async () => {
  const cache = createReadCache();
  let finish: ((value: unknown) => void) | undefined;
  const old = cache.read(
    "accounts",
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  cache.clear();
  finish?.("before mutation");
  await old;
  assert.equal(
    await cache.read("accounts", () => Promise.resolve("after mutation")),
    "after mutation",
  );
  cache.clear();
  assert.equal(
    await cache.read("accounts", () => Promise.resolve("new session")),
    "new session",
  );
});

await test("read cache does not retain failures and bounds retained queries to twenty", async () => {
  const cache = createReadCache();
  await assert.rejects(
    cache.read("failed", () => Promise.reject(new Error("offline"))),
    { message: "offline" },
  );
  assert.equal(
    await cache.read("failed", () => Promise.resolve("recovered")),
    "recovered",
  );
  await Promise.all(
    Array.from({ length: 21 }, (_, index) =>
      cache.read(String(index), () => Promise.resolve(index)),
    ),
  );
  assert.equal(
    await cache.read("0", () => Promise.resolve("evicted")),
    "evicted",
  );
  assert.equal(await cache.read("20", () => Promise.resolve("unexpected")), 20);
});
