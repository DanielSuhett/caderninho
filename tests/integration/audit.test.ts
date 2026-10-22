import assert from "node:assert/strict";

import { beforeEach, test } from "vitest";

import { AuditReportSchema } from "../../src/contracts";
import { createAuditRepository } from "../../src/worker/audit/repository";
import { streamMcpResponse } from "../../src/worker/mcp/controller/response";
import { Outcome } from "../../src/worker/observability";
import { command, cookies, fixture, grant, login } from "./access-fixture";
import { setup } from "./fixture";
import { env } from "cloudflare:workers";

beforeEach(setup);
const meta = {
  "io.modelcontextprotocol/clientCapabilities": {},
  "io.modelcontextprotocol/clientInfo": {
    name: "Assistente sintético",
    version: "1",
  },
  "io.modelcontextprotocol/protocolVersion": "2026-07-28",
};
function call(
  app: ReturnType<typeof fixture>,
  token: string,
  name: string,
  model?: string,
) {
  const body = JSON.stringify({
    id: 1,
    jsonrpc: "2.0",
    method: "tools/call",
    params: {
      _meta: { ...meta, ...(model && { "caderninho.app/model": model }) },
      arguments: {},
      name,
    },
  });
  return {
    body,
    response: app.request("/mcp", {
      body,
      headers: {
        Accept: "application/json, text/event-stream",
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "Mcp-Method": "tools/call",
        "Mcp-Name": name,
        "Mcp-Protocol-Version": "2026-07-28",
        "X-Client-Id": "forged-client",
        "X-Model": "forged-model",
      },
      method: "POST",
    }),
  };
}
async function report(app: ReturnType<typeof fixture>, cookie: string) {
  return AuditReportSchema.parse(
    await (
      await app.request("/api/account/audit?days=7", {
        headers: { Cookie: cookie },
      })
    ).json(),
  );
}

test("audit measures UTF-8 bodies and authenticated clients, reports HTTP200 tool errors, and never infers models", async () => {
  const app = fixture();
  const cookie = cookies(await login(app));
  const token = await grant(app, cookie, "Synthetic audit assistant");
  const request = call(app, token, "get_spaces", "synthetic/model-1");
  const response = await request.response;
  const payload = await response.text();
  assert.equal(response.status, 200);
  const first = await report(app, cookie);
  assert.equal(first.totals.requests, 1);
  assert.equal(first.totals.toolCalls, 1);
  assert.equal(first.totals.errors, 0);
  assert.equal(
    first.recent[0]?.inputBytes,
    new TextEncoder().encode(request.body).byteLength,
  );
  assert.equal(
    first.recent[0]?.outputBytes,
    new TextEncoder().encode(payload).byteLength,
  );
  assert.equal(first.recent[0]?.clientId, first.grants[0]?.clientId);
  assert.equal(first.recent[0]?.model, "synthetic/model-1");
  const failure = await call(app, token, "not_a_tool").response;
  assert.equal(failure.status, 200);
  assert.ok((await failure.text()).includes('"isError":true'));
  const after = await report(app, cookie);
  assert.equal(after.totals.errors, 1);
  assert.equal(after.totals.toolCalls, 2);
  assert.equal(after.models.find((m) => m.model === null)?.errors, 1);
  const stored = JSON.stringify(
    await env.DB.prepare("SELECT * FROM mcp_audit").all(),
  );
  for (const secret of [
    token,
    "forged-client",
    "forged-model",
    "Synthetic audit assistant",
    "clientCapabilities",
  ]) {
    assert.equal(stored.includes(secret), false);
  }
});

test("audit is private and revocation affects only the selected grant", async () => {
  const app = fixture();
  assert.equal((await app.request("/api/account/audit")).status, 401);
  assert.equal((await app.request("/account/audit")).status, 302);
  assert.equal((await app.request("/account/design-system")).status, 302);
  const cookie = cookies(await login(app));
  const first = await grant(app, cookie, "First");
  const second = await grant(app, cookie, "Second");
  const data = await report(app, cookie);
  const selected = data.grants.find((g) => g.clientName === "First");
  assert.ok(selected);
  assert.equal(
    (
      await command(app, cookie, "revoke-grant", {
        csrf: "wrong",
        grantId: selected.id,
      })
    ).status,
    403,
  );
  assert.equal(
    (await command(app, cookie, "revoke-grant", { grantId: selected.id }))
      .status,
    200,
  );
  assert.equal((await call(app, first, "get_spaces").response).status, 401);
  const remaining = await call(app, second, "get_spaces").response;
  assert.equal(remaining.status, 200);
  await remaining.text();
  assert.equal((await report(app, cookie)).grants.length, 1);
  assert.equal(
    (
      await app.request("/api/account/audit?days=365", {
        headers: { Cookie: cookie },
      })
    ).status,
    400,
  );
});

test("audit retention and time windows keep aggregate denominators correct", async () => {
  const repo = createAuditRepository(env.DB);
  const now = new Date("2026-10-22T12:00:00Z");
  const base = {
    clientId: "client",
    durationMs: 30,
    inputBytes: 10,
    model: null,
    outcome: "success" as const,
    outputBytes: 20,
    status: 200,
    tool: "get_spaces",
  };
  await repo.record({
    ...base,
    id: "expired",
    startedAt: "2026-09-01T00:00:00.000Z",
  });
  await repo.record({
    ...base,
    id: "older",
    startedAt: "2026-10-12T12:00:00.000Z",
  });
  await repo.record({ ...base, id: "now", startedAt: now.toISOString() });
  assert.equal((await repo.report(7, now)).totals?.requests, 1);
  assert.equal((await repo.report(30, now)).totals?.requests, 2);
  const expired = await env.DB.prepare(
    "SELECT id FROM mcp_audit WHERE id='expired'",
  ).first();
  assert.equal(expired, null);
});

test("stream cancellation records partial bytes exactly once and stream errors remain failures", async () => {
  const completed: Array<{ outcome: Outcome; bytes: number }> = [];
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode("á"));
    },
  });
  const response = streamMcpResponse({
    action: "query",
    close: () => Promise.resolve(),
    onFinish: (outcome, bytes) => {
      completed.push({ bytes, outcome });
      return Promise.resolve();
    },
    response: new Response(body),
    signal: new AbortController().signal,
  });
  const reader = response.body?.getReader();
  assert.ok(reader);
  await reader.read();
  await reader.cancel();
  assert.deepEqual([...completed], [{ bytes: 2, outcome: Outcome.cancelled }]);
  const broken = streamMcpResponse({
    action: "query",
    close: () => Promise.resolve(),
    onFinish: (outcome, bytes) => {
      completed.push({ bytes, outcome });
      return Promise.resolve();
    },
    response: new Response(
      new ReadableStream({
        start(controller) {
          controller.error(new Error("synthetic"));
        },
      }),
    ),
    signal: new AbortController().signal,
  });
  await assert.rejects(broken.text());
  assert.equal(completed.length, 2);
  assert.equal(completed[1]?.outcome, Outcome.failed);
});
