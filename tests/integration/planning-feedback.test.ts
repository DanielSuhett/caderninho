import assert from "node:assert/strict";

import { afterEach, beforeEach, test, vi } from "vitest";
import { z } from "zod/v4";

import { PlanningCommandSchema } from "../../src/contracts";
import { planningOutputSchemas } from "../../src/contracts/planning-results";
import { createPlanningService } from "../../src/worker/planning";
import { createPlanningRepository } from "../../src/worker/planning/repository";
import { collect, setup, source, transaction } from "./fixture";
import { env } from "cloudflare:workers";

beforeEach(setup);
afterEach(() => vi.restoreAllMocks());
const period = { from: "2026-10-01", to: "2026-10-24" };
const payload = z.object({ data: z.record(z.string(), z.unknown()) });
const list = z.object({
  data: z.object({
    cursor: z.string().nullable(),
    records: z.array(
      z.object({ amountMinor: z.string().nullable(), id: z.string() }),
    ),
  }),
});
function fixture() {
  const repository = createPlanningRepository(env.DB);
  let supplied = 0;
  let passes = 0;
  const service = createPlanningService(
    {
      ...repository,
      async *transactions(ids, selection) {
        passes += 1;
        for await (const rows of repository.transactions(ids, selection)) {
          supplied += rows.length;
          yield rows;
        }
      },
    },
    () => new Date("2026-10-24T15:00:00Z"),
  );
  const call = (tool: string, fields: Record<string, unknown> = {}) =>
    service.execute(
      PlanningCommandSchema.parse({ spaceId: "personal", tool, ...fields }),
    );
  const write = (tool: string, fields: Record<string, unknown>) =>
    call(tool, {
      confirmed: true,
      idempotency_key: crypto.randomUUID(),
      ...fields,
    });
  return {
    call,
    measurements: () => ({ passes, supplied }),
    repository,
    reset: () => {
      supplied = 0;
      passes = 0;
    },
    write,
  };
}

function measuredReads() {
  const statements: D1PreparedStatement[] = [];
  const prepare = env.DB.prepare.bind(env.DB);
  vi.spyOn(env.DB, "prepare").mockImplementation((query) => {
    const statement = prepare(query);
    const bind = statement.bind.bind(statement);
    vi.spyOn(statement, "bind").mockImplementation((...values) => {
      const bound = bind(...values);
      if (query.includes('from "transactions"')) {
        statements.push(bound);
      }
      return bound;
    });
    return statement;
  });
  return {
    // Drizzle uses raw(), which omits D1 metadata. Replay the exact bound
    // read-only statements against the unchanged fixture to obtain scan counts.
    async rowsRead() {
      const results = await env.DB.batch(statements);
      return results.reduce((sum, result) => sum + result.meta.rows_read, 0);
    },
    statements,
  };
}

async function seed(outside: number) {
  await env.DB.prepare(`WITH RECURSIVE records(i) AS (
    VALUES(0) UNION ALL SELECT i+1 FROM records WHERE i<?
  ) INSERT INTO transactions(id,account_id,date,status,direction,currency,amount_minor,description)
  SELECT printf('history%06d',i),'a','2020-01-01','POSTED','DEBIT','BRL','100','Synthetic' FROM records`)
    .bind(outside - 1)
    .run();
}

test.each([1000, 10_000])(
  "effective selections stay bounded with %i unrelated transactions",
  async (outside) => {
    await collect(
      source(
        Array.from({ length: 10 }, (_, i) =>
          transaction({
            category: "Food and drinks",
            date: "2026-10-10",
            id: `recent${i}`,
          }),
        ),
      ),
    );
    const f = fixture();
    const reads = measuredReads();
    await seed(outside);
    f.reset();
    reads.statements.length = 0;
    await f.call("get_accounts");
    assert.deepEqual(f.measurements(), { passes: 0, supplied: 0 });
    assert.deepEqual(reads.statements, []);
    async function measure(tool: string) {
      f.reset();
      reads.statements.length = 0;
      await f.call(tool, period);
      assert.deepEqual(f.measurements(), { passes: 1, supplied: 10 });
      assert.ok(reads.statements.length > 0);
      const rowsRead = await reads.rowsRead();
      assert.ok(
        rowsRead >= 10 && rowsRead <= 30,
        `${tool}: D1 read ${rowsRead}`,
      );
    }
    await measure("get_spending_by_category");
    await measure("get_overview");
    await measure("get_spending_comparison");
    f.reset();
    reads.statements.length = 0;
    const first = list.parse(
      await f.call("get_transactions", {
        ...period,
        limit: 5,
        order: "date_desc",
      }),
    );
    assert.equal(first.data.records.length, 5);
    assert.ok(first.data.cursor);
    assert.deepEqual(f.measurements(), { passes: 1, supplied: 6 });
    assert.ok(reads.statements.length > 0);
    const rowsRead = await reads.rowsRead();
    assert.ok(rowsRead >= 6 && rowsRead <= 30, `page: D1 read ${rowsRead}`);
    const second = list.parse(
      await f.call("get_transactions", {
        ...period,
        cursor: first.data.cursor,
        limit: 5,
        order: "date_desc",
      }),
    );
    assert.equal(
      new Set(
        [...first.data.records, ...second.data.records].map((row) => row.id),
      ).size,
      10,
    );
    assert.equal(second.data.cursor, null);
  },
);

test("effective pagination preserves moved dates, account edits, deletions and manual entries", async () => {
  await collect(
    source([
      transaction({ date: "2020-01-01", id: "moved-in" }),
      transaction({ date: "2026-10-10", id: "moved-out" }),
      transaction({ date: "2026-10-11", id: "deleted" }),
      transaction({ date: "2026-10-12", id: "unchanged" }),
    ]),
  );
  const f = fixture();
  await f.write("edit_transaction", { date: "2026-10-13", id: "moved-in" });
  await f.write("edit_transaction", { date: "2020-01-01", id: "moved-out" });
  await f.write("delete_transaction", { id: "deleted" });
  const manual = z.object({ id: z.string() }).parse(
    await f.write("create_manual_account", {
      currency: "BRL",
      name: "Local",
      type: "BANK",
    }),
  );
  const entry = z.object({ id: z.string() }).parse(
    await f.write("create_transaction", {
      accountId: manual.id,
      amountMinor: "75",
      date: "2026-10-14",
      description: "Manual",
      direction: "DEBIT",
    }),
  );
  async function checkPages(order: "id" | "date_desc") {
    async function pages(cursor?: string): Promise<string[]> {
      const result = list.parse(
        await f.call("get_transactions", {
          ...period,
          limit: 1,
          order,
          ...(cursor && { cursor }),
        }),
      );
      const ids = result.data.records.map((row) => row.id);
      return result.data.cursor
        ? [...ids, ...(await pages(result.data.cursor))]
        : ids;
    }
    assert.deepEqual(
      (await pages()).toSorted(),
      ["moved-in", "unchanged", entry.id].toSorted(),
    );
  }
  await checkPages("id");
  await checkPages("date_desc");
  const before = await f.repository.read();
  before.state.edits.push({
    accountId: manual.id,
    id: "unchanged",
    manual: false,
  });
  // Persist through the same atomic repository boundary used by local edits.
  const original = await f.repository.read();
  await f.repository.commit({
    before: original,
    digest: "synthetic",
    key: "move-account",
    now: "2026-10-24T00:00:00Z",
    result: {},
    state: before.state,
  });
  const selected = list.parse(
    await f.call("get_transactions", {
      ...period,
      accountId: manual.id,
      limit: 5,
      order: "date_desc",
    }),
  );
  assert.deepEqual(
    selected.data.records.map((row) => row.id),
    [entry.id, "unchanged"],
  );
});

test("summary, series and detail share filters and expose exact readable money and comparison dates", async () => {
  await collect(
    source([
      transaction({ amount: "-9999999999999999999999999999.99", id: "large" }),
      transaction({
        amount: "-12.34",
        category: null,
        date: "2026-10-02",
        id: "unknown-category",
      }),
      transaction({
        amount: null,
        category: null,
        date: "2026-10-03",
        id: "unknown-amount",
      }),
    ]),
  );
  const f = fixture();
  const category = z.object({ id: z.string() }).parse(
    await f.write("create_category", {
      kind: "expense",
      name: "Alimentação fictícia",
    }),
  );
  await f.write("edit_transaction", { category: category.id, id: "large" });
  const filters = {
    ...period,
    accountId: "a",
    categoryId: category.id,
    currency: "BRL",
    direction: "DEBIT",
    text: "Synthetic",
  };
  const result = await f.call("get_spending_by_category", filters);
  assert.ok(
    planningOutputSchemas.get("get_spending_by_category")?.safeParse(result)
      .success,
  );
  const summary = payload.parse(result).data;
  const groups = z
    .array(
      z.object({
        amountMinor: z.string(),
        categoryName: z.string(),
        formattedAmount: z.string(),
        scale: z.number(),
      }),
    )
    .parse(summary.groups);
  assert.equal(groups[0]?.amountMinor, "999999999999999999999999999999");
  assert.equal(groups[0]?.categoryName, "Alimentação fictícia");
  assert.equal(
    groups[0]?.formattedAmount,
    "BRL 9.999.999.999.999.999.999.999.999.999,99",
  );
  assert.equal(groups[0]?.scale, 2);
  const details = list.parse(await f.call("get_transactions", filters));
  assert.equal(details.data.records.length, 1);
  const chart = await f.call("generate_chart", {
    ...filters,
    includeSvg: false,
    type: "bar",
  });
  assert.ok(
    planningOutputSchemas.get("generate_chart")?.safeParse(chart).success,
  );
  assert.deepEqual(payload.parse(chart).data.groups, summary.groups);
  assert.deepEqual(payload.parse(chart).data.charts, []);
  assert.deepEqual(payload.parse(chart).data.selection, summary.selection);
  const unclassified = z
    .array(
      z.object({
        knownUnclassifiedMinor: z.string(),
        unclassifiedMinor: z.string().nullable(),
        unclassifiedUnknownAmountCount: z.number(),
      }),
    )
    .parse(
      payload.parse(await f.call("get_spending_by_category", period)).data
        .totals,
    );
  assert.equal(unclassified[0]?.knownUnclassifiedMinor, "1234");
  assert.equal(unclassified[0]?.unclassifiedMinor, null);
  assert.equal(unclassified[0]?.unclassifiedUnknownAmountCount, 1);
  const compared = await f.call("get_spending_comparison", {
    ...period,
    comparison: "previous_month",
  });
  assert.ok(
    planningOutputSchemas.get("get_spending_comparison")?.safeParse(compared)
      .success,
  );
  const previous = z
    .object({ from: z.string(), to: z.string() })
    .parse(payload.parse(compared).data.previous);
  assert.deepEqual(previous, { from: "2026-09-01", to: "2026-09-24" });
  const custom = await f.call("get_spending_comparison", {
    ...period,
    comparison: "explicit",
    previousFrom: "2025-10-01",
    previousTo: "2025-10-24",
  });
  assert.equal(
    z.object({ from: z.string() }).parse(payload.parse(custom).data.previous)
      .from,
    "2025-10-01",
  );
  await assert.rejects(
    () =>
      f.call("get_spending_comparison", { ...period, comparison: "explicit" }),
    { message: "INVALID_PERIOD" },
  );
  await assert.rejects(
    () => f.call("get_overview", { ...period, accountId: "missing" }),
    { message: "NOT_FOUND" },
  );
});

test("coverage belongs to the selected owner and catalog reads skip unrelated planning families", async () => {
  await collect(source([transaction()]));
  await env.DB.prepare(
    "INSERT INTO people(id,name) VALUES('other','Outra pessoa')",
  ).run();
  await env.DB.prepare(
    "INSERT INTO connections(id) VALUES('incomplete')",
  ).run();
  await env.DB.prepare(
    "UPDATE connection_owners SET person_id='other' WHERE connection_id='incomplete'",
  ).run();
  const f = fixture();
  const envelope = z.object({
    coverage: z.object({ connectionIds: z.array(z.string()) }),
    oldestLastSuccessAt: z.string().nullable(),
    partial: z.boolean(),
  });
  const self = envelope.parse(
    await f.call("get_overview", { ...period, personId: "self" }),
  );
  assert.equal(self.partial, false);
  assert.ok(self.oldestLastSuccessAt);
  assert.deepEqual(self.coverage.connectionIds, ["c"]);
  const other = envelope.parse(
    await f.call("get_overview", { ...period, personId: "other" }),
  );
  assert.equal(other.partial, true);
  assert.equal(other.oldestLastSuccessAt, null);
  assert.deepEqual(other.coverage.connectionIds, ["incomplete"]);
  await f.write("create_space", {
    color: "#123456",
    currency: "BRL",
    icon: "home",
    name: "Outro espaço",
    type: "family",
  });
  const spaces = z
    .object({
      data: z.object({
        records: z.array(z.object({ id: z.string(), name: z.string() })),
      }),
    })
    .parse(await f.call("get_spaces"));
  const target = spaces.data.records.find(
    (space) => space.name === "Outro espaço",
  );
  assert.ok(target);
  await f.write("move_transactions", { ids: ["t"], targetSpaceId: target.id });
  const moved = envelope.parse(
    await f.call("get_overview", {
      ...period,
      accountId: "a",
      spaceId: target.id,
    }),
  );
  assert.deepEqual(moved.coverage.connectionIds, ["c"]);
  assert.equal(moved.partial, false);
  const prepare = vi.spyOn(env.DB, "prepare");
  await f.call("get_tags");
  const queries = prepare.mock.calls.map(([query]) => query).join("\n");
  assert.equal(queries.includes('from "planning_loans"'), false);
  assert.equal(queries.includes('from "planning_edits"'), false);
  assert.equal(queries.includes('from "planning_tags"'), true);
});
