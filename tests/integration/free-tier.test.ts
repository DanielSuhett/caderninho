import assert from "node:assert/strict";

import { beforeEach, test } from "vitest";

import { createFinancialService } from "../../src/worker/finance";
import { createFinancialRepository } from "../../src/worker/finance/repository";
import { collect, setup, source, transaction } from "./fixture";
import { env } from "cloudflare:workers";

beforeEach(setup);

test("a large escaped description remains importable without a JSON binding exceeding 2 MB", async () => {
  const description = '"'.repeat(1_100_000);
  await collect(source([transaction({ description })]));
  const finance = createFinancialService(createFinancialRepository(env.DB));
  const page = await finance.query({ limit: 1 });
  assert.equal(page.records[0]?.description, description);
});

test("literal description searches exceed the D1 pattern limit without losing case or accents", async () => {
  const long = "Descrição sintética ".repeat(50);
  const alphabets = "АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯÁ";
  await collect(
    source([
      transaction({ description: "Café São Paulo", id: "accented" }),
      transaction({ description: "CAFE SAO PAULO", id: "plain" }),
      transaction({ description: long, id: "long" }),
      transaction({ description: "Taxa 5% [VIP] * ? _", id: "literal" }),
      transaction({ description: "ΑΘΉΝΑ", id: "greek" }),
      transaction({ description: alphabets, id: "alphabets" }),
    ]),
  );
  const finance = createFinancialService(createFinancialRepository(env.DB));
  const cases = [
    ["café são paulo", "accented"],
    [long.toUpperCase(), "long"],
    ["5% [vip] * ? _", "literal"],
    ["αθήνα", "greek"],
    [alphabets.toLowerCase(), "alphabets"],
    [alphabets.slice(0, -1).toLowerCase(), "alphabets"],
  ];
  await Promise.all(
    cases.map(async ([description, id]) => {
      const page = await finance.query({ filter: { description }, limit: 50 });
      assert.deepEqual(
        page.records.map((row) => row.id),
        [id],
      );
      const result = await finance.aggregate({
        filter: { description },
        metric: "count",
      });
      assert.equal(result.groups[0]?.count, "1");
    }),
  );
});

test("daily reconciliation skips unchanged writes and still accepts source corrections", async () => {
  const first = transaction({ amount: null, category: null });
  await collect(source([first]));
  await env.DB.exec(
    "CREATE TRIGGER reject_unchanged BEFORE UPDATE ON transactions BEGIN SELECT RAISE(ABORT,'UNNECESSARY_WRITE'); END;",
  );
  await collect(source([first]), "2026-10-02T00:00:00.000Z");
  await env.DB.exec("DROP TRIGGER reject_unchanged");
  const corrected = transaction({
    amount: "-99999999999999999999.99",
    category: "Updated",
    date: "2026-10-02",
    description: "Corrected source",
    status: "PENDING",
    type: "CREDIT",
  });
  await collect(source([corrected]), "2026-10-03T00:00:00.000Z");
  const finance = createFinancialService(createFinancialRepository(env.DB));
  const page = await finance.query({ limit: 50 });
  assert.equal(page.records.length, 1);
  assert.deepEqual(page.records[0], {
    accountId: "a",
    amountMinor: "-9999999999999999999999",
    category: "Updated",
    currency: "BRL",
    date: "2026-10-02",
    description: "Corrected source",
    direction: "CREDIT",
    id: "t",
    status: "PENDING",
  });
});
