import assert from "node:assert/strict";

import { beforeEach, test } from "vitest";
import { z } from "zod/v4";

import { PlanningCommandSchema } from "../../src/contracts";
import { SubscriptionsResultSchema } from "../../src/contracts/planning-results";
import { createPlanningService } from "../../src/worker/planning";
import { createPlanningRepository } from "../../src/worker/planning/repository";
import { fixture as appFixture, cookies, grant, login } from "./access-fixture";
import { account, collect, setup, source, transaction } from "./fixture";
import { env } from "cloudflare:workers";

beforeEach(setup);
const dates = ["2026-08-15", "2026-09-15", "2026-10-15"];
function series(
  name = "Serviço",
  fields: Parameters<typeof transaction>[0] = {},
) {
  return dates.map((date, index) =>
    transaction({
      amount: "-90071992547409.93",
      date,
      description: name,
      id: `${name}:${index}`,
      ...fields,
    }),
  );
}
function fixture() {
  const repository = createPlanningRepository(env.DB);
  const service = createPlanningService(
    repository,
    () => new Date("2026-10-24T15:00:00Z"),
  );
  const call = (args: Record<string, unknown> = {}) =>
    service.execute(
      PlanningCommandSchema.parse({
        tool: "get_subscriptions",
        ...args,
      }),
    );
  return {
    call,
    read: async (args: Record<string, unknown> = {}) =>
      SubscriptionsResultSchema.parse(await call(args)),
    repository,
    write: (tool: string, args: Record<string, unknown>) =>
      service.execute(
        PlanningCommandSchema.parse({
          confirmed: true,
          idempotency_key: crypto.randomUUID(),
          spaceId: "personal",
          tool,
          ...args,
        }),
      ),
  };
}

test("subscriptions analyze beyond the transaction listing limit without writing or mixing currencies/accounts", async () => {
  await collect(
    source(
      [
        ...Array.from({ length: 501 }, (_, index) =>
          transaction({ description: `Compra ${index}`, id: `noise:${index}` }),
        ),
        ...series(),
        ...series("USD", { currencyCode: "USD" }),
        ...series("Outra conta", { accountId: "b" }),
      ],
      [account(), account({ id: "b" })],
    ),
  );
  const f = fixture();
  const before = await f.repository.revision();
  const result = await f.read();
  assert.equal(result.data.estimated, true);
  assert.equal(result.data.scannedCount, 510);
  assert.equal(result.data.truncated, false);
  assert.equal(result.data.records.length, 3);
  const candidate = result.data.records.find((row) => row.name === "Serviço");
  assert.equal(candidate?.observedTotalMinor, "27021597764222979");
  assert.equal(candidate?.amountMinor, "9007199254740993");
  assert.equal(candidate?.cadence, "monthly");
  assert.equal(candidate?.nextExpectedDate, "2026-11-15");
  assert.deepEqual(
    candidate?.evidence.map((row) => row.transactionId),
    ["Serviço:0", "Serviço:1", "Serviço:2"],
  );
  assert.deepEqual(result.data.selection, {
    from: "2025-10-24",
    include_ignored: false,
    spaceId: "personal",
    to: "2026-10-24",
  });
  assert.equal(result.coverage.kind, "imported");
  assert.equal(result.oldestLastSuccessAt, "2026-10-01T00:00:00.000Z");
  assert.equal(result.partial, false);
  assert.equal(await f.repository.revision(), before);
  assert.equal(
    (await f.read({ accountId: "a", currency: "BRL", personId: "self" })).data
      .records.length,
    1,
  );
});

test("local edits, ignored rows, transfers, pending, future and installment metadata retain their effective meaning", async () => {
  await collect(
    source([
      ...series(),
      ...series("Transferência", { category: "Same person transfer" }),
      ...series("Pendente", { status: "PENDING" }),
      ...series("Parcelado", {
        creditCardMetadata: { installmentNumber: 1, totalInstallments: 12 },
      }),
      ...series("Futuro", { date: "2026-12-15" }),
    ]),
  );
  const f = fixture();
  assert.deepEqual(
    (await f.read({ to: "2026-12-31" })).data.records.map((row) => row.name),
    ["Serviço"],
  );
  await f.write("edit_transaction", { id: "Serviço:0", ignored: true });
  assert.deepEqual((await f.read()).data.records, []);
  assert.equal(
    (await f.read({ minOccurrences: 2 })).data.records[0]?.occurrences,
    2,
  );
  await f.write("create_recurrence", {
    accountId: "a",
    amountMinor: "2000",
    currency: "BRL",
    direction: "DEBIT",
    name: "Somente cadastrado",
    startDate: "2026-08-01",
  });
  assert.deepEqual((await f.read()).data.records, []);
});

test("result limits and partial collection remain explicit, with validated periods and selection scope", async () => {
  await collect(source([...series("Alfa"), ...series("Beta")]));
  const f = fixture();
  const limited = await f.read({ limit: 1 });
  assert.equal(limited.data.truncated, true);
  assert.equal(limited.data.matchedCount, 2);
  assert.equal(limited.data.records.length, 1);
  await assert.rejects(() => f.call({ from: "2026-10-20", to: "2026-10-01" }), {
    message: "INVALID_PERIOD",
  });
  await assert.rejects(() => f.call({ accountId: "missing" }), {
    message: "NOT_FOUND",
  });
  await assert.rejects(() => f.call({ personId: "missing" }), {
    message: "NOT_FOUND",
  });
  await assert.rejects(() => f.call({ spaceId: "missing" }), {
    message: "NOT_FOUND",
  });
  await env.DB.prepare(
    "UPDATE connections SET last_success_at=NULL WHERE id='c'",
  ).run();
  const partial = await f.read();
  assert.equal(partial.partial, true);
  assert.equal(partial.oldestLastSuccessAt, null);
});

test("the analysis stops at the scan cap and reports an incomplete result", async () => {
  await collect(source([transaction()]));
  const f = fixture();
  const service = createPlanningService(
    {
      ...f.repository,
      async *transactions() {
        for await (const page of f.repository.transactions()) {
          const [row] = page;
          assert.ok(row);
          yield Array.from({ length: 10_001 }, (_, index) => ({
            ...row,
            id: `row:${index}`,
          }));
        }
      },
    },
    () => new Date("2026-10-24T15:00:00Z"),
  );
  const result = SubscriptionsResultSchema.parse(
    await service.execute(
      PlanningCommandSchema.parse({ tool: "get_subscriptions" }),
    ),
  );
  assert.equal(result.data.scannedCount, 10_000);
  assert.equal(result.data.scanLimit, 10_000);
  assert.equal(result.data.truncated, true);
  assert.deepEqual(result.data.records, []);
});

test("authenticated MCP returns subscription evidence as structured content and text", async () => {
  await collect(source(series()));
  const app = appFixture();
  const token = await grant(app, cookies(await login(app)));
  const response = await app.request("/mcp", {
    body: JSON.stringify({
      id: 1,
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        _meta: {
          "io.modelcontextprotocol/clientCapabilities": {},
          "io.modelcontextprotocol/clientInfo": {
            name: "Subscriptions fixture",
            version: "1",
          },
          "io.modelcontextprotocol/protocolVersion": "2026-07-28",
        },
        arguments: {},
        name: "get_subscriptions",
      },
    }),
    headers: {
      Accept: "application/json, text/event-stream",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Mcp-Method": "tools/call",
      "Mcp-Name": "get_subscriptions",
      "Mcp-Protocol-Version": "2026-07-28",
    },
    method: "POST",
  });
  assert.equal(response.status, 200);
  const { result } = z
    .object({
      result: z.object({
        content: z.array(z.object({ text: z.string() })),
        isError: z.boolean(),
        structuredContent: SubscriptionsResultSchema,
      }),
    })
    .parse(await response.json());
  assert.equal(result.isError, false);
  assert.equal(result.structuredContent.data.records[0]?.occurrences, 3);
  assert.deepEqual(
    result.structuredContent,
    JSON.parse(result.content[0]?.text ?? "null"),
  );
});
