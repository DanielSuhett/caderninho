import assert from "node:assert/strict";

import { beforeEach, test } from "vitest";
import { z } from "zod/v4";

import {
  PlanningCommandSchema,
  PortalCardsQuerySchema,
  PortalCardsSchema,
} from "../../src/contracts";
import { createPlanningService } from "../../src/worker/planning";
import { createPlanningRepository } from "../../src/worker/planning/repository";
import { command, cookies, fixture, login } from "./access-fixture";
import { account, collect, setup, source, transaction } from "./fixture";
import { env } from "cloudflare:workers";

beforeEach(setup);

test("local card limits persist across services and imports, keep observed occupancy and restore the provider value", async () => {
  await collect(source([transaction()], [card]));
  const initial = await service().cards(query());
  const change = PlanningCommandSchema.parse({
    confirmed: true,
    creditLimitMinor: "120000",
    expected_revision: initial.revision,
    id: "a",
    idempotency_key: "limit-edit",
    spaceId: "personal",
    tool: "update_account_settings",
  });
  const result = await service().execute(change);
  assert.deepEqual(await service().execute(change), result);
  const [edited] = (await service().cards(query())).data.accounts;
  assert.equal(edited?.creditLimitMinor, "120000");
  assert.equal(edited?.allocatedMinor, "30000");
  assert.equal(edited?.availableCreditMinor, "90000");
  assert.equal(edited?.creditEstimated, true);
  await collect(
    source(
      [transaction()],
      [
        account({
          ...card,
          creditData: { availableCreditLimit: "500", creditLimit: "1100" },
        }),
      ],
    ),
    "2026-10-02T00:00:00Z",
  );
  const imported = await service().cards(query());
  assert.equal(imported.data.accounts[0]?.creditLimitMinor, "120000");
  assert.equal(imported.data.accounts[0]?.allocatedMinor, "60000");
  assert.equal(imported.data.accounts[0]?.availableCreditMinor, "60000");
  assert.equal(
    (await createPlanningRepository(env.DB).read()).accountDetails[0]
      ?.creditLimitMinor,
    "110000",
  );
  await assert.rejects(
    service().execute(
      PlanningCommandSchema.parse({
        ...change,
        creditLimitMinor: "1",
        idempotency_key: "stale-limit",
      }),
    ),
    { message: "RESTART_REQUIRED" },
  );
  await service().execute(
    PlanningCommandSchema.parse({
      ...change,
      creditLimitMinor: null,
      expected_revision: imported.revision,
      idempotency_key: "restore-limit",
    }),
  );
  const [restored] = (await service().cards(query())).data.accounts;
  assert.equal(restored?.creditLimitMinor, "110000");
  assert.equal(restored?.availableCreditMinor, "50000");
  assert.equal(restored?.creditEstimated, false);
});

test("the portal permits only confirmed revision-checked limit edits and rejects bank accounts or extra account fields", async () => {
  await collect(source([transaction()], [card, account({ id: "bank" })]));
  const app = fixture();
  const cookie = cookies(await login(app));
  const report = await service().cards(query());
  const edit = {
    confirmed: true,
    creditLimitMinor: "0",
    expected_revision: report.revision,
    id: "a",
    idempotency_key: "portal-limit",
    spaceId: "personal",
    tool: "update_account_settings",
  };
  assert.equal(
    (
      await command(app, cookie, "planning", {
        command: { ...edit, name: "Other name" },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await command(app, cookie, "planning", {
        command: { ...edit, confirmed: false },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await command(app, cookie, "planning", {
        command: { ...edit, id: "bank" },
      })
    ).status,
    400,
  );
  assert.equal(
    (await command(app, cookie, "planning", { command: edit })).status,
    200,
  );
  assert.equal(
    (await service().cards(query())).data.accounts[0]?.creditLimitMinor,
    "0",
  );
});
const card = account({
  creditData: {
    availableCreditLimit: "700",
    balanceCloseDate: "2026-10-25",
    balanceDueDate: "2026-11-02",
    creditLimit: "1000",
  },
  number: "xxxx4242",
  type: "CREDIT",
});
const metadata = {
  cardNumber: "4242",
  installmentNumber: 1,
  purchaseDate: "2026-10-05",
  totalInstallments: 3,
};
function service(day = "2026-10-24T15:00:00Z") {
  return createPlanningService(
    createPlanningRepository(env.DB),
    () => new Date(day),
  );
}
const query = (input: Record<string, unknown> = {}) =>
  PortalCardsQuerySchema.parse({
    month: "2026-10",
    tool: "get_portal_cards",
    ...input,
  });

test("each card of a CREDIT account is listed with its own spending and charges without a card number follow the primary card", async () => {
  await collect(
    source(
      [
        transaction({
          amount: "-100",
          category: "Groceries",
          creditCardMetadata: metadata,
          id: "primary-purchase",
        }),
        transaction({
          amount: "-40",
          category: "Groceries",
          creditCardMetadata: { ...metadata, cardNumber: "8080" },
          id: "additional-purchase",
        }),
        transaction({
          amount: "-10",
          category: "Groceries",
          id: "unnumbered-purchase",
        }),
      ],
      [card],
    ),
  );
  const { data } = await service().cards(query());
  const [credit] = data.accounts;
  assert.deepEqual(
    credit?.cards.map((item) => [
      item.number,
      item.primary,
      item.identified,
      item.confirmed.totalMinor,
    ]),
    [
      ["4242", true, false, "11000"],
      ["8080", false, false, "4000"],
    ],
  );
  assert.equal(data.confirmed.totalMinor, "15000");
  await service().execute(
    PlanningCommandSchema.parse({
      confirmed: true,
      hidden: true,
      id: "a:8080",
      idempotency_key: "hide-additional",
      spaceId: "personal",
      tool: "update_card",
    }),
  );
  const hidden = (await service().cards(query())).data;
  assert.deepEqual(
    hidden.accounts[0]?.cards.map((item) => [item.number, item.hidden]),
    [
      ["4242", false],
      ["8080", true],
    ],
  );
  assert.equal(hidden.confirmed.totalMinor, "15000");
});
test("a renamed card keeps its name after new imports and a stale revision is refused", async () => {
  const transactions = [
    transaction({
      amount: "-40",
      category: "Groceries",
      creditCardMetadata: { ...metadata, cardNumber: "8080" },
      id: "additional-purchase",
    }),
  ];
  await collect(source(transactions, [card]));
  const initial = await service().cards(query());
  const rename = PlanningCommandSchema.parse({
    confirmed: true,
    expected_revision: initial.revision,
    id: "a:8080",
    idempotency_key: "rename-additional",
    name: "Adicional da Laís",
    spaceId: "personal",
    tool: "update_card",
  });
  const result = await service().execute(rename);
  assert.deepEqual(await service().execute(rename), result);
  await assert.rejects(
    service().execute(
      PlanningCommandSchema.parse({ ...rename, idempotency_key: "stale" }),
    ),
  );
  await collect(source([...transactions], [card]), "2026-10-02T00:00:00Z");
  const additional = (
    await service().cards(query())
  ).data.accounts[0]?.cards.find((item) => item.number === "8080");
  assert.equal(additional?.name, "Adicional da Laís");
  assert.equal(additional?.identified, true);
});
test("a card owner overrides the account holder, can be cleared and is not inherited by a new card number", async () => {
  await env.DB.prepare("INSERT INTO people(id,name) VALUES('ana','Ana')").run();
  const additional = transaction({
    amount: "-40",
    category: "Groceries",
    creditCardMetadata: { ...metadata, cardNumber: "8080" },
    id: "additional-purchase",
  });
  await collect(source([additional], [card]));
  const edit = async (personId: string | null, key: string) => {
    const { revision } = await service().cards(query());
    return service().execute(
      PlanningCommandSchema.parse({
        confirmed: true,
        expected_revision: revision,
        id: "a:8080",
        idempotency_key: key,
        personId,
        spaceId: "personal",
        tool: "update_card",
      }),
    );
  };
  const find = async (number: string) =>
    (await service().cards(query())).data.accounts[0]?.cards.find(
      (item) => item.number === number,
    );
  assert.deepEqual(
    [(await find("8080"))?.personId, (await find("8080"))?.personInherited],
    ["self", true],
  );
  await edit("ana", "assign");
  assert.deepEqual(
    [
      (await find("8080"))?.personId,
      (await find("8080"))?.personName,
      (await find("8080"))?.personInherited,
      (await find("4242"))?.personInherited,
    ],
    ["ana", "Ana", false, true],
  );
  await assert.rejects(edit("missing", "unknown-person"));
  await collect(
    source(
      [
        additional,
        transaction({
          amount: "-5",
          category: "Groceries",
          creditCardMetadata: { ...metadata, cardNumber: "9999" },
          id: "virtual-purchase",
        }),
      ],
      [card],
    ),
    "2026-10-02T00:00:00Z",
  );
  assert.equal((await find("8080"))?.personId, "ana");
  assert.deepEqual(
    [(await find("9999"))?.personId, (await find("9999"))?.personInherited],
    ["self", true],
  );
  await edit(null, "clear");
  assert.equal((await find("8080"))?.personInherited, true);
});
test("the person filter follows card owners in the panel, the card catalog and transactions, with unnumbered charges on the primary card", async () => {
  await env.DB.prepare("INSERT INTO people(id,name) VALUES('ana','Ana')").run();
  await collect(
    source(
      [
        transaction({
          amount: "-100",
          category: "Groceries",
          creditCardMetadata: metadata,
          id: "primary-purchase",
        }),
        transaction({
          amount: "-40",
          category: "Groceries",
          creditCardMetadata: { ...metadata, cardNumber: "8080" },
          id: "additional-purchase",
        }),
        transaction({
          amount: "-10",
          category: "Groceries",
          id: "unnumbered-purchase",
        }),
      ],
      [card],
    ),
  );
  const { revision } = await service().cards(query());
  await service().execute(
    PlanningCommandSchema.parse({
      confirmed: true,
      expected_revision: revision,
      id: "a:8080",
      idempotency_key: "assign-ana",
      personId: "ana",
      spaceId: "personal",
      tool: "update_card",
    }),
  );
  const byPerson = async (personId: string) =>
    (await service().cards(query({ personId }))).data;
  const [forAna, forSelf] = await Promise.all([
    byPerson("ana"),
    byPerson("self"),
  ]);
  assert.deepEqual(
    forAna.accounts.map((item) => item.cards.map((c) => c.number)),
    [["8080"]],
  );
  assert.equal(forAna.confirmed.totalMinor, "4000");
  assert.deepEqual(
    forSelf.accounts.map((item) => item.cards.map((c) => c.number)),
    [["4242"]],
  );
  assert.equal(forSelf.confirmed.totalMinor, "11000");
  const catalog = await service().execute(
    PlanningCommandSchema.parse({
      personId: "ana",
      spaceId: "personal",
      tool: "get_cards",
    }),
  );
  assert.deepEqual(
    z
      .object({ records: z.array(z.object({ number: z.string() })) })
      .parse(catalog.data)
      .records.map((item) => item.number),
    ["8080"],
  );
  const transactions = await service().execute(
    PlanningCommandSchema.parse({
      personId: "ana",
      spaceId: "personal",
      tool: "get_transactions",
    }),
  );
  assert.deepEqual(
    z
      .object({ records: z.array(z.object({ id: z.string() })) })
      .parse(transactions.data)
      .records.map((item) => item.id),
    ["additional-purchase"],
  );
});
test("filtering by a card narrows the totals to that card, keeps unnumbered charges on the primary and ignores unknown cards", async () => {
  await collect(
    source(
      [
        transaction({
          amount: "-100",
          category: "Groceries",
          creditCardMetadata: metadata,
          id: "primary-purchase",
        }),
        transaction({
          amount: "-40",
          category: "Groceries",
          creditCardMetadata: { ...metadata, cardNumber: "8080" },
          id: "additional-purchase",
        }),
        transaction({
          amount: "-10",
          category: "Groceries",
          id: "unnumbered-purchase",
        }),
      ],
      [card],
    ),
  );
  const totals = async (cardId?: string) => {
    const { data } = await service().cards(query(cardId ? { cardId } : {}));
    return [data.confirmed.totalMinor, data.accounts[0]?.cards.length];
  };
  assert.deepEqual(
    await Promise.all([
      totals("a:8080"),
      totals("a:4242"),
      totals("a:0000"),
      totals(),
    ]),
    [
      ["4000", 2],
      ["11000", 2],
      ["15000", 2],
      ["15000", 2],
    ],
  );
});
test("cards use the full CREDIT-account scope, provider limits and received installments without invoice or bank double counting", async () => {
  await collect(
    source(
      [
        transaction({
          amount: "-100",
          category: "Groceries",
          creditCardMetadata: metadata,
          id: "purchase",
        }),
        transaction({
          amount: "20",
          category: "Groceries",
          id: "refund",
          type: "CREDIT",
        }),
        transaction({
          amount: "-25",
          creditCardMetadata: metadata,
          date: "2026-10-23",
          id: "pending",
          status: "PENDING",
        }),
        transaction({
          amount: "-30",
          creditCardMetadata: metadata,
          date: "2026-10-30",
          id: "future",
          status: "PENDING",
        }),
        transaction({
          amount: "-33",
          creditCardMetadata: { ...metadata, installmentNumber: 2 },
          date: "2026-11-05",
          id: "november",
        }),
        transaction({
          amount: "-999",
          category: "Groceries",
          id: "payment",
          operationType: "PAGAMENTO_FATURA",
        }),
        transaction({
          accountId: "bank",
          amount: "-900",
          category: "Groceries",
          id: "bank",
        }),
        transaction({ amount: "-12", currencyCode: "USD", id: "foreign" }),
      ],
      [card, account({ id: "bank" })],
    ),
  );
  const report = PortalCardsSchema.parse(await service().cards(query()));
  assert.equal(report.data.confirmed.totalMinor, "8000");
  assert.equal(report.data.purchases.totalMinor, "10000");
  assert.equal(report.data.refunds.totalMinor, "2000");
  assert.equal(report.data.pending.totalMinor, "2500");
  assert.equal(report.data.future.totalMinor, "3000");
  assert.equal(report.data.accounts.length, 1);
  assert.equal(report.data.accounts[0]?.allocatedMinor, "30000");
  assert.equal(report.data.accounts[0]?.availableCreditMinor, "70000");
  assert.equal(report.data.accounts[0]?.cardNumber, "4242");
  assert.deepEqual(report.data.currencies, ["BRL", "USD"]);
  assert.equal(report.data.months[0]?.confirmed.totalMinor, "10000");
  assert.equal(report.data.months[0]?.pending.totalMinor, "2500");
  assert.equal(report.data.months[0]?.future.totalMinor, "3000");
  assert.equal(report.data.months[1]?.future.totalMinor, "3300");
  assert.equal(report.data.months[2]?.future.count, 0);
  assert.equal(report.data.installments.length, 3);
  await assert.rejects(service().cards(query({ accountId: "bank" })), {
    message: "NOT_FOUND",
  });
  await assert.rejects(service().cards(query({ personId: "missing" })), {
    message: "NOT_FOUND",
  });
});

test("installment pagination keeps exact complete totals and rejects cursors reused in another scope", async () => {
  await collect(
    source(
      Array.from({ length: 54 }, (_, index) =>
        transaction({
          amount: "-9007199254740993.01",
          creditCardMetadata: metadata,
          id: `parcel-${String(index).padStart(3, "0")}`,
        }),
      ),
      [card],
    ),
  );
  const first = PortalCardsSchema.parse(await service().cards(query())).data;
  assert.equal(
    first.confirmed.totalMinor,
    (54n * 900719925474099301n).toString(),
  );
  assert.equal(first.installments.length, 50);
  assert.ok(first.nextCursor);
  const second = PortalCardsSchema.parse(
    await service().cards(query({ cursor: first.nextCursor })),
  ).data;
  assert.equal(second.installments.length, 4);
  assert.equal(second.nextCursor, null);
  assert.deepEqual(first.months, second.months);
  assert.deepEqual(first.confirmed, second.confirmed);
  assert.equal(
    new Set(
      [...first.installments, ...second.installments].map((row) => row.id),
    ).size,
    54,
  );
  await assert.rejects(
    service().cards(query({ cursor: first.nextCursor, month: "2026-11" })),
    { message: "RESTART_REQUIRED" },
  );
  await assert.rejects(
    service("2026-10-25T03:00:00Z").cards(query({ cursor: first.nextCursor })),
    { message: "RESTART_REQUIRED" },
  );
});

test("installment pagination uses binary ID order without repeats and stops at the last page", async () => {
  const ids = Array.from(
    { length: 60 },
    (_, index) => `${index % 2 ? "a" : "B"}${String(index).padStart(3, "0")}`,
  );
  await collect(
    source(
      ids.map((id) =>
        transaction({
          creditCardMetadata: metadata,
          date: "2026-10-05",
          id,
        }),
      ),
      [card],
    ),
  );
  const first = PortalCardsSchema.parse(await service().cards(query())).data;
  assert.equal(first.installments.length, 50);
  assert.ok(first.nextCursor);
  const second = PortalCardsSchema.parse(
    await service().cards(query({ cursor: first.nextCursor })),
  ).data;
  assert.equal(second.installments.length, 10);
  assert.equal(second.nextCursor, null);
  const received = [...first.installments, ...second.installments].map(
    (row) => row.id,
  );
  assert.equal(new Set(received).size, 60);
  assert.deepEqual(new Set(received), new Set(ids));
  assert.equal(first.installments[0]?.id, "a059");
  assert.equal(first.installments.at(-1)?.id, "B020");
  assert.equal(second.installments[0]?.id, "B018");
  assert.equal(second.installments.at(-1)?.id, "B000");
});

test("unknown money stays unknown and the authenticated portal validates its card query", async () => {
  await collect(
    source(
      [transaction({ amount: null, creditCardMetadata: metadata })],
      [account({ type: "CREDIT" })],
    ),
  );
  const result = PortalCardsSchema.parse(await service().cards(query())).data;
  assert.equal(result.confirmed.totalMinor, null);
  assert.equal(result.confirmed.unknownCount, 1);
  assert.equal(result.accounts[0]?.creditLimitMinor, null);
  assert.equal(result.accounts[0]?.allocatedMinor, null);
  const app = fixture();
  const denied = await app.request("/account/cards");
  assert.notEqual(denied.status, 200);
  const cookie = cookies(await login(app));
  assert.equal(
    (await app.request("/account/cards", { headers: { Cookie: cookie } }))
      .status,
    200,
  );
  const response = await command(app, cookie, "query", { query: query() });
  assert.equal(response.status, 200);
  assert.equal(
    PortalCardsSchema.parse(await response.json()).data.installments.length,
    1,
  );
  const invalid = await command(app, cookie, "query", {
    query: { ...query(), month: "2026-13" },
  });
  assert.equal(invalid.status, 400);
  const malformed = await Promise.all(
    ["%", "{", "[]"].map((cursor) =>
      command(app, cookie, "query", {
        query: query({ cursor }),
      }),
    ),
  );
  assert.ok(malformed.every((reply) => reply.status === 400));
});

test("filtering one card changes every total and retains all card choices", async () => {
  await collect(
    source(
      [
        transaction({
          amount: "-10",
          creditCardMetadata: metadata,
          id: "first-card",
        }),
        transaction({
          accountId: "second",
          amount: "-30",
          creditCardMetadata: metadata,
          id: "second-card",
        }),
      ],
      [card, account({ ...card, id: "second", name: "Segundo cartão" })],
    ),
  );
  const all = PortalCardsSchema.parse(await service().cards(query())).data;
  const first = PortalCardsSchema.parse(
    await service().cards(query({ accountId: "a" })),
  ).data;
  const second = PortalCardsSchema.parse(
    await service().cards(query({ accountId: "second" })),
  ).data;
  assert.equal(all.confirmed.totalMinor, "4000");
  assert.equal(first.confirmed.totalMinor, "1000");
  assert.equal(second.confirmed.totalMinor, "3000");
  assert.equal(first.months[0]?.confirmed.totalMinor, "1000");
  assert.equal(second.months[0]?.confirmed.totalMinor, "3000");
  assert.equal(first.installments[0]?.accountId, "a");
  assert.equal(second.installments[0]?.accountId, "second");
  assert.equal(first.accounts.length, 2);
  assert.equal(second.accounts.length, 2);
});
