import assert from "node:assert/strict";
import { test } from "node:test";

import { ChartType, SpendingGroupBy } from "../../domain";
import { demoReferenceDay } from "../../fixtures/finance";
import { HttpRequestError } from "../../shared";
import { createAccountApi } from "../account/account-api";
import { createDemoFetch } from "../demo-api";

const origin = "https://synthetic.test";
const { signal } = new AbortController();
function demoApi() {
  return createAccountApi(origin, createDemoFetch(origin));
}

test("the real account client reads the demo snapshot and every workspace page through the mock transport", async () => {
  const api = demoApi();
  const snapshot = await api.read(signal);
  assert.equal(snapshot.connections.length, 2);
  assert.ok(snapshot.connections.every((row) => row.hasTransactions));
  const scope = { spaceId: "personal" };
  const period = { from: "2026-10-01", to: "2026-10-31" };
  const [
    overview,
    monthly,
    accounts,
    transactions,
    cards,
    investments,
    catalog,
    history,
    audit,
  ] = await Promise.all([
    api.query(
      { ...scope, ...period, tool: "get_overview" },
      snapshot.csrf,
      signal,
    ),
    api.query(
      {
        ...scope,
        from: "2026-05-01",
        groupBy: SpendingGroupBy.month,
        to: period.to,
        tool: "generate_chart",
        type: ChartType.line,
      },
      snapshot.csrf,
      signal,
    ),
    api.query({ ...scope, tool: "get_accounts" }, snapshot.csrf, signal),
    api.query(
      { ...scope, limit: 6, tool: "get_portal_transactions" },
      snapshot.csrf,
      signal,
    ),
    api.query(
      { ...scope, currency: "BRL", month: "2026-10", tool: "get_portal_cards" },
      snapshot.csrf,
      signal,
    ),
    api.query({ ...scope, tool: "get_investments" }, snapshot.csrf, signal),
    api.catalog(scope.spaceId, signal),
    api.history(new URLSearchParams(), signal),
    api.audit(new URLSearchParams(), signal),
  ]);
  assert.equal(overview.data.referenceDay, demoReferenceDay);
  assert.equal(
    overview.data.totals.find((row) => row.currency === "BRL")?.expenseMinor,
    "439381",
  );
  assert.equal(monthly.data.groupBy, "month");
  assert.ok(monthly.data.groups.length >= 6);
  assert.ok(accounts.data.records.length > 0);
  assert.equal(transactions.data.records.length, 6);
  assert.ok(transactions.data.cursor);
  assert.ok(cards.data.accounts.length > 0);
  assert.ok(investments.data.records.length > 0);
  assert.ok(catalog.rules.length > 0);
  assert.equal(history.records.length, 2);
  assert.equal(audit.grants.length, 0);
});

test("demo transactions paginate with the real client, preserve complete installments and isolate filters", async () => {
  const api = demoApi();
  const { csrf } = await api.read(signal);
  const query = {
    limit: 4,
    spaceId: "personal",
    tool: "get_portal_transactions",
  } as const;
  const first = await api.query(query, csrf, signal);
  assert.ok(first.data.cursor);
  const next = await api.query(
    { ...query, cursor: first.data.cursor },
    csrf,
    signal,
  );
  assert.equal(
    new Set([...first.data.records, ...next.data.records].map((row) => row.id))
      .size,
    8,
  );
  const search = await api.query(
    { ...query, text: "Ferramentas de desenvolvimento" },
    csrf,
    signal,
  );
  assert.equal(search.data.records.length, 1);
  assert.equal(search.data.records[0]?.installments.length, 12);
  const person = await api.query(
    { ...query, personId: "demo-person-2" },
    csrf,
    signal,
  );
  assert.ok(
    person.data.records.every((row) => row.personId === "demo-person-2"),
  );
  const empty = await api.query({ ...query, from: "2030-01-01" }, csrf, signal);
  assert.deepEqual(empty.data.records, []);
});

test("writes through the real client invalidate cached demo queries and stay in their own session", async () => {
  const api = demoApi();
  const { csrf } = await api.read(signal);
  const query = {
    spaceId: "personal",
    tool: "get_portal_transactions",
    uncategorized: true,
  } as const;
  const before = await api.query(query, csrf, signal);
  const [row] = before.data.records;
  assert.ok(row);
  const command = {
    category: "market",
    confirmed: true,
    expected_revision: before.data.revision ?? 0,
    idempotency_key: "shared-client-categorize",
    ids: [row.id],
    spaceId: "personal",
    tool: "batch_edit_transactions",
  } as const;
  await api.planning({ ...command, ids: [...command.ids] }, csrf, signal);
  await api.planning({ ...command, ids: [...command.ids] }, csrf, signal);
  await assert.rejects(
    api.planning(
      {
        ...command,
        category: null,
        idempotency_key: "stale-write",
        ids: [...command.ids],
      },
      csrf,
      signal,
    ),
    (error) =>
      error instanceof HttpRequestError && error.failure.status === 409,
  );
  const after = await api.query(query, csrf, signal);
  assert.equal(after.data.revision, (before.data.revision ?? 0) + 1);
  assert.equal(
    after.data.records.some((item) => item.id === row.id),
    false,
  );
  const isolated = await demoApi().query(query, csrf, signal);
  assert.equal(
    isolated.data.records.some((item) => item.id === row.id),
    true,
  );
  assert.equal(isolated.data.revision, before.data.revision);
});

test("the demo transport rejects external and unknown endpoints and respects cancellation", async () => {
  const fetcher = createDemoFetch(origin);
  const blocked = await Promise.all(
    [
      "https://other.test/api/account",
      `${origin}/api/private`,
      `${origin}/api/account/connect-token`,
    ].map((url) => fetcher(url)),
  );
  for (const response of blocked) {
    assert.equal(response.status, 404);
  }
  const aborted = AbortSignal.abort(new Error("demo cancelled"));
  await assert.rejects(fetcher(`${origin}/api/account`, { signal: aborted }), {
    message: "demo cancelled",
  });
});
