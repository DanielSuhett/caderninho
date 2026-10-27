import assert from "node:assert/strict";

import { eq } from "drizzle-orm";
import { beforeEach, test } from "vitest";

import { database, required } from "../../src/worker/database";
import { createFinancialService } from "../../src/worker/finance";
import { createFinancialRepository } from "../../src/worker/finance/repository";
import {
  planningCards,
  planningInstallments,
  planningTransactionDetails,
} from "../../src/worker/schema";
import { collect, setup, source, transaction } from "./fixture";
import { env } from "cloudflare:workers";

beforeEach(setup);

test("batched credit metadata preserves exact amounts and local edits across reconciliation", async () => {
  const row = transaction({
    amount: "-99999999999999999999.99",
    creditCardMetadata: {
      cardNumber: "5678",
      installmentNumber: 2,
      totalInstallments: 4,
    },
  });
  await collect(source([row, transaction({ id: "without-details" })]));
  const db = database(env.DB);
  const installment = required(
    await db.select().from(planningInstallments).get(),
  );
  assert.equal(installment.data.amountMinor, "9999999999999999999999");
  await db
    .update(planningInstallments)
    .set({
      data: {
        ...installment.data,
        categoryId: "local-category",
        completed: true,
        name: "Local name",
        spaceId: "household",
      },
    })
    .where(eq(planningInstallments.id, installment.id));
  const card = required(await db.select().from(planningCards).get());
  await db
    .update(planningCards)
    .set({ data: { ...card.data, hidden: true, name: "Local card" } })
    .where(eq(planningCards.id, card.id));
  await env.DB.exec(
    "CREATE TRIGGER reject_detail_update BEFORE UPDATE ON planning_transactionDetails BEGIN SELECT RAISE(ABORT,'UNNECESSARY_DETAIL_WRITE'); END;",
  );
  await env.DB.exec(
    "CREATE TRIGGER reject_installment_update BEFORE UPDATE ON planning_installments BEGIN SELECT RAISE(ABORT,'UNNECESSARY_INSTALLMENT_WRITE'); END;",
  );
  await collect(source([row]), "2026-10-02T00:00:00Z");
  await env.DB.exec("DROP TRIGGER reject_detail_update");
  await env.DB.exec("DROP TRIGGER reject_installment_update");
  await collect(
    source([
      {
        ...row,
        amount: "-12.34",
        creditCardMetadata: { ...row.creditCardMetadata, installmentNumber: 3 },
      },
    ]),
    "2026-10-03T00:00:00Z",
  );
  const updated = required(
    await db.select().from(planningInstallments).get(),
  ).data;
  assert.equal(updated.current, 3);
  assert.equal(updated.amountMinor, "1234");
  assert.equal(updated.name, "Local name");
  assert.equal(updated.categoryId, "local-category");
  assert.equal(updated.completed, true);
  assert.equal(updated.spaceId, "household");
  assert.equal(
    required(await db.select().from(planningCards).get()).data.name,
    "Local card",
  );
  assert.equal(
    required(await db.select().from(planningCards).get()).data.hidden,
    true,
  );
  assert.equal((await db.select().from(planningTransactionDetails)).length, 1);
});

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
    identification: { category: "Updated" },
    status: "PENDING",
  });
});
