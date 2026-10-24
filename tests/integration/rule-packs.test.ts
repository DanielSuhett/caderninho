import assert from "node:assert/strict";

import { beforeEach, test } from "vitest";
import { z } from "zod/v4";

import {
  brasilRulePack,
  PlanningCommandSchema,
  RulePreviewSchema,
} from "../../src/contracts";
import type { ProviderTransaction } from "../../src/domain";
import { createPlanningService, previewRule } from "../../src/worker/planning";
import { createPlanningRepository } from "../../src/worker/planning/repository";
import { fixture as appFixture, cookies, grant, login } from "./access-fixture";
import { collect, setup, source, transaction } from "./fixture";
import { env } from "cloudflare:workers";

beforeEach(setup);
const period = { from: "2026-10-01", to: "2026-10-31" };
function fixture() {
  const repository = createPlanningRepository(env.DB);
  const service = createPlanningService(repository);
  const call = (tool: string, args: Record<string, unknown> = {}) =>
    service.execute(
      PlanningCommandSchema.parse({ spaceId: "personal", tool, ...args }),
    );
  const write = (tool: string, args: Record<string, unknown> = {}) =>
    call(tool, {
      confirmed: true,
      idempotency_key: crypto.randomUUID(),
      ...args,
    });
  const install = (args: Record<string, unknown> = {}) =>
    write("install_rule_pack", {
      packId: "brasil",
      ...args,
    });
  return { call, install, repository, write };
}
const installed = z.object({
  categoriesCreated: z.number(),
  categoryIds: z.record(z.string(), z.string()),
  packId: z.literal("brasil"),
  rulesCreated: z.number(),
  rulesExisting: z.number(),
  version: z.literal(1),
});
const identify = (value: unknown) =>
  z.object({ id: z.string() }).parse(value).id;
async function transactions(f: ReturnType<typeof fixture>) {
  return z
    .object({
      data: z.object({
        records: z.array(
          z.object({
            category: z.string().nullable(),
            description: z.string(),
            id: z.string(),
          }),
        ),
      }),
    })
    .parse(await f.call("get_transactions", { limit: 500 })).data.records;
}

test("native JSON installs atomically, reuses local categories and replays without duplicates or edits", async () => {
  const f = fixture();
  const pharmacy = identify(
    await f.write("create_category", { kind: "expense", name: "Farmácia" }),
  );
  assert.throws(() =>
    PlanningCommandSchema.parse({
      idempotency_key: "unconfirmed",
      packId: "brasil",
      spaceId: "personal",
      tool: "install_rule_pack",
    }),
  );
  assert.throws(() =>
    PlanningCommandSchema.parse({
      confirmed: true,
      idempotency_key: "bad-pack",
      packId: "unknown",
      spaceId: "personal",
      tool: "install_rule_pack",
    }),
  );
  const first = installed.parse(
    await f.install({ idempotency_key: "install" }),
  );
  assert.equal(first.rulesCreated, 30);
  assert.equal(first.categoriesCreated, 8);
  assert.equal(first.categoryIds.farmacia, pharmacy);
  assert.deepEqual(await f.install({ idempotency_key: "install" }), first);
  const second = installed.parse(await f.install());
  assert.equal(second.rulesCreated, 0);
  assert.equal(second.rulesExisting, 30);
  assert.equal(second.categoriesCreated, 0);
  const snapshot = await f.repository.read();
  assert.equal(snapshot.state.rules.length, 30);
  assert.equal(snapshot.state.edits.length, 0);
  for (const rule of snapshot.state.rules) {
    const definition = brasilRulePack.rules.find(
      (r) => r.key === rule.pack?.key,
    );
    assert.ok(definition);
    assert.deepEqual(rule.filter, definition.filter);
    assert.equal(rule.categoryId, first.categoryIds[definition.categoryKey]);
  }
  assert.equal(
    (
      await env.DB.prepare(
        "SELECT count(*) AS count FROM planning_rules",
      ).first<{ count: number }>()
    )?.count,
    30,
  );
  await assert.rejects(
    () =>
      f.install({
        categoryIds: { farmacia: pharmacy },
        idempotency_key: "install",
      }),
    { message: "IDEMPOTENCY_CONFLICT" },
  );
});

test("ambiguous and foreign category mappings roll back; explicit mapping resolves locally and spaces stay isolated", async () => {
  const f = fixture();
  const first = identify(
    await f.write("create_category", {
      kind: "expense",
      name: "Educação Geral",
    }),
  );
  await f.write("create_category", { kind: "expense", name: "educação geral" });
  const before = await f.repository.read();
  await assert.rejects(() => f.install(), {
    message: "INVALID_RULE_PACK_CATEGORY",
  });
  assert.deepEqual(await f.repository.read(), before);
  const spaceId = identify(
    await f.write("create_space", {
      color: "blue",
      currency: "BRL",
      icon: "house",
      monthStartDay: 1,
      name: "Outro",
    }),
  );
  await assert.rejects(
    () => f.install({ categoryIds: { farmacia: `${spaceId}:expense` } }),
    { message: "SPACE_MISMATCH" },
  );
  await assert.rejects(
    () => f.install({ categoryIds: { farmacia: "personal:income" } }),
    { message: "INVALID_RULE_PACK_CATEGORY" },
  );
  const local = installed.parse(
    await f.install({ categoryIds: { educacao: first } }),
  );
  const other = installed.parse(await f.install({ spaceId }));
  assert.notEqual(other.categoryIds.educacao, local.categoryIds.educacao);
  const all = (await f.repository.read()).state.rules;
  assert.equal(all.length, 60);
  assert.equal(new Set(all.map((r) => r.id)).size, 60);
  assert.equal(all.filter((r) => r.spaceId === spaceId).length, 30);
});

const cases: {
  description: string;
  key: string | null;
  overrides?: Partial<ProviderTransaction>;
}[] = [
  { description: "IFOOD FARMACIA", key: "ifood-farmacia" },
  { description: "IFOOD FARMÁCIA", key: "ifood-farmacia" },
  { description: "ifood farmácia", key: "ifood-farmacia" },
  { description: "RAPPI DROGARIA", key: "rappi-farmacia" },
  { description: "IFOOD PET SHOP", key: "ifood-pets" },
  { description: "RAPPI PETZ", key: "rappi-pets" },
  { description: "UBER*TRIP", key: "uber-viagens" },
  { description: "99POP", key: "99pop" },
  { description: "NETFLIX.COM", key: "netflix" },
  { description: "SPOTIFY", key: "spotify" },
  { description: "PETZ", key: "petz" },
  { description: "DROGASIL", key: "drogasil" },
  { description: "DROGARIA RAIA", key: "drogaria-raia" },
  { description: "DROGARIA SÃO PAULO", key: "drogaria-sao-paulo" },
  { description: "DROGARIAS PACHECO", key: "drogarias-pacheco" },
  { description: "ASSAÍ ATACADISTA", key: "assai" },
  { description: "ATACADÃO", key: "atacadao" },
  { description: "PÃO DE AÇÚCAR", key: "pao-de-acucar" },
  { description: "IFOOD MERCADO", key: "ifood-mercado" },
  { description: "RAPPI SUPERMERCADO", key: "rappi-mercado" },
  { description: "IFOOD RESTAURANTE", key: "ifood-restaurante" },
  { description: "RAPPI RESTAURANTES", key: "rappi-restaurante" },
  { description: "MCDONALD'S", key: "mcdonalds" },
  { description: "BURGER KING", key: "burger-king" },
  { description: "KFC", key: "kfc" },
  { description: "LOJAS RENNER", key: "renner" },
  { description: "LOJAS RIACHUELO", key: "riachuelo" },
  { description: "KABUM!", key: "kabum" },
  { description: "DECATHLON", key: "decathlon" },
  { description: "SMART FIT", key: "smart-fit" },
  { description: "ALURA", key: "alura" },
  { description: "UDEMY", key: "udemy" },
  { description: "IFOOD", key: null },
  { description: "RAPPI", key: null },
  { description: "RAPPI FARMACIA PETSHOP", key: null },
  { description: "IFOOD DROGARIA MERCADO", key: null },
  { description: "UBER TRIP UBER EATS", key: null },
  { description: "UBER EATS", key: null },
  { description: "99PAY", key: null },
  { description: "MERCADO PAGO", key: null },
  { description: "CARREFOUR", key: null },
  { description: "COBASI", key: null },
  { description: "PIX PETZ", key: null },
  { description: "FATURA LOJAS RENNER", key: null },
  { description: "ESTORNO NETFLIX", key: null },
  { description: "NETFLIX REEMBOLSO", key: null },
  { description: "SHOPIFY", key: null },
  { description: "X NETFLIX", key: null },
  { description: "IFOOD FARMÁCIA PETZ", key: null },
  { description: "ifood farmA\u0301cia", key: null },
  {
    description: "NETFLIX",
    key: null,
    overrides: { amount: "10", type: "CREDIT" },
  },
  { description: "NETFLIX", key: null, overrides: { status: "PENDING" } },
  { description: "NETFLIX", key: null, overrides: { currencyCode: "USD" } },
];
function syntheticRows(prefix: string) {
  return cases.map((c, i) =>
    transaction({
      description: c.description,
      id: `${prefix}-${i}`,
      ...c.overrides,
    }),
  );
}
async function classifications(f: ReturnType<typeof fixture>, prefix: string) {
  const {
    state: { rules },
  } = await f.repository.read();
  const rows = new Map((await transactions(f)).map((r) => [r.id, r]));
  return cases.map((c, i) => {
    const expected = c.key
      ? rules.find((r) => r.pack?.key === c.key)?.categoryId
      : null;
    return {
      actual: rows.get(`${prefix}-${i}`)?.category,
      description: c.description,
      expected,
    };
  });
}

test("persisted pack uses real preview and explicit application, then identical SQL import for positives, conflicts and refunds", async () => {
  const f = fixture();
  await collect(source(syntheticRows("history")));
  await f.install();
  assert.ok((await transactions(f)).every((r) => r.category === null));
  const {
    state: { rules },
  } = await f.repository.read();
  const previews = await Promise.all(
    rules.map((rule) =>
      previewRule(
        f.repository,
        RulePreviewSchema.parse({
          accountId: rule.accountId,
          csrf: "synthetic",
          direction: rule.direction,
          filter: rule.filter,
          spaceId: "personal",
          text: rule.text,
        }),
      ),
    ),
  );
  rules.forEach((rule, i) => {
    assert.equal(
      previews[i]?.count,
      cases.filter((c) => c.key === rule.pack?.key).length,
      rule.name,
    );
  });
  await f.write("apply_rules", period);
  for (const row of await classifications(f, "history")) {
    assert.equal(row.actual, row.expected, row.description);
  }
  // Real collection/import writes transactions, invoking the D1 trigger.
  await collect(
    source([...syntheticRows("history"), ...syntheticRows("new")]),
    "2026-10-02T00:00:00Z",
  );
  for (const row of await classifications(f, "new")) {
    assert.equal(row.actual, row.expected, row.description);
  }
  assert.equal(
    (
      await env.DB.prepare(
        "SELECT description FROM transactions WHERE id='history-0'",
      ).first<{ description: string }>()
    )?.description,
    "IFOOD FARMACIA",
  );
});

test("future personal rules win even at priority 1000, while defaults preserve explicit categories including null", async () => {
  const f = fixture();
  await collect(
    source([
      transaction({ description: "NETFLIX", id: "explicit" }),
      transaction({ description: "NETFLIX", id: "cleared" }),
      transaction({ description: "NETFLIX", id: "untouched" }),
    ]),
  );
  await f.write("edit_transaction", {
    category: "personal:transfer",
    id: "explicit",
  });
  await f.write("edit_transaction", { category: null, id: "cleared" });
  await f.install();
  await f.write("apply_rules", period);
  let rows = new Map((await transactions(f)).map((r) => [r.id, r.category]));
  assert.equal(rows.get("explicit"), "personal:transfer");
  assert.equal(rows.get("cleared"), null);
  assert.notEqual(rows.get("untouched"), null);
  const personal = identify(
    await f.write("create_rule", {
      categoryId: "personal:expense",
      name: "My Netflix",
      priority: 1000,
      text: "NETFLIX",
    }),
  );
  await collect(
    source([
      transaction({ description: "NETFLIX", id: "imported" }),
      transaction({ description: "NETFLIX", id: "explicit" }),
    ]),
    "2026-10-02T00:00:00Z",
  );
  rows = new Map((await transactions(f)).map((r) => [r.id, r.category]));
  assert.equal(rows.get("imported"), "personal:expense");
  assert.equal(rows.get("explicit"), "personal:transfer");
  // Explicit reapplication keeps the established semantics of personal rules.
  await f.write("apply_rules", period);
  assert.ok(
    (await transactions(f)).every((r) => r.category === "personal:expense"),
  );
  assert.ok(
    (await f.repository.read()).state.rules.find(
      (r) => r.id === personal && !r.pack,
    ),
  );
});

test("editing and disabling installed rules is preserved on reinstall", async () => {
  const f = fixture();
  await f.install();
  const original = (await f.repository.read()).state.rules.find(
    (r) => r.pack?.key === "netflix",
  );
  assert.ok(original);
  const { pack: _pack, ...fields } = original;
  await f.write("update_rule", {
    ...fields,
    enabled: false,
    name: "My disabled default",
  });
  await f.install();
  const updated = (await f.repository.read()).state.rules.find(
    (r) => r.id === original.id,
  );
  assert.equal(updated?.enabled, false);
  assert.equal(updated?.name, "My disabled default");
  assert.equal(updated?.pack, undefined);
  await collect(source([transaction({ description: "NETFLIX" })]));
  assert.equal((await transactions(f))[0]?.category, null);
});

test("authenticated MCP exposes the installer and persists the JSON in the installation database", async () => {
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
            name: "Synthetic pack test",
            version: "1",
          },
          "io.modelcontextprotocol/protocolVersion": "2026-07-28",
        },
        arguments: {
          confirmed: true,
          idempotency_key: "mcp-pack",
          packId: "brasil",
          spaceId: "personal",
        },
        name: "install_rule_pack",
      },
    }),
    headers: {
      Accept: "application/json, text/event-stream",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Mcp-Method": "tools/call",
      "Mcp-Name": "install_rule_pack",
      "Mcp-Protocol-Version": "2026-07-28",
    },
    method: "POST",
  });
  const { result } = z
    .object({
      result: z.object({
        content: z.array(z.object({ text: z.string() })),
        isError: z.boolean(),
      }),
    })
    .parse(await response.json());
  assert.equal(result.isError, false, JSON.stringify(result));
  assert.equal(
    installed.parse(JSON.parse(result.content[0]?.text ?? "{}")).rulesCreated,
    30,
  );
  assert.equal(
    (await createPlanningRepository(env.DB).read()).state.rules.length,
    30,
  );
});
