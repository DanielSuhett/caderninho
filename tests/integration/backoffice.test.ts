import assert from "node:assert/strict";

import { beforeEach, test } from "vitest";
import { z } from "zod/v4";

import {
  PlanningCommandSchema,
  RulePreviewResultSchema,
  RulePreviewSchema,
} from "../../src/contracts";
import { createPlanningService, previewRule } from "../../src/worker/planning";
import { createPlanningRepository } from "../../src/worker/planning/repository";
import { command, cookies, fixture, login, origin } from "./access-fixture";
import { collect, setup, source, transaction } from "./fixture";
import { env } from "cloudflare:workers";

beforeEach(setup);
const identify = (value: unknown) =>
  z.object({ id: z.string() }).parse(value).id;
function planning() {
  const repository = createPlanningRepository(env.DB);
  const service = createPlanningService(repository);
  const write = (tool: string, args: Record<string, unknown> = {}) =>
    service.execute(
      PlanningCommandSchema.parse({
        confirmed: true,
        idempotency_key: crypto.randomUUID(),
        spaceId: "personal",
        tool,
        ...args,
      }),
    );
  return { repository, service, write };
}
const conditions = {
  alternatives: [
    {
      conditions: [
        { field: "description", operator: "starts_with", value: "PIX %_" },
        { field: "amount", operator: "gte", value: "9007199254740993" },
        { field: "direction", operator: "equals", value: "DEBIT" },
        { field: "personId", operator: "equals", value: "self" },
        { field: "status", operator: "equals", value: "POSTED" },
        { field: "date", operator: "lte", value: "2026-10-22" },
        { field: "accountId", operator: "equals", value: "a" },
      ],
    },
    {
      conditions: [
        { field: "description", operator: "equals", value: "Salário" },
        { field: "direction", operator: "equals", value: "CREDIT" },
      ],
    },
  ],
  currency: "BRL",
};

test("browser mutations require session, origin, CSRF and explicit tool allowlist; retries are idempotent", async () => {
  const app = fixture();
  const body = {
    command: {
      categoryId: "personal:expense",
      confirmed: true,
      idempotency_key: "browser-rule",
      name: "Mercado",
      spaceId: "personal",
      text: "mercado",
      tool: "create_rule",
    },
  };
  assert.equal(
    (
      await app.request("/api/account/planning", {
        body: JSON.stringify({ csrf: "fake", ...body }),
        headers: { "Content-Type": "application/json", Origin: origin },
        method: "POST",
      })
    ).status,
    401,
  );
  const cookie = cookies(await login(app));
  assert.equal(
    (await command(app, cookie, "planning", { ...body, csrf: "fake" })).status,
    403,
  );
  assert.equal(
    (
      await command(app, cookie, "planning", {
        command: { ...body.command, id: "t", tool: "delete_transaction" },
      })
    ).status,
    400,
  );
  const first = await command(app, cookie, "planning", body);
  assert.equal(first.status, 200);
  const created = await first.json();
  assert.deepEqual(
    await (await command(app, cookie, "planning", body)).json(),
    created,
  );
  assert.equal(
    (
      await command(app, cookie, "planning", {
        command: { ...body.command, name: "Changed" },
      })
    ).status,
    409,
  );
  const id = identify(created);
  assert.equal(
    (
      await command(app, cookie, "planning", {
        command: {
          ...body.command,
          id,
          idempotency_key: "browser-update",
          name: "Mercado atualizado",
          tool: "update_rule",
        },
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await command(app, cookie, "planning", {
        command: {
          confirmed: true,
          id,
          idempotency_key: "browser-delete",
          spaceId: "personal",
          tool: "delete_rule",
        },
      })
    ).status,
    200,
  );
  assert.equal((await planning().repository.read()).state.rules.length, 0);
});

test("preview, automatic import and explicit application agree on AND/OR, literal text, person and exact money", async () => {
  const f = planning();
  await collect(source([]));
  await f.write("create_rule", {
    categoryId: "personal:expense",
    filter: conditions,
    name: "Advanced",
  });
  await collect(
    source([
      transaction({
        amount: "-90071992547409.93",
        description: "pix %_ Loja",
        id: "match-big",
      }),
      transaction({
        amount: "-90071992547409.92",
        description: "PIX %_ Loja",
        id: "below",
      }),
      transaction({
        amount: "-90071992547409.93",
        description: "PIX xx Loja",
        id: "literal",
      }),
      transaction({
        amount: "100",
        description: "Salário",
        id: "income",
        type: "CREDIT",
      }),
      transaction({
        currencyCode: "USD",
        description: "Salário",
        id: "wrong-currency",
        type: "CREDIT",
      }),
      transaction({
        amount: "-90071992547409.93",
        description: "PIX %_ Loja",
        id: "pending",
        status: "PENDING",
      }),
    ]),
    "2026-10-02T00:00:00Z",
  );
  const before = await f.repository.revision();
  const preview = await previewRule(
    f.repository,
    RulePreviewSchema.parse({
      csrf: "synthetic",
      filter: conditions,
      spaceId: "personal",
    }),
  );
  assert.equal(preview.count, 2);
  assert.equal(preview.examined, 6);
  assert.equal(preview.truncated, false);
  assert.deepEqual(preview.samples.map((row) => row.id).sort(), [
    "income",
    "match-big",
  ]);
  assert.equal(await f.repository.revision(), before);
  const automatic = (await f.repository.read()).state.edits
    .filter((row) => row.category === "personal:expense")
    .map((row) => row.id)
    .sort();
  assert.deepEqual(automatic, ["income", "match-big"]);
  await f.write("apply_rules", { from: "2026-10-01", to: "2026-10-31" });
  assert.deepEqual(
    (await f.repository.read()).state.edits
      .filter((row) => row.category === "personal:expense")
      .map((row) => row.id)
      .sort(),
    automatic,
  );
});

test("browser preview is read-only and group deletion protects ownership and existing financial records", async () => {
  const app = fixture();
  const cookie = cookies(await login(app));
  const f = planning();
  await collect(source([transaction()]));
  const revision = await f.repository.revision();
  const response = await command(app, cookie, "rule-preview", {
    spaceId: "personal",
    text: "Synthetic",
  });
  assert.equal(response.status, 200);
  assert.equal(RulePreviewResultSchema.parse(await response.json()).count, 1);
  assert.equal(await f.repository.revision(), revision);
  const create = {
    confirmed: true,
    currency: "BRL",
    idempotency_key: "group-create",
    name: "Família",
    spaceId: "personal",
    tool: "create_space",
    type: "family",
  };
  const created = await command(app, cookie, "planning", { command: create });
  assert.equal(created.status, 200);
  const id = identify(await created.json());
  assert.equal(
    (
      await command(app, cookie, "planning", {
        command: {
          confirmed: true,
          id,
          idempotency_key: "group-update",
          monthStartDay: 5,
          name: "Casa",
          spaceId: id,
          tool: "update_space",
          type: "family",
        },
      })
    ).status,
    200,
  );
  assert.equal(
    (await f.repository.read()).state.spaces.find((s) => s.id === id)?.name,
    "Casa",
  );
  await assert.rejects(() => f.write("delete_space", { id: "personal" }), {
    message: "SPACE_PROTECTED",
  });
  await f.write("move_account", { id: "a", targetSpaceId: id });
  await assert.rejects(() => f.write("delete_space", { id, spaceId: id }), {
    message: "SPACE_NOT_EMPTY",
  });
  await f.write("move_account", {
    id: "a",
    spaceId: id,
    targetSpaceId: "personal",
  });
  assert.equal(
    (
      await command(app, cookie, "planning", {
        command: {
          confirmed: true,
          id,
          idempotency_key: "group-delete",
          spaceId: id,
          tool: "delete_space",
        },
      })
    ).status,
    200,
  );
  assert.equal(
    (await f.repository.read()).state.spaces.some((s) => s.id === id),
    false,
  );
  assert.equal(
    (
      await env.DB.prepare("SELECT count(*) AS total FROM transactions").first<{
        total: number;
      }>()
    )?.total,
    1,
  );
});

test("preview caps scanned records and marks the count partial without writing", async () => {
  const f = planning();
  const row = {
    accountId: "a",
    amountMinor: "-100",
    category: "",
    currency: "BRL",
    date: "2026-10-01",
    description: "Synthetic",
    direction: "DEBIT" as const,
    id: "sample",
    status: "POSTED" as const,
  };
  await collect(source([transaction()]));
  const bounded = {
    ...f.repository,
    async *transactions() {
      yield await Promise.resolve(
        Array.from({ length: 10_001 }, (_, i) => ({
          ...row,
          id: String(i),
        })),
      );
    },
  };
  const result = await previewRule(
    bounded,
    RulePreviewSchema.parse({
      csrf: "synthetic",
      spaceId: "personal",
      text: "Synthetic",
    }),
  );
  assert.equal(result.examined, 10_000);
  assert.equal(result.count, 10_000);
  assert.equal(result.truncated, true);
  assert.equal(result.samples.length, 5);
});
