import assert from "node:assert/strict";
import { test } from "node:test";

import { avatarFilterHref } from "../account/identity-filters";
import { demoMonthly, demoOverview, scopedDemoData } from "../demo-data";
import { createDemoSession } from "../demo-session";

test("avatar links replace account scope, reset pagination and retain independent filters", () => {
  const route =
    "/account/transactions?space=family&from=2026-10-01&to=2026-10-31&currency=USD&text=caf%C3%A9&cursor=old&accountId=one&person=ana";
  const target = avatarFilterHref(route, "institutionId", "bank");
  assert.ok(target);
  const url = new URL(target.href, "https://example.test");
  assert.equal(target.selected, false);
  assert.deepEqual(Object.fromEntries(url.searchParams), {
    currency: "USD",
    from: "2026-10-01",
    institutionId: "bank",
    person: "ana",
    space: "family",
    text: "café",
    to: "2026-10-31",
  });
  const brand = avatarFilterHref(target.href, "cardBrand", "American Express");
  assert.ok(brand);
  assert.equal(
    new URL(brand.href, url).searchParams.get("cardBrand"),
    "AMERICANEXPRESS",
  );
  const cleared = avatarFilterHref(brand.href, "cardBrand", "amex");
  assert.equal(cleared?.selected, true);
  assert.equal(cleared?.href, target.href);
  assert.equal(avatarFilterHref("/account/rules", "person", "ana"), null);
  assert.equal(avatarFilterHref("/demo", "cardBrand", "--"), null);
});

test("demo bank filters include all bank accounts and cards while the same scope feeds summary and monthly totals", async () => {
  const session = createDemoSession();
  const bank = scopedDemoData(session.view(), { institutionId: "260" });
  assert.deepEqual(
    bank.accounts.map((row) => row.id),
    ["demo-reserve", "demo-card", "demo-bank-2"],
  );
  assert.ok(bank.records.length);
  assert.ok(
    bank.records.every((row) =>
      bank.accounts.some((account) => account.id === row.accountId),
    ),
  );
  const overview = demoOverview("2026-10", bank);
  const monthly = demoMonthly("2026-10", bank);
  assert.equal(
    overview.totals[0]?.expenseMinor,
    monthly.groups.find(
      (row) => row.group === "2026-10" && row.currency === "BRL",
    )?.amountMinor,
  );
  const brand = scopedDemoData(session.view(), { cardBrand: "master-card" });
  assert.deepEqual(
    brand.accounts.map((row) => row.id),
    ["demo-card"],
  );
  const cards = await session.api.query(
    { cardBrand: "visa", month: "2026-10", tool: "get_portal_cards" },
    "synthetic",
    new AbortController().signal,
  );
  assert.deepEqual(
    cards.data.accounts.map((row) => row.id),
    ["demo-card-extra"],
  );
  const shared = scopedDemoData(session.view(), {
    institutionId: "260",
    personId: "demo-person-2",
  });
  assert.ok(shared.records.length);
  assert.ok(shared.records.every((row) => row.accountId === "demo-bank-2"));
});
