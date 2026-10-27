import assert from "node:assert/strict";

import { beforeEach, test } from "vitest";
import { z } from "zod/v4";

import {
  PlanningCommandSchema,
  TransactionListSchema,
  WorkspaceCatalogSchema,
} from "../../src/contracts";
import { fixedCategoryId } from "../../src/domain";
import { createPlanningService } from "../../src/worker/planning";
import { createPlanningRepository } from "../../src/worker/planning/repository";
import { createCatalogRepository } from "../../src/worker/planning/repository/catalog.repository";
import { command, cookies, fixture, login } from "./access-fixture";
import { collect, setup, source, transaction } from "./fixture";
import { env } from "cloudflare:workers";

beforeEach(setup);
function planning() {
  const service = createPlanningService(createPlanningRepository(env.DB));
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

test("provider categories map without changing source data or requiring AI", async () => {
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
