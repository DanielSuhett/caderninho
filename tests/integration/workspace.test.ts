import assert from "node:assert/strict";

import { beforeEach, test } from "vitest";

import {
  FinancialOverviewResponseSchema,
  MonthlySpendingResponseSchema,
  PlanningCommandSchema,
  PortalTransactionListSchema,
  SyncHistoryResultSchema,
  TransactionListSchema,
  WorkspaceCatalogSchema,
} from "../../src/contracts";
import { createPlanningService } from "../../src/worker/planning";
import { createPlanningRepository } from "../../src/worker/planning/repository";
import { createSyncRepository } from "../../src/worker/sync/repository";
import { createSyncHistoryRepository } from "../../src/worker/sync/repository/history.repository";
import { command, cookies, fixture, login } from "./access-fixture";
import { account, collect, setup, source, transaction } from "./fixture";
import { env } from "cloudflare:workers";

beforeEach(setup);

test("purchase cursors require a restart when the financial day changes", async () => {
  await collect(
    source([
      transaction({ date: "2026-10-22", id: "old" }),
      transaction({ date: "2026-10-23", id: "current" }),
      transaction({ date: "2026-10-24", id: "next-day" }),
    ]),
  );
  let now = new Date("2026-10-24T02:59:59Z");
  const service = createPlanningService(
    createPlanningRepository(env.DB),
    () => now,
  );
  const input = {
    limit: 1,
    spaceId: "personal",
    tool: "get_transaction_purchases",
  };
  const first = PortalTransactionListSchema.parse(
    await service.execute(PlanningCommandSchema.parse(input)),
  );
  assert.equal(first.data.referenceDay, "2026-10-23");
  assert.equal(first.data.records[0]?.id, "current");
  assert.ok(first.data.cursor);
  now = new Date("2026-10-24T03:00:00Z");
  await assert.rejects(
    service.execute(
      PlanningCommandSchema.parse({ ...input, cursor: first.data.cursor }),
    ),
    { message: "RESTART_REQUIRED" },
  );
  const fresh = PortalTransactionListSchema.parse(
    await service.execute(PlanningCommandSchema.parse(input)),
  );
  assert.equal(fresh.data.referenceDay, "2026-10-24");
  assert.equal(fresh.data.records[0]?.id, "next-day");
});

test("run history survives later imports, preserves admission ownership and paginates without duplicate retries", async () => {
  const history = createSyncHistoryRepository(env.DB);
  const original = await collect(source([transaction()]));
  const repeated = await createSyncRepository(env.DB).admit(
    ["c"],
    "2026-10-01T01:00:00Z",
  );
  assert.equal(repeated[0]?.status, "cooldown");
  await env.DB.prepare("INSERT INTO people(id,name) VALUES('ana','Ana')").run();
  await env.DB.prepare(
    "UPDATE connection_owners SET person_id='ana' WHERE connection_id='c'",
  ).run();
  const newer = await collect(
    source([transaction({ amount: "-25.00" })]),
    "2026-10-02T00:00:00Z",
  );
  const first = SyncHistoryResultSchema.parse(
    await history.query({ limit: 1 }),
  );
  assert.equal(first.records[0]?.id, newer);
  assert.equal(first.records[0]?.personId, "ana");
  assert.equal(first.records[0]?.status, "succeeded");
  assert.ok(first.records[0]?.finishedAt);
  assert.ok(first.cursor);
  const second = await history.query({ cursor: first.cursor, limit: 1 });
  assert.equal(second.records[0]?.id, original);
  assert.equal(second.records[0]?.personId, "self");
  assert.equal(second.cursor, null);
  assert.equal((await history.query({ limit: 25 })).records.length, 2);
  assert.equal(
    (await history.query({ limit: 25, personId: "self" })).records.length,
    1,
  );
  assert.equal(
    (await history.query({ limit: 25, status: "failed" })).records.length,
    0,
  );
  await assert.rejects(history.query({ cursor: '{"id":"bad"}', limit: 1 }));
});

test("durable failures record the committed checkpoint and atomic publication guards do not add history rows", async () => {
  const history = createSyncHistoryRepository(env.DB);
  await assert.rejects(collect(source([transaction({ amount: "bad" })])));
  const page = await history.query({ limit: 25, status: "failed" });
  assert.equal(page.records.length, 1);
  assert.equal(page.records[0]?.status, "failed");
  assert.equal(page.records[0]?.phase, "transactions");
  assert.equal(page.records[0]?.sequence, 1);
  assert.ok(page.records[0]?.error);
  const repo = createSyncRepository(env.DB);
  const run = await repo.read(page.records[0]?.id ?? "missing");
  await assert.rejects(
    repo.publish({
      done: true,
      next: run.checkpoint,
      now: "2026-10-01T00:00:00Z",
      run,
    }),
  );
  assert.deepEqual((await history.query({ limit: 25 })).records, page.records);
});

test("workspace routes require session, query CSRF and an explicit read-only tool allowlist", async () => {
  const app = fixture();
  const responses = await Promise.all(
    ["/api/account/catalog", "/api/account/history"].map((path) =>
      app.request(path),
    ),
  );
  assert.deepEqual(
    responses.map((response) => response.status),
    [401, 401],
  );
  assert.equal((await app.request("/account/transactions")).status, 302);
  const cookie = cookies(await login(app));
  const page = await app.request("/account/rules", {
    headers: { Cookie: cookie },
  });
  assert.equal(page.status, 200);
  assert.ok((await page.text()).includes("account-root"));
  const catalog = await app.request("/api/account/catalog", {
    headers: { Cookie: cookie },
  });
  assert.equal(catalog.headers.get("Cache-Control"), "no-store");
  assert.equal(
    WorkspaceCatalogSchema.parse(await catalog.json()).spaces[0]?.id,
    "personal",
  );
  const rejected = await command(app, cookie, "query", {
    query: { name: "Bad", spaceId: "personal", tool: "create_rule" },
  });
  assert.equal(rejected.status, 400);
  const csrf = await command(app, cookie, "query", {
    csrf: "wrong",
    query: { tool: "get_transactions" },
  });
  assert.equal(csrf.status, 403);
});

test("transaction page reads exact effective amounts, person filters and date order across page boundaries", async () => {
  await collect(
    source(
      Array.from({ length: 65 }, (_, i) =>
        transaction({
          amount: "-9007199254740993.01",
          date: `2026-10-${String(1 + (i % 20)).padStart(2, "0")}`,
          id: `t-${String(i).padStart(3, "0")}`,
        }),
      ),
      [account()],
    ),
  );
  const app = fixture();
  const cookie = cookies(await login(app));
  const query = {
    limit: 50,
    order: "date_desc",
    personId: "self",
    spaceId: "personal",
    tool: "get_transactions",
  };
  const first = TransactionListSchema.parse(
    await (await command(app, cookie, "query", { query })).json(),
  );
  assert.equal(first.data.records.length, 50);
  assert.equal(first.data.records[0]?.date, "2026-10-20");
  assert.equal(first.data.records[0]?.amountMinor, "-900719925474099301");
  assert.ok(first.data.cursor);
  const second = TransactionListSchema.parse(
    await (
      await command(app, cookie, "query", {
        query: { ...query, cursor: first.data.cursor },
      })
    ).json(),
  );
  assert.equal(second.data.records.length, 15);
  const rows = [...first.data.records, ...second.data.records];
  assert.equal(new Set(rows.map((r) => r.id)).size, 65);
  assert.deepEqual(
    rows.map((r) => `${r.date}:${r.id}`),
    rows
      .map((r) => `${r.date}:${r.id}`)
      .sort()
      .reverse(),
  );
});

test("portal groups card installments before pagination and keeps future and pending distinct", async () => {
  const purchaseDate = "2024-01-12";
  await collect(
    source(
      [
        transaction({
          accountId: "a",
          creditCardMetadata: {
            cardNumber: "1234",
            installmentNumber: 1,
            purchaseDate,
            totalInstallments: 3,
          },
          date: "2024-01-12",
          description: "Villas De Paraty",
          id: "card-1",
        }),
        transaction({
          accountId: "a",
          creditCardMetadata: {
            cardNumber: "1234",
            installmentNumber: 2,
            purchaseDate,
            totalInstallments: 3,
          },
          date: "2024-02-23",
          description: "Villas De Paraty",
          id: "card-2",
          status: "PENDING",
        }),
        transaction({
          accountId: "a",
          creditCardMetadata: {
            cardNumber: "1234",
            installmentNumber: 3,
            purchaseDate,
            totalInstallments: 3,
          },
          date: "2099-03-26",
          description: "Villas De Paraty",
          id: "card-3",
          status: "PENDING",
        }),
        transaction({
          accountId: "b",
          date: "2099-04-01",
          description: "Scheduled bank payment",
          id: "future-bank",
          status: "PENDING",
        }),
        transaction({
          accountId: "b",
          date: "2024-01-01",
          description: "Past bank payment",
          id: "past-bank",
        }),
      ],
      [
        account({ name: "Card", type: "CREDIT" }),
        account({ id: "b", name: "Bank", type: "BANK" }),
      ],
    ),
  );
  const app = fixture();
  const cookie = cookies(await login(app));
  const query = {
    future: false,
    limit: 1,
    order: "date_desc",
    spaceId: "personal",
    tool: "get_portal_transactions",
  };
  const first = PortalTransactionListSchema.parse(
    await (await command(app, cookie, "query", { query })).json(),
  );
  assert.equal(first.data.records.length, 1);
  assert.equal(first.data.records[0]?.anchorDate, purchaseDate);
  assert.equal(first.data.records[0]?.anchorKind, "purchase");
  assert.deepEqual(
    first.data.records[0]?.installments.map((row) => [
      row.id,
      row.installmentNumber,
      row.status,
    ]),
    [
      ["card-1", 1, "POSTED"],
      ["card-2", 2, "PENDING"],
      ["card-3", 3, "PENDING"],
    ],
  );
  assert.ok(first.data.cursor);
  const second = PortalTransactionListSchema.parse(
    await (
      await command(app, cookie, "query", {
        query: { ...query, cursor: first.data.cursor },
      })
    ).json(),
  );
  assert.deepEqual(
    second.data.records.map((row) => row.id),
    ["past-bank"],
  );
  const upcoming = PortalTransactionListSchema.parse(
    await (
      await command(app, cookie, "query", {
        query: { ...query, future: true, limit: 50 },
      })
    ).json(),
  );
  assert.deepEqual(
    upcoming.data.records.map((row) => row.id),
    ["future-bank"],
  );
  const pending = PortalTransactionListSchema.parse(
    await (
      await command(app, cookie, "query", {
        query: {
          ...query,
          from: "2024-01-12",
          limit: 50,
          status: "PENDING",
          to: "2024-01-12",
        },
      })
    ).json(),
  );
  assert.deepEqual(
    pending.data.records[0]?.installments.map((row) => row.id),
    ["card-1", "card-2", "card-3"],
  );
  assert.equal(pending.data.records.length, 1);
  assert.equal(
    (
      await command(app, cookie, "query", {
        query: { ...query, cursor: first.data.cursor, status: "PENDING" },
      })
    ).status,
    409,
  );
});

test("ambiguous card purchases stay separate instead of merging equal merchants", async () => {
  await collect(
    source(
      [1, 2, 3, 4].map((number) =>
        transaction({
          creditCardMetadata: {
            installmentNumber: number % 2 ? 1 : 2,
            purchaseDate: "2024-05-12",
            totalInstallments: 2,
          },
          date: number % 2 ? "2024-05-12" : "2024-06-12",
          description: "Same merchant",
          id: `ambiguous-${number}`,
        }),
      ),
      [account({ type: "CREDIT" })],
    ),
  );
  const app = fixture();
  const cookie = cookies(await login(app));
  const page = PortalTransactionListSchema.parse(
    await (
      await command(app, cookie, "query", {
        query: {
          future: false,
          limit: 50,
          order: "date_desc",
          spaceId: "personal",
          tool: "get_portal_transactions",
        },
      })
    ).json(),
  );
  assert.equal(page.data.records.length, 4);
  assert.ok(page.data.records.every((row) => row.installments.length === 0));
});

test("card installments without purchase date use the first observed installment month", async () => {
  await collect(
    source(
      [
        ["first", 1, "2024-12-26"],
        ["second", 2, "2025-01-26"],
        ["third", 3, "2025-02-23"],
      ].map(([id, installmentNumber, date]) =>
        transaction({
          amount: "-390.66",
          creditCardMetadata: {
            installmentNumber: Number(installmentNumber),
            totalInstallments: 3,
          },
          date: String(date),
          description: "Villas De Paraty",
          id: String(id),
        }),
      ),
      [account({ type: "CREDIT" })],
    ),
  );
  const app = fixture();
  const cookie = cookies(await login(app));
  const page = PortalTransactionListSchema.parse(
    await (
      await command(app, cookie, "query", {
        query: {
          future: false,
          limit: 50,
          order: "date_desc",
          spaceId: "personal",
          tool: "get_portal_transactions",
        },
      })
    ).json(),
  );
  assert.equal(page.data.records.length, 1);
  assert.equal(page.data.records[0]?.anchorDate, "2024-12-26");
  assert.equal(page.data.records[0]?.anchorKind, "first_seen");
  assert.equal(page.data.records[0]?.installments.length, 3);
});

test("owner dashboard reads the whole period with exact money and separate currencies beyond transaction pagination", async () => {
  await collect(
    source(
      [
        ...Array.from({ length: 65 }, (_, index) =>
          transaction({
            amount: "-9007199254740993.01",
            id: `dashboard-${index}`,
          }),
        ),
        transaction({
          accountId: "usd",
          amount: "-5",
          currencyCode: "USD",
          id: "usd",
        }),
      ],
      [account(), account({ currencyCode: "USD", id: "usd" })],
    ),
  );
  const app = fixture();
  const cookie = cookies(await login(app));
  const period = { from: "2026-10-01", spaceId: "personal", to: "2026-10-31" };
  const response = await command(app, cookie, "query", {
    query: { tool: "get_overview", ...period },
  });
  assert.equal(response.status, 200);
  const { data } = FinancialOverviewResponseSchema.parse(await response.json());
  const total = data.totals.find((row) => row.currency === "BRL");
  assert.equal(total?.count, 65);
  assert.equal(total?.cashFlowMinor, (-900719925474099301n * 65n).toString());
  assert.equal(
    data.totals.find((row) => row.currency === "USD")?.cashFlowMinor,
    "-500",
  );
  assert.equal(data.accounts.length, 2);
  const chart = await command(app, cookie, "query", {
    query: {
      tool: "generate_chart",
      ...period,
      groupBy: "month",
      type: "line",
    },
  });
  assert.equal(chart.status, 200);
  assert.equal(
    MonthlySpendingResponseSchema.parse(await chart.json()).data.totals.find(
      (row) => row.currency === "BRL",
    )?.cashFlowMinor,
    total?.cashFlowMinor,
  );
  assert.equal(
    (
      await command(app, cookie, "query", {
        csrf: "wrong",
        query: { tool: "get_overview", ...period },
      })
    ).status,
    403,
  );
});
