import assert from "node:assert/strict";

import { beforeEach, test } from "vitest";
import { z } from "zod/v4";

import {
  PlanningCommandSchema,
  TransactionListSchema,
  WorkspaceCatalogSchema,
} from "../../src/contracts";
import { closedMonths, fixedCategoryId } from "../../src/domain";
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
test("fixed catalog, fixed-cost toggle, protected names and scoped assignments round-trip through planning and portal", async () => {
  const f = planning();
  const catalog = WorkspaceCatalogSchema.parse(
    await createCatalogRepository(env.DB).read("personal"),
  );
  assert.equal(
    catalog.categories.filter((category) => !category.hidden).length,
    33,
  );
  assert.equal(
    catalog.categories.find(
      (category) => category.id === fixedCategoryId("personal", "aluguel"),
    )?.fixedCost,
    true,
  );
  const categoryId = fixedCategoryId("personal", "casamento");
  const key = { confirmed: true, idempotency_key: "mark-fixed" };
  const updated = await f.call("update_category", {
    ...key,
    color: "#abcdef",
    fixedCost: true,
    icon: "heart",
    id: categoryId,
  });
  assert.deepEqual(
    await f.call("update_category", {
      ...key,
      color: "#abcdef",
      fixedCost: true,
      icon: "heart",
      id: categoryId,
    }),
    updated,
  );
  const fixed = z
    .object({
      data: z.object({ records: z.array(z.object({ id: z.string() })) }),
    })
    .parse(await f.call("get_categories", { fixedCost: true }));
  assert.ok(fixed.data.records.some((row) => row.id === categoryId));
  assert.ok(
    !fixed.data.records.some(
      (row) => row.id === fixedCategoryId("personal", "restaurantes"),
    ),
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
  assert.equal(
    other.categories.find(
      (category) => category.id === fixedCategoryId(otherSpace, "casamento"),
    )?.fixedCost,
    false,
  );
  await assert.rejects(
    () =>
      f.write("update_category", {
        fixedCost: false,
        id: categoryId,
        spaceId: otherSpace,
      }),
    { message: "SPACE_MISMATCH" },
  );
  const app = fixture();
  const cookie = cookies(await login(app));
  const response = await app.request("/api/account/catalog?spaceId=personal", {
    headers: { Cookie: cookie },
  });
  assert.equal(response.status, 200);
  const front = WorkspaceCatalogSchema.parse(await response.json());
  const marked = front.categories.find(
    (category) => category.id === categoryId,
  );
  assert.equal(marked?.color, "#abcdef");
  assert.equal(marked?.fixedCost, true);
  await f.write("update_category", { fixedCost: false, id: categoryId });
  const final = await createCatalogRepository(env.DB).read("personal");
  assert.equal(
    final.categories.find((category) => category.id === categoryId)?.fixedCost,
    false,
  );
  assert.equal(final.categories.length, catalog.categories.length);
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

test("the emergency reserve averages fixed costs and counts only linked balances", async () => {
  const months = closedMonths(new Date().toISOString().slice(0, 10), 3);
  await collect(
    source([
      ...months.map((period, index) =>
        transaction({
          amount: "-300.00",
          category: "Rent",
          date: `${period.month}-05`,
          id: `rent-${index}`,
        }),
      ),
      transaction({
        amount: "-90.00",
        category: "Restaurants",
        date: `${months[0]?.month}-06`,
        id: "dinner",
      }),
    ]),
  );
  const f = planning();
  const read = async () =>
    z
      .object({
        data: z.object({
          averageMinor: z.string(),
          savedMinor: z.string().nullable(),
          sources: z.array(z.object({ id: z.string(), linked: z.boolean() })),
          targetMinor: z.string(),
        }),
      })
      .parse(await f.call("get_emergency_reserve", { personId: "self" })).data;
  const before = await read();
  assert.equal(before.averageMinor, "30000");
  assert.equal(before.targetMinor, "180000");
  assert.equal(before.savedMinor, "0");
  const [account] = before.sources;
  assert.ok(account);
  await f.write("set_emergency_reserve", {
    accountIds: [account.id],
    investmentIds: [],
    months: 3,
    personId: "self",
  });
  const after = await read();
  assert.equal(after.targetMinor, "90000");
  assert.equal(
    after.sources.find((row) => row.id === account.id)?.linked,
    true,
  );
  assert.notEqual(after.savedMinor, "0");
});
