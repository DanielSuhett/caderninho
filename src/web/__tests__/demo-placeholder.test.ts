import assert from "node:assert/strict";
import { test } from "node:test";

import {
  overviewRequests,
  transactionRequests,
} from "../account/page-requests";
import { createPlaceholderApi } from "../demo-placeholder";

const origin = "https://synthetic.test";
const { signal } = new AbortController();

test("placeholder reads answer the viewer's scope with demo rows, months away from the demo", async () => {
  const day = "2027-03-15";
  const api = createPlaceholderApi(origin, day);
  const params = new URLSearchParams({
    accountId: "installation-account",
    month: "2027-03",
    person: "installation-person",
    space: "installation-space",
  });
  const overview = overviewRequests(params, day);
  const transactions = transactionRequests(params);
  const [summary, chart, catalog, listing] = await Promise.all([
    api.query(overview.overview, "csrf", signal),
    api.query(overview.chart, "csrf", signal),
    api.catalog(overview.spaceId, signal),
    api.query(transactions.transactions, "csrf", signal),
  ]);
  assert.ok(summary.data.accounts.length > 0);
  assert.ok(chart.data.groups.length > 0);
  assert.ok(catalog.categories.length > 0);
  assert.ok(listing.data.records.length > 0);
});
