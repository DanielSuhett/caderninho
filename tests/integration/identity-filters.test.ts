import assert from "node:assert/strict";

import { afterEach, beforeEach, test, vi } from "vitest";

import {
  FinancialOverviewResponseSchema,
  InstitutionCatalogSchema,
  InvestmentListSchema,
  MonthlySpendingResponseSchema,
  PlanningCommandSchema,
  PortalCardsQuerySchema,
  PortalResponseSchema,
  PortalTransactionQuerySchema,
} from "../../src/contracts";
import { demoInvestments } from "../../src/fixtures/investments";
import { createHouseholdRepository } from "../../src/worker/household/repository";
import { createInstallationRepository } from "../../src/worker/installation/repository";
import { createPlanningService } from "../../src/worker/planning";
import { createPlanningRepository } from "../../src/worker/planning/repository";
import { command, cookies, fixture, login } from "./access-fixture";
import { account, collect, setup, source, transaction } from "./fixture";
import { env } from "cloudflare:workers";

beforeEach(setup);
afterEach(() => vi.unstubAllGlobals());
const period = { from: "2026-10-01", spaceId: "personal", to: "2026-10-31" };
function service() {
  return createPlanningService(
    createPlanningRepository(env.DB),
    () => new Date("2026-10-24T15:00:00Z"),
  );
}
async function seed() {
  const accounts = [
    account({ id: "a-bank", itemId: "a" }),
    account({
      creditData: { brand: "American Express" },
      id: "a-card",
      itemId: "a",
      type: "CREDIT",
    }),
    account({ id: "b-bank", itemId: "b" }),
    account({
      creditData: { brand: "AMEX" },
      id: "b-card",
      itemId: "b",
      type: "CREDIT",
    }),
    account({
      creditData: { brand: "VISA" },
      id: "b-visa",
      itemId: "b",
      type: "CREDIT",
    }),
    account({
      creditData: { brand: "AMEX" },
      id: "other-card",
      itemId: "other",
      type: "CREDIT",
    }),
  ];
  const rows = [
    ...Array.from({ length: 70 }, (_, i) =>
      transaction({
        accountId: "a-bank",
        amount: "-1",
        id: `a-${String(i).padStart(3, "0")}`,
      }),
    ),
    ...accounts
      .filter((row) => row.id !== "a-bank")
      .map((row) =>
        transaction({ accountId: row.id, amount: "-10", id: row.id }),
      ),
  ];
  const importConnection = (id: string) =>
    collect(source(rows, accounts), "2026-10-01T00:00:00Z", id);
  await importConnection("a");
  await importConnection("b");
  await importConnection("other");
  const repository = createHouseholdRepository(env.DB);
  await Promise.all(
    ["a", "b", "other"].map((id) =>
      repository.institution(id, {
        id: id === "b" ? "202" : "201",
        logoUrl: null,
        name: id === "b" ? "Beta" : "Alpha",
      }),
    ),
  );
  await env.DB.prepare("INSERT INTO people(id,name) VALUES('ana','Ana')").run();
  await env.DB.prepare(
    "UPDATE connection_owners SET person_id='ana' WHERE connection_id='other'",
  ).run();
  return { accounts, rows };
}

test("portal bank scope is applied before pagination and matches overview, chart and the selected owner", async () => {
  await seed();
  const api = service();
  const query = PortalTransactionQuerySchema.parse({
    tool: "get_portal_transactions",
    ...period,
    institutionId: "201",
    limit: 25,
  });
  const first = await api.portalTransactions(query);
  assert.equal(first.data.records.length, 25);
  assert.equal(first.data.uncategorizedCount, 72);
  assert.ok(first.data.cursor);
  const second = await api.portalTransactions({
    ...query,
    cursor: first.data.cursor,
  });
  assert.ok(second.data.cursor);
  const third = await api.portalTransactions({
    ...query,
    cursor: second.data.cursor,
  });
  assert.equal(third.data.cursor, null);
  const ids = [
    ...first.data.records,
    ...second.data.records,
    ...third.data.records,
  ].map((row) => row.id);
  assert.equal(new Set(ids).size, 72);
  assert.ok(ids.includes("a-card"));
  assert.ok(ids.includes("other-card"));
  assert.equal(ids.includes("b-bank"), false);
  assert.deepEqual(
    (
      await api.portalTransactions({ ...query, personId: "ana" })
    ).data.records.map((row) => row.id),
    ["other-card"],
  );
  assert.ok(first.data.cursor);
  await assert.rejects(
    api.portalTransactions({
      ...query,
      cursor: first.data.cursor,
      institutionId: "202",
    }),
    { message: "RESTART_REQUIRED" },
  );
  const app = fixture();
  const cookie = cookies(await login(app));
  const overviewResponse = await command(app, cookie, "query", {
    query: { tool: "get_overview", ...period, institutionId: "201" },
  });
  assert.equal(overviewResponse.status, 200);
  const { data } = FinancialOverviewResponseSchema.parse(
    await overviewResponse.json(),
  );
  assert.deepEqual(data.accounts.map((row) => row.id).sort(), [
    "a-bank",
    "a-card",
    "other-card",
  ]);
  assert.equal(data.totals[0]?.count, 72);
  assert.equal(data.totals[0]?.cashFlowMinor, "-7000");
  const chartResponse = await command(app, cookie, "query", {
    query: {
      tool: "generate_chart",
      ...period,
      groupBy: "month",
      institutionId: "201",
      type: "line",
    },
  });
  assert.equal(chartResponse.status, 200);
  const chart = MonthlySpendingResponseSchema.parse(await chartResponse.json());
  assert.equal(chart.data.totals[0]?.count, 72);
  assert.equal(chart.data.totals[0]?.cashFlowMinor, "-7000");
});

test("brand scope spans institutions, intersects the owner and follows effective account edits", async () => {
  await seed();
  const api = service();
  const query = PortalTransactionQuerySchema.parse({
    tool: "get_portal_transactions",
    ...period,
    cardBrand: "AMEX",
  });
  assert.deepEqual(
    (await api.portalTransactions(query)).data.records
      .map((row) => row.id)
      .sort(),
    ["a-card", "b-card", "other-card"],
  );
  const cardQuery = PortalCardsQuerySchema.parse({
    cardBrand: "american_express",
    month: "2026-10",
    tool: "get_portal_cards",
  });
  const cards = await api.cards(cardQuery);
  assert.deepEqual(cards.data.accounts.map((row) => row.id).sort(), [
    "a-card",
    "b-card",
    "other-card",
  ]);
  assert.deepEqual(
    (await api.cards({ ...cardQuery, personId: "ana" })).data.accounts.map(
      (row) => row.id,
    ),
    ["other-card"],
  );
  assert.deepEqual(
    (await api.cards({ ...cardQuery, institutionId: "missing" })).data.accounts,
    [],
  );
  await api.execute(
    PlanningCommandSchema.parse({
      confirmed: true,
      description: "Effective edited record",
      id: "b-bank",
      idempotency_key: "move-account",
      spaceId: "personal",
      tool: "edit_transaction",
    }),
  );
  await env.DB.prepare(
    "UPDATE planning_edits SET data=json_set(data,'$.accountId','a-card') WHERE id='b-bank'",
  ).run();
  assert.equal(
    (await api.portalTransactions(query)).data.records.find(
      (row) => row.id === "b-bank",
    )?.accountId,
    "a-card",
  );
  assert.equal(
    (
      await api.portalTransactions({ ...query, institutionId: "202" })
    ).data.records.some((row) => row.id === "b-bank"),
    false,
  );
});

test("catalogue association survives reimport and reaches accounts, cards and investments without changing proxy authorization", async () => {
  const { accounts, rows } = await seed();
  const bank = {
    id: "compe:260",
    logoUrl: "/bancos/260.svg",
    name: "Nubank",
  };
  const app = fixture();
  assert.equal(
    (await app.request("/api/account/institutions?profileId=default")).status,
    401,
  );
  const cookie = cookies(await login(app));
  const catalogue = await app.request(
    "/api/account/institutions?profileId=default",
    { headers: { Cookie: cookie } },
  );
  const { records } = InstitutionCatalogSchema.parse(await catalogue.json());
  assert.deepEqual(
    records.find((row) => row.id === bank.id),
    bank,
  );
  const refused = await Promise.all(
    ["200", "compe:999", "unknown"].map((institutionId) =>
      command(app, cookie, "manage", {
        action: "set_connection_institution",
        connectionId: "a",
        institutionId,
      }),
    ),
  );
  assert.deepEqual(
    refused.map((response) => response.status),
    [404, 404, 404],
  );
  assert.equal(
    (
      await command(app, cookie, "manage", {
        action: "set_connection_institution",
        connectionId: "a",
        institutionId: bank.id,
      })
    ).status,
    200,
  );
  await collect(
    source(rows, [...accounts, account({ id: "a-new", itemId: "a" })]),
    "2026-10-02T00:00:00Z",
    "a",
  );
  const state = await createInstallationRepository(env.DB).state();
  const selected = state.connections.find((row) => row.id === "a");
  assert.ok(selected);
  assert.deepEqual(
    Object.values(selected.accounts).map((row) => row.identity?.institution),
    [bank, bank, bank],
  );
  assert.equal(
    selected.accounts["a-card"]?.identity?.cardBrand,
    "American Express",
  );
  const api = service();
  assert.deepEqual(
    (
      await api.cards(
        PortalCardsQuerySchema.parse({
          institutionId: bank.id,
          month: "2026-10",
          tool: "get_portal_cards",
        }),
      )
    ).data.accounts.map((row) => row.id),
    ["a-card"],
  );
  const [template] = demoInvestments;
  assert.ok(template);
  const positions = [
    {
      ...template,
      connectionId: "a",
      id: "fallback-position",
      identity: {
        cardBrand: null,
        institution: { id: "200", logoUrl: null, name: "Meu Pluggy" },
      },
      personId: "self",
    },
    {
      ...template,
      connectionId: "a",
      id: "explicit-position",
      identity: {
        cardBrand: null,
        institution: {
          id: "explicit",
          logoUrl: null,
          name: "Origem explícita",
        },
      },
      personId: "self",
    },
  ];
  await env.DB.batch(
    positions.map((row) =>
      env.DB.prepare(
        "INSERT INTO planning_investments(id,data) VALUES(?,?)",
      ).bind(row.id, JSON.stringify(row)),
    ),
  );
  const result = InvestmentListSchema.parse(
    await api.execute(
      PlanningCommandSchema.parse({
        spaceId: "personal",
        tool: "get_investments",
      }),
    ),
  );
  assert.deepEqual(
    result.data.records.find((row) => row.id === "fallback-position")?.identity
      ?.institution,
    bank,
  );
  assert.equal(
    result.data.records.find((row) => row.id === "explicit-position")?.identity
      ?.institution?.id,
    "explicit",
  );
  assert.equal(
    (
      await command(app, cookie, "manage", {
        action: "set_connection_institution",
        connectionId: "a",
        institutionId: null,
      })
    ).status,
    200,
  );
  const cleared = PortalResponseSchema.parse(
    await (
      await app.request("/api/account", { headers: { Cookie: cookie } })
    ).json(),
  );
  assert.ok(
    Object.values(
      cleared.connections.find((row) => row.id === "a")?.accounts ?? {},
    ).every((row) => row.identity?.institution === null),
  );
});
