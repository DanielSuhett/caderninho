import assert from "node:assert/strict";

import { beforeEach, test } from "vitest";

import { generateAdminAccess } from "../../src/worker/auth";
import { cookies, fixture, login, settings } from "./access-fixture";
import { setup } from "./fixture";

const returnToInputPattern = /<input[^>]*name="returnTo"[^>]*>/;

beforeEach(setup);

test("generated access authenticates without a deployment password and never exposes the key or hash", async () => {
  const { ADMIN_PASSWORD: _password, ...config } = settings();
  const access = await generateAdminAccess();
  const app = fixture({ ...config, ADMIN_ACCESS_HASH: access.hash });
  const page = await app.request("/account/login");
  const html = await page.text();
  assert.equal(page.status, 200);
  assert.ok(html.includes("Chave de acesso"));
  assert.ok(html.includes('src="/access.js"'));
  assert.equal(html.includes(access.key), false);
  assert.equal(html.includes(access.hash), false);
  assert.equal((await app.request("/api/account")).status, 401);
  assert.equal((await login(app, access.hash)).status, 401);
  assert.equal(
    (await login(app, (await generateAdminAccess()).key)).status,
    401,
  );
  const entered = await login(app, access.key);
  assert.equal(entered.status, 303);
  const cookie = cookies(entered);
  const state = await app.request("/api/account", {
    headers: { Cookie: cookie },
  });
  const json = await state.text();
  assert.equal(state.status, 200);
  assert.equal(json.includes(access.key), false);
  assert.equal(json.includes(access.hash), false);
  const rotated = fixture({
    ...config,
    ADMIN_ACCESS_HASH: (await generateAdminAccess()).hash,
  });
  assert.equal(
    (await rotated.request("/api/account", { headers: { Cookie: cookie } }))
      .status,
    401,
  );
});

test("existing passwords take precedence and invalid generated configuration fails closed", async () => {
  const access = await generateAdminAccess();
  const app = fixture({ ...settings(), ADMIN_ACCESS_HASH: access.hash });
  assert.equal((await login(app)).status, 303);
  assert.equal((await login(app, access.key)).status, 401);
  const { ADMIN_PASSWORD: _password, ...config } = settings();
  const missing = fixture({ ...config, ADMIN_ACCESS_HASH: "invalid" });
  assert.equal((await missing.request("/account/login")).status, 503);
  assert.equal((await missing.request("/api/account")).status, 401);
});

test("an incomplete installation explains recovery, preserves the assistant return path and stays private", async () => {
  const { ADMIN_PASSWORD: _password, ...config } = settings();
  const app = fixture(config);
  const target = "/authorize?client_id=synthetic-assistant";
  const path = `/account/login?${new URLSearchParams({ returnTo: target })}`;
  const response = await app.request(path);
  const html = await response.text();
  assert.equal(response.status, 503);
  assert.ok(html.includes("A senha não foi configurada"));
  assert.ok(html.includes("ADMIN_PASSWORD"));
  assert.ok(html.includes("16 a 256 caracteres"));
  assert.ok(html.includes("Já configurei a senha"));
  assert.ok(html.includes(`href="${path}"`));
  assert.equal(html.includes("link privado"), false);
  assert.equal(html.includes('action="/account/login"'), false);
  assert.equal((await app.request("/api/account")).status, 401);
  const rejected = await app.request("/account/login", {
    body: new URLSearchParams({ password: "synthetic-new-password" }),
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Origin: "https://caderninho.test",
    },
    method: "POST",
  });
  assert.equal(rejected.status, 503);

  const repaired = fixture({
    ...config,
    ADMIN_PASSWORD: "synthetic-new-password",
  });
  const ready = await repaired.request(path);
  const readyHtml = await ready.text();
  assert.equal(ready.status, 200);
  assert.ok(readyHtml.includes("Continue a autorização"));
  const returnTo = readyHtml.match(returnToInputPattern)?.[0];
  assert.ok(returnTo?.includes(`value="${target}"`));
  assert.equal((await login(repaired, "synthetic-new-password")).status, 303);
});
