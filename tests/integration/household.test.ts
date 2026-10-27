import assert from "node:assert/strict";

import { afterEach, beforeEach, test, vi } from "vitest";
import { z } from "zod/v4";

import {
  HouseholdCommandSchema,
  InvestmentListSchema,
  PlanningCommandSchema,
  PortalResponseSchema,
} from "../../src/contracts";
import { scopedSourceId } from "../../src/domain";
import { createFinancialService } from "../../src/worker/finance";
import { createFinancialRepository } from "../../src/worker/finance/repository";
import { createHouseholdService } from "../../src/worker/household";
import { createHouseholdRepository } from "../../src/worker/household/repository";
import { createCredentialVault } from "../../src/worker/household/vault.adapter";
import { createInstallationService } from "../../src/worker/installation";
import { createInstallationRepository } from "../../src/worker/installation/repository";
import { createPlanningService } from "../../src/worker/planning";
import { createPlanningRepository } from "../../src/worker/planning/repository";
import { createProfileSource } from "../../src/worker/pluggy";
import { createSyncRepository } from "../../src/worker/sync/repository";
import { mockNetwork, syntheticJwt } from "../support/network";
import { command, cookies, fixture, login } from "./access-fixture";
import { account, collect, setup, transaction } from "./fixture";
import { env } from "cloudflare:workers";

beforeEach(setup);
afterEach(() => vi.unstubAllGlobals());
test("connection setup creates its owner with the validated profile and exposes the new ID", async () => {
  provider();
  const app = fixture();
  const cookie = cookies(await login(app));
  const response = await command(app, cookie, "manage", {
    action: "create_profile",
    clientId: "second",
    clientSecret: "synthetic-private-secret",
    name: "Pluggy Ana",
    person: { name: "Ana" },
  });
  assert.equal(response.status, 200);
  const profileId = identify(await response.json());
  const state = await createHouseholdRepository(app.config.DB).read();
  const profile = state.profiles.find((p) => p.id === profileId);
  assert.ok(profile);
  assert.equal(
    state.people.find((p) => p.id === profile.personId)?.name,
    "Ana",
  );
  assert.ok(profile.credentialRef);
  assert.equal(state.people.length, 2);
  assert.equal(state.profiles.length, 2);
});

test("rejected setup credentials report a safe cause and leave no owner or profile behind", async () => {
  mockNetwork(
    async () => new Response("private provider failure", { status: 401 }),
  );
  const app = fixture();
  const cookie = cookies(await login(app));
  const response = await command(app, cookie, "manage", {
    action: "create_profile",
    clientId: "invalid-synthetic-client",
    clientSecret: "invalid-synthetic-secret",
    name: "Pluggy Ana",
    person: { name: "Ana" },
  });
  assert.equal(response.status, 400);
  assert.equal(response.headers.get("X-Caderninho-Error"), "UPSTREAM_AUTH");
  assert.equal(
    (await response.text()).includes("private provider failure"),
    false,
  );
  const state = await createHouseholdRepository(app.config.DB).read();
  assert.equal(state.people.length, 1);
  assert.equal(state.profiles.length, 1);
  assert.deepEqual(
    (await app.config.OAUTH_KV.list({ prefix: "pluggy-credentials:" })).keys,
    [],
  );
});

const identify = (value: unknown) =>
  z.object({ id: z.string() }).parse(value).id;
test("creating an owner and profile rolls back both when a concurrent application conflicts", async () => {
  const repository = createHouseholdRepository(env.DB);
  const profile = {
    clientFingerprint: "synthetic-application",
    credentialRef: null,
    enabled: true,
    id: "existing-profile",
    name: "Existing",
    personId: "self",
  };
  await repository.profile(profile);
  await assert.rejects(
    repository.profile(
      {
        ...profile,
        id: "conflicting-profile",
        personId: "new-person",
      },
      { id: "new-person", name: "Ana" },
    ),
  );
  const state = await repository.read();
  assert.equal(state.people.length, 1);
  assert.equal(state.profiles.length, 2);
  assert.equal(
    state.profiles.some((p) => p.id === "conflicting-profile"),
    false,
  );
});
function services() {
  const repository = createHouseholdRepository(env.DB);
  const vault = createCredentialVault(env.OAUTH_KV);
  const household = createHouseholdService({
    defaultClientId: "original",
    repository,
    validate: async () => undefined,
    vault,
  });
  const source = createProfileSource({
    defaults: { clientId: "original", clientSecret: "original-secret" },
    repository,
    vault,
  });
  const installation = createInstallationService({
    catalog: household.catalog,
    repository: createInstallationRepository(env.DB),
    source,
  });
  const execute = (action: string, fields: Record<string, unknown>) =>
    household.execute(
      HouseholdCommandSchema.parse({ action, csrf: "synthetic", ...fields }),
    );
  const planning = createPlanningService(createPlanningRepository(env.DB));
  const read = (tool: string, fields: Record<string, unknown> = {}) =>
    planning.execute(PlanningCommandSchema.parse({ tool, ...fields }));
  return {
    execute,
    household,
    installation,
    planning,
    read,
    repository,
    source,
    vault,
  };
}
function records(value: unknown) {
  return z
    .object({
      data: z.object({ records: z.array(z.record(z.string(), z.unknown())) }),
    })
    .parse(value).data.records;
}
function provider() {
  const clients: string[] = [];
  const reads: string[] = [];
  mockNetwork(async (input, init) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    if (url.pathname === "/auth") {
      const credentials = z
        .object({ clientId: z.string(), clientSecret: z.string() })
        .parse(await request.json());
      clients.push(credentials.clientId);
      return Response.json({ apiKey: syntheticJwt(credentials.clientId) });
    }
    const apiKey = request.headers.get("X-API-KEY") ?? "";
    reads.push(apiKey);
    const second = apiKey === syntheticJwt("second");
    if (url.pathname === "/items/c") {
      return Response.json({ connector: { id: 200 }, id: "c" });
    }
    if (url.pathname === "/accounts") {
      return Response.json({
        page: 1,
        results: [
          account({ balance: second ? "200.00" : "100.00", type: "CREDIT" }),
        ],
        total: 1,
        totalPages: 1,
      });
    }
    if (url.pathname === "/v2/transactions") {
      return Response.json({
        next: null,
        results: [
          transaction({
            amount: second ? "-20.00" : "-10.00",
            creditCardMetadata: { billId: "b" },
          }),
        ],
      });
    }
    const products: Record<string, unknown> = {
      "/bills": {
        accountId: "a",
        dueDate: "2026-10-25",
        id: "b",
        totalAmount: "20.00",
        totalAmountCurrencyCode: "BRL",
      },
      "/investments": {
        amount: "42.10",
        amountOriginal: "42.06",
        amountProfit: "-2.05",
        amountWithdrawal: "0",
        balance: "40.01",
        currencyCode: "BRL",
        dueDate: "2027-10-25T12:00:00Z",
        id: "i",
        institution: { name: "Instituição B3", number: "12345678000100" },
        itemId: "c",
        name: "Reserva",
        quantity: "0.123456789012345678",
        rate: "102.25",
        rateType: "CDI",
        status: "ACTIVE",
        subtype: "CDB",
        taxes: "2.09",
        taxes2: "0",
        type: "FIXED_INCOME",
      },
      "/loans": {
        contractAmount: "100.10",
        currencyCode: "BRL",
        id: "l",
        itemId: "c",
        payments: { contractOutstandingBalance: "50.10" },
        productName: "Crédito",
      },
    };
    if (products[url.pathname]) {
      return Response.json({
        page: 1,
        results: [products[url.pathname]],
        total: 1,
        totalPages: 1,
      });
    }
    if (url.pathname === "/connect_token") {
      return Response.json({
        accessToken: second ? "token-second" : "token-original",
      });
    }
    throw new Error("Unexpected synthetic path");
  });
  return { clients, reads };
}

test("two profiles with equal upstream IDs import separate histories and expose owner filters", async () => {
  const network = provider();
  const f = services();
  const personId = identify(await f.execute("save_person", { name: "Ana" }));
  const profileId = identify(
    await f.execute("save_profile", {
      clientId: "second",
      clientSecret: "second-secret",
      name: "Pluggy Ana",
      personId,
    }),
  );
  await f.installation.connect("c");
  await f.installation.connect("c", profileId);
  const secondId = scopedSourceId(profileId, "c");
  await collect(f.source, "2026-10-01T00:00:00Z", "c");
  await collect(f.source, "2026-10-01T00:00:00Z", secondId);
  assert.deepEqual(new Set(network.clients), new Set(["original", "second"]));
  assert.ok(network.reads.includes(syntheticJwt("second")));
  const all = records(await f.read("get_transactions"));
  assert.equal(all.length, 2);
  const ana = records(await f.read("get_transactions", { personId }));
  assert.equal(ana.length, 1);
  assert.equal(ana[0]?.id, scopedSourceId(profileId, "t"));
  assert.equal(ana[0]?.personName, "Ana");
  assert.equal(ana[0]?.amountMinor, "-2000");
  assert.equal(
    records(await f.read("get_accounts", { personId }))[0]?.balanceMinor,
    "20000",
  );
  const finance = createFinancialService(createFinancialRepository(env.DB));
  const result = await finance.query({ filter: { personId }, limit: 1 });
  assert.equal(result.records[0]?.id, scopedSourceId(profileId, "t"));
  const combined = await finance.aggregate({ metric: "debits" });
  const selected = await finance.aggregate({
    filter: { personId },
    metric: "debits",
  });
  assert.notDeepEqual(combined.groups, selected.groups);
  await assert.rejects(f.source.token(secondId, "default"), {
    message: "SOURCE_IDENTITY_MISMATCH",
  });
  assert.equal(
    (await f.source.token(secondId, profileId)).accessToken,
    "token-second",
  );
  await Promise.all(
    [
      ["get_investments", "i"],
      ["get_loans", "l"],
      ["get_bills", "b"],
    ].map(async ([tool, id]) => {
      assert.ok(tool && id);
      assert.equal(records(await f.read(tool)).length, 2);
      const owned = records(await f.read(tool, { personId }));
      assert.equal(owned.length, 1);
      assert.equal(owned[0]?.personId, personId);
      assert.equal(owned[0]?.profileId, profileId);
      assert.equal(owned[0]?.id, scopedSourceId(profileId, id));
    }),
  );
  const portfolio = InvestmentListSchema.parse(
    await f.read("get_investments", {
      currency: "BRL",
      personId,
      type: "FIXED_INCOME",
    }),
  );
  assert.equal(portfolio.data.totals[0]?.gross.totalMinor, "4210");
  assert.equal(portfolio.data.totals[0]?.net.totalMinor, "4001");
  assert.equal(portfolio.data.totals[0]?.profit.totalMinor, "-205");
  assert.equal(portfolio.data.totals[0]?.withdrawal.totalMinor, "0");
  assert.equal(
    portfolio.data.records[0]?.details?.quantity,
    "0.123456789012345678",
  );
  assert.equal(portfolio.data.records[0]?.details?.dueDate, "2027-10-25");
  assert.equal(
    portfolio.data.records[0]?.identity?.institution?.name,
    "Instituição B3",
  );
  assert.equal(portfolio.data.records[0]?.identity?.institution?.logoUrl, null);
  assert.equal(
    InvestmentListSchema.parse(
      await f.read("get_investments", { institutionId: "missing" }),
    ).data.records.length,
    0,
  );
  const cards = records(await f.read("get_cards", { personId }));
  assert.equal(cards.length, 1);
  assert.equal(cards[0]?.accountId, scopedSourceId(profileId, "a"));
  assert.equal(cards[0]?.personId, personId);
  const page = await finance.query({ limit: 1 });
  assert.ok(page.cursor);
  await f.execute("assign_connection", {
    connectionId: secondId,
    personId: "self",
  });
  await assert.rejects(finance.query({ cursor: page.cursor, limit: 1 }), {
    message: "RESTART_REQUIRED",
  });
  await f.installation.connect("c", profileId);
  assert.equal(records(await f.read("get_accounts", { personId })).length, 0);
  assert.equal(
    records(await f.read("get_transactions", { personId: "self" })).length,
    2,
  );
  const fresh = createProfileSource({
    defaults: { clientId: "original", clientSecret: "original-secret" },
    repository: f.repository,
    vault: f.vault,
  });
  assert.equal(
    (await fresh.accounts(secondId))[0]?.id,
    scopedSourceId(profileId, "a"),
  );
});

test("credentials stay server-only, duplicate applications and identity changes are refused, paused profiles fail closed", async () => {
  provider();
  const f = services();
  const profileId = identify(
    await f.execute("save_profile", {
      clientId: "second",
      clientSecret: "never-public",
      name: "Second",
      personId: "self",
    }),
  );
  const catalog = JSON.stringify(await f.household.catalog());
  assert.ok(!catalog.includes("never-public"));
  assert.ok(!catalog.includes("credentialRef"));
  await assert.rejects(
    f.execute("save_profile", {
      clientId: "second",
      clientSecret: "another-secret",
      name: "Duplicate",
      personId: "self",
    }),
    { message: "PROFILE_EXISTS" },
  );
  await assert.rejects(
    f.execute("save_profile", {
      clientId: "different",
      clientSecret: "another-secret",
      id: profileId,
      name: "Changed",
      personId: "self",
    }),
    { message: "APPLICATION_CHANGE_REQUIRES_NEW_PROFILE" },
  );
  await f.execute("save_profile", {
    enabled: false,
    id: profileId,
    name: "Paused",
    personId: "self",
  });
  await assert.rejects(f.source.connection(scopedSourceId(profileId, "c")), {
    message: "PROFILE_DISABLED",
  });
  await createInstallationRepository(env.DB).register("paused-test");
  await env.DB.prepare(
    "UPDATE connection_owners SET profile_id=? WHERE connection_id='paused-test'",
  )
    .bind(profileId)
    .run();
  const admissions = await createSyncRepository(env.DB).admit(
    ["paused-test"],
    "2026-10-22T12:00:00Z",
  );
  assert.equal(admissions[0]?.status, "paused");
  assert.equal(admissions[0]?.importId, null);
  await f.execute("save_profile", {
    clientId: "second",
    clientSecret: "rotated-secret",
    id: profileId,
    name: "Active",
    personId: "self",
  });
  const stored = (await f.repository.read()).profiles.find(
    (p) => p.id === profileId,
  );
  assert.ok(stored?.credentialRef);
  assert.equal(
    (await f.vault.get(stored.credentialRef)).clientSecret,
    "rotated-secret",
  );
});

test("manual financial assets and transactions have a person without changing their planning space", async () => {
  const f = services();
  const personId = identify(await f.execute("save_person", { name: "Ana" }));
  const accountId = identify(
    await f.read("create_manual_account", {
      confirmed: true,
      currency: "BRL",
      idempotency_key: "account",
      name: "Carteira Ana",
      openingBalanceMinor: "1000",
      personId,
      spaceId: "personal",
      type: "BANK",
    }),
  );
  await f.read("create_transaction", {
    accountId,
    amountMinor: "100",
    confirmed: true,
    date: "2026-10-01",
    description: "Cash",
    direction: "DEBIT",
    idempotency_key: "expense",
    spaceId: "personal",
  });
  assert.equal(
    records(await f.read("get_accounts", { personId: "self" })).length,
    0,
  );
  assert.equal(
    records(await f.read("get_accounts", { personId }))[0]?.personName,
    "Ana",
  );
  assert.equal(
    records(await f.read("get_transactions", { personId }))[0]?.spaceId,
    "personal",
  );
  await assert.rejects(f.read("get_transactions", { personId: "missing" }), {
    message: "NOT_FOUND",
  });
});

test("management routes require session and CSRF and never return credentials", async () => {
  provider();
  const app = fixture();
  assert.equal(
    (await app.request("/api/account/manage", { method: "POST" })).status,
    401,
  );
  const cookie = cookies(await login(app));
  const person = await command(app, cookie, "manage", {
    action: "save_person",
    name: "Ana",
  });
  assert.equal(person.status, 200);
  const personId = identify(await person.json());
  const profile = await command(app, cookie, "manage", {
    action: "save_profile",
    clientId: "second",
    clientSecret: "private-in-kv",
    name: "Ana",
    personId,
  });
  assert.equal(profile.status, 200);
  const state = PortalResponseSchema.parse(
    await (
      await app.request("/api/account", { headers: { Cookie: cookie } })
    ).json(),
  );
  assert.equal(state.profiles.length, 2);
  assert.ok(!JSON.stringify(state).includes("private-in-kv"));
  const rejected = await command(app, cookie, "manage", {
    action: "save_person",
    csrf: "wrong",
    name: "Bad",
  });
  assert.equal(rejected.status, 403);
});

test("new connections inherit the installation owner and profile without rewriting source IDs", async () => {
  await env.DB.prepare("INSERT INTO connections(id) VALUES('existing')").run();
  const owner = await env.DB.prepare(
    "SELECT * FROM connection_owners WHERE connection_id='existing'",
  ).first();
  assert.deepEqual(owner, {
    connection_id: "existing",
    institution: null,
    person_id: "self",
    profile_id: "default",
  });
  assert.equal(
    (await createInstallationRepository(env.DB).state()).connections[0]?.id,
    "existing",
  );
});

test("default application binding refuses a changed environment and missing stored credentials never fall back", async () => {
  provider();
  const f = services();
  await f.source.connection("c");
  const changed = createProfileSource({
    defaults: { clientId: "second", clientSecret: "second-secret" },
    repository: f.repository,
    vault: f.vault,
  });
  await assert.rejects(changed.connection("c"), {
    message: "APPLICATION_CHANGE_REQUIRES_NEW_PROFILE",
  });
  await f.execute("save_profile", {
    clientId: "original",
    clientSecret: "rotated",
    id: "default",
    name: "Principal",
    personId: "self",
  });
  const profile = await f.repository.getProfile("default");
  assert.ok(profile?.credentialRef);
  await env.OAUTH_KV.delete(`pluggy-credentials:${profile.credentialRef}`);
  const missing = createProfileSource({
    defaults: { clientId: "original", clientSecret: "original-secret" },
    repository: f.repository,
    vault: f.vault,
  });
  await assert.rejects(missing.connection("c"));
});

test("person photos persist through name edits and can be explicitly removed", async () => {
  const app = fixture();
  const cookie = cookies(await login(app));
  const photo =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jY1sAAAAASUVORK5CYII=";
  const saved = await command(app, cookie, "manage", {
    action: "save_person",
    name: "Foto exemplo",
    photo,
  });
  assert.equal(saved.status, 200);
  const personId = identify(await saved.json());
  const readPerson = async () => {
    const response = await app.request("/api/account", {
      headers: { Cookie: cookie },
    });
    return PortalResponseSchema.parse(await response.json()).people.find(
      (person) => person.id === personId,
    );
  };
  assert.equal((await readPerson())?.photo, photo);
  assert.equal(
    (
      await command(app, cookie, "manage", {
        action: "save_person",
        id: personId,
        name: "Nome atualizado",
      })
    ).status,
    200,
  );
  assert.equal((await readPerson())?.photo, photo);
  const invalid = await command(app, cookie, "manage", {
    action: "save_person",
    id: personId,
    name: "Nome atualizado",
    photo: "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=",
  });
  assert.equal(invalid.status, 400);
  assert.equal((await readPerson())?.photo, photo);
  assert.equal(
    (
      await command(app, cookie, "manage", {
        action: "save_person",
        id: personId,
        name: "Nome atualizado",
        photo: null,
      })
    ).status,
    200,
  );
  assert.equal((await readPerson())?.photo, null);
});
