import assert from "node:assert/strict";

import { beforeEach, test } from "vitest";
import { z } from "zod/v4";

import {
  PlanningCommandSchema,
  TransactionListSchema,
  WorkspaceCatalogSchema,
} from "../../src/contracts";
import { fixedCategoryId, type ProviderTransaction } from "../../src/domain";
import { createPlanningService } from "../../src/worker/planning";
import { createPlanningRepository } from "../../src/worker/planning/repository";
import { createCatalogRepository } from "../../src/worker/planning/repository/catalog.repository";
import { runImport } from "../../src/worker/sync";
import type { TransactionClassifier } from "../../src/worker/sync/entity";
import { createSyncRepository } from "../../src/worker/sync/repository";
import { command, cookies, fixture, login } from "./access-fixture";
import { account, admit, collect, setup, source, transaction } from "./fixture";
import { env } from "cloudflare:workers";

beforeEach(setup);
function planning(enabled = false) {
  const service = createPlanningService(
    createPlanningRepository(env.DB, enabled),
  );
  const call = (tool: string, fields: Record<string, unknown> = {}) =>
    service.execute(
      PlanningCommandSchema.parse({ spaceId: "personal", tool, ...fields }),
    );
  return {
    call,
    write: (tool: string, fields: Record<string, unknown> = {}) =>
      call(tool, {
        ...fields,
        confirmed: true,
        idempotency_key: crypto.randomUUID(),
      }),
  };
}
const identify = (value: unknown) =>
  z.object({ id: z.string() }).parse(value).id;
async function importWithClassifier(
  rows: ProviderTransaction[],
  classifier: TransactionClassifier,
  now = "2026-10-01T00:00:00.000Z",
) {
  const id = await admit(now);
  const repository = createSyncRepository(env.DB);
  await runImport(
    {
      classifier,
      now: () => now,
      repository,
      source: source(rows),
      steps: { do: (_name, run) => run() },
    },
    id,
  );
  return repository.read(id);
}

test("fixed catalog, group CRUD, protected names and scoped assignments round-trip through planning and portal", async () => {
  const f = planning();
  const catalog = WorkspaceCatalogSchema.parse(
    await createCatalogRepository(env.DB).read("personal"),
  );
  assert.equal(
    catalog.categories.filter((category) => !category.hidden).length,
    33,
  );
  assert.equal(catalog.categoryGroups.length, 9);
  const key = { confirmed: true, idempotency_key: "create-group" };
  const created = await f.call("create_category_group", {
    ...key,
    color: "#123abc",
    icon: "gift",
    name: "Projeto",
  });
  assert.deepEqual(
    await f.call("create_category_group", {
      ...key,
      color: "#123abc",
      icon: "gift",
      name: "Projeto",
    }),
    created,
  );
  const groupId = identify(created);
  const categoryId = fixedCategoryId("personal", "casamento");
  await f.write("update_category", {
    color: "#abcdef",
    groupId,
    icon: "heart",
    id: categoryId,
  });
  const grouped = z
    .object({
      data: z.object({ records: z.array(z.object({ id: z.string() })) }),
    })
    .parse(await f.call("get_categories", { groupId }));
  assert.deepEqual(
    grouped.data.records.map((row) => row.id),
    [categoryId],
  );
  await assert.rejects(
    () => f.write("update_category", { id: categoryId, name: "Changed" }),
    { message: "SYSTEM_CATEGORY" },
  );
  const otherSpace = identify(
    await f.write("create_space", {
      color: "blue",
      currency: "BRL",
      icon: "home",
      monthStartDay: 1,
      name: "Família",
      type: "family",
    }),
  );
  const other = WorkspaceCatalogSchema.parse(
    await createCatalogRepository(env.DB).read(otherSpace),
  );
  assert.equal(
    other.categories.filter((category) => !category.hidden).length,
    33,
  );
  await assert.rejects(
    () =>
      f.write("update_category", {
        groupId: other.categoryGroups[0]?.id,
        id: categoryId,
      }),
    { message: "SPACE_MISMATCH" },
  );
  await f.write("update_category_group", {
    color: "#112233",
    icon: "star",
    id: groupId,
    name: "Celebração",
  });
  const app = fixture();
  const cookie = cookies(await login(app));
  const response = await app.request("/api/account/catalog?spaceId=personal", {
    headers: { Cookie: cookie },
  });
  assert.equal(response.status, 200);
  const front = WorkspaceCatalogSchema.parse(await response.json());
  assert.equal(
    front.categoryGroups.find((group) => group.id === groupId)?.name,
    "Celebração",
  );
  assert.equal(
    front.categories.find((category) => category.id === categoryId)?.color,
    "#abcdef",
  );
  await f.write("delete_category_group", { id: groupId });
  const final = await createCatalogRepository(env.DB).read("personal");
  assert.equal(
    final.categories.find((category) => category.id === categoryId)?.groupId,
    null,
  );
  assert.equal(final.categories.length, catalog.categories.length);
  assert.equal(final.categoryGroups.length, 9);
  const invalid = PlanningCommandSchema.safeParse({
    color: "url(javascript:bad)",
    confirmed: true,
    id: categoryId,
    idempotency_key: "bad",
    spaceId: "personal",
    tool: "update_category",
  });
  assert.equal(invalid.success, false);
  const portal = await command(app, cookie, "planning", {
    command: {
      color: "#ff0000",
      confirmed: true,
      icon: "gift",
      id: categoryId,
      idempotency_key: "front-appearance",
      spaceId: "personal",
      tool: "update_category",
    },
  });
  assert.equal(portal.status, 200);
});

test("disabled Clef maps provider categories without changing source data or requiring AI", async () => {
  await collect(
    source([
      transaction({ category: "Groceries" }),
      transaction({ category: null, id: "missing" }),
      transaction({ category: "New unknown label", id: "unknown" }),
    ]),
  );
  const result = TransactionListSchema.parse(
    await planning().call("get_transactions"),
  );
  assert.equal(
    result.data.records.find((row) => row.id === "t")?.category,
    fixedCategoryId("personal", "mercado"),
  );
  assert.equal(
    result.data.records.find((row) => row.id === "missing")?.category,
    null,
  );
  assert.equal(
    result.data.records.find((row) => row.id === "unknown")?.category,
    null,
  );
  assert.equal(
    await env.DB.prepare(
      "SELECT category FROM transactions WHERE id='t'",
    ).first("category"),
    "Groceries",
  );
});

test("post-import Clef decisions cache unchanged evidence, fall back on failures and preserve manual overrides", async () => {
  let calls = 0;
  const rows = [
    transaction({ category: "Shopping", description: "Academia sintética" }),
    transaction({
      category: "Shopping",
      description: "Academia sintética",
      id: "t2",
    }),
    transaction({ category: "Pharmacy", description: "Ambígua", id: "t3" }),
  ];
  const classifier: TransactionClassifier = async (state) => {
    calls += 1;
    assert.equal(
      await env.DB.prepare("SELECT count(*) AS n FROM transactions").first("n"),
      3,
    );
    if (state.description === "Ambígua") {
      throw new Error("AI unavailable");
    }
    return { category: "academia", confidence: 0.95 };
  };
  assert.equal(
    (await importWithClassifier(rows, classifier)).status,
    "succeeded",
  );
  assert.equal(calls, 2);
  const f = planning(true);
  const list = () =>
    f
      .call("get_transactions")
      .then((value) => TransactionListSchema.parse(value).data.records);
  assert.equal(
    (await list()).find((row) => row.id === "t")?.category,
    fixedCategoryId("personal", "academia"),
  );
  assert.equal(
    (await list()).find((row) => row.id === "t3")?.category,
    fixedCategoryId("personal", "farmacia"),
  );
  await f.write("edit_transaction", {
    category: fixedCategoryId("personal", "saude-geral"),
    id: "t",
  });
  await importWithClassifier(rows, classifier, "2026-10-02T00:00:00.000Z");
  assert.equal(calls, 3);
  assert.equal(
    (await list()).find((row) => row.id === "t")?.category,
    fixedCategoryId("personal", "saude-geral"),
  );
  assert.equal(
    TransactionListSchema.parse(
      await planning(false).call("get_transactions"),
    ).data.records.find((row) => row.id === "t2")?.category,
    fixedCategoryId("personal", "compras"),
  );
  await collect(
    source([
      transaction({
        category: "Groceries",
        description: "Nova evidência",
        id: "t2",
      }),
    ]),
    "2026-10-03T00:00:00.000Z",
  );
  assert.equal(
    (await list()).find((row) => row.id === "t2")?.category,
    fixedCategoryId("personal", "mercado"),
  );
});

test("classification checkpoint replay skips completed inference pages and keeps rule priority across accounts", async () => {
  const f = planning(true);
  await f.write("create_rule", {
    categoryId: fixedCategoryId("personal", "saude-geral"),
    name: "Academia local",
    priority: 1,
    text: "Academia",
  });
  const rows = Array.from({ length: 28 }, (_, index) =>
    transaction({
      category: "Shopping",
      description: `Academia sintética ${index}`,
      id: `t${String(index).padStart(2, "0")}`,
    }),
  );
  rows.push(
    transaction({
      accountId: "b",
      category: "Shopping",
      description: "Academia B1",
      id: "b1",
    }),
    transaction({
      accountId: "b",
      category: "Shopping",
      description: "Academia B2",
      id: "b2",
    }),
  );
  const id = await admit();
  const repository = createSyncRepository(env.DB);
  let calls = 0;
  let replayed = false;
  await runImport(
    {
      classifier: () => {
        calls += 1;
        return Promise.resolve({ category: "academia", confidence: 0.9 });
      },
      now: () => "2026-10-01T00:00:00.000Z",
      repository,
      source: source(rows, [account(), account({ id: "b" })]),
      steps: {
        do: async (_name, operation) => {
          const before = await repository.read(id);
          const result = await operation();
          if (before.checkpoint.phase === "classification" && !replayed) {
            replayed = true;
            const count = calls;
            assert.deepEqual(await operation(), result);
            assert.equal(calls, count);
          }
          return result;
        },
      },
    },
    id,
  );
  assert.equal((await repository.read(id)).status, "succeeded");
  assert.equal(replayed, true);
  assert.equal(calls, 30);
  const { records } = TransactionListSchema.parse(
    await f.call("get_transactions"),
  ).data;
  assert.equal(records.length, 30);
  assert.ok(
    records.every(
      (row) => row.category === fixedCategoryId("personal", "saude-geral"),
    ),
  );
  assert.equal(
    await env.DB.prepare(
      "SELECT count(*) AS n FROM transactions WHERE classification IS NOT NULL",
    ).first("n"),
    30,
  );
});

test("loan proceeds and investment movements do not inflate income or reduce repayment expenses", async () => {
  await collect(
    source([
      transaction({
        amount: "1000",
        category: "Loans",
        id: "loan-credit",
        type: "CREDIT",
      }),
      transaction({ amount: "-100", category: "Financing", id: "loan-debit" }),
      transaction({
        amount: "-500",
        category: "Investments",
        id: "investment",
      }),
      transaction({
        amount: "2000",
        category: "Income",
        id: "salary",
        type: "CREDIT",
      }),
    ]),
  );
  const result = z
    .object({
      data: z.object({
        totals: z.array(
          z.object({ expenseMinor: z.string(), incomeMinor: z.string() }),
        ),
      }),
    })
    .parse(
      await planning().call("get_overview", {
        from: "2026-10-01",
        to: "2026-10-31",
      }),
    );
  assert.equal(result.data.totals[0]?.incomeMinor, "200000");
  assert.equal(result.data.totals[0]?.expenseMinor, "10000");
});
