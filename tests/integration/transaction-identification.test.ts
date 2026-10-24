import assert from "node:assert/strict";

import { beforeEach, test } from "vitest";

import {
  PortalTransactionListSchema,
  TransactionListSchema,
} from "../../src/contracts";
import {
  transactionIdentification,
  transactionIdentificationInput,
} from "../../src/fixtures/transaction-identification";
import { createFinancialService } from "../../src/worker/finance";
import { createFinancialRepository } from "../../src/worker/finance/repository";
import {
  command,
  cookies,
  fixture,
  login,
  testMigrations,
} from "./access-fixture";
import { collect, setup, source, transaction } from "./fixture";
import { applyD1Migrations, reset } from "cloudflare:test";
import { env } from "cloudflare:workers";

beforeEach(setup);

test("identification survives atomic import, financial queries, portal/MCP planning queries and metadata-only reimports", async () => {
  const row = transaction({ ...transactionIdentificationInput });
  await collect(source([row]));
  const finance = createFinancialService(createFinancialRepository(env.DB));
  assert.deepEqual(
    (await finance.query({ limit: 10 })).records[0]?.identification,
    transactionIdentification,
  );
  const app = fixture();
  const cookie = cookies(await login(app));
  await Promise.all(
    ["get_transactions", "get_portal_transactions"].map(async (tool) => {
      const response = await command(app, cookie, "query", {
        query: { spaceId: "personal", text: "00000000000191", tool },
      });
      assert.equal(response.status, 200);
      const body: unknown = await response.json();
      const result =
        tool === "get_transactions"
          ? TransactionListSchema.parse(body)
          : PortalTransactionListSchema.parse(body);
      assert.equal(result.data.records.length, 1);
      assert.deepEqual(
        result.data.records[0]?.identification,
        transactionIdentification,
      );
    }),
  );
  await env.DB.exec(
    "CREATE TRIGGER reject_identity_noop BEFORE UPDATE ON transactions BEGIN SELECT RAISE(ABORT,'UNNECESSARY_TRANSACTION_WRITE'); END;",
  );
  await collect(source([row]), "2026-10-02T00:00:00Z");
  await env.DB.exec("DROP TRIGGER reject_identity_noop");
  await collect(
    source([
      { ...row, merchant: { ...row.merchant, name: "Novo nome sintético" } },
    ]),
    "2026-10-03T00:00:00Z",
  );
  const [updated] = (await finance.query({ limit: 10 })).records;
  assert.ok(updated);
  assert.equal(updated.identification?.merchant?.name, "Novo nome sintético");
  assert.equal(updated.amountMinor, "-1000");
  await collect(source([transaction()]), "2026-10-04T00:00:00Z");
  assert.equal(
    (await finance.query({ limit: 10 })).records[0]?.identification,
    null,
  );
});

test("large-page scalar writes preserve identification exactly", async () => {
  const description = "synthetic ".repeat(60_000);
  await collect(
    source([transaction({ ...transactionIdentificationInput, description })]),
  );
  const finance = createFinancialService(createFinancialRepository(env.DB));
  const [row] = (await finance.query({ limit: 1 })).records;
  assert.equal(row?.description, description);
  assert.deepEqual(row?.identification, transactionIdentification);
});

test("migration preserves existing transactions and backfills the available card metadata", async () => {
  await reset();
  await applyD1Migrations(
    env.DB,
    testMigrations.filter((migration) => migration.name < "0008"),
  );
  await env.DB.prepare(
    "INSERT INTO transactions(id,account_id,date,status,direction,currency,amount_minor,description,category) VALUES('old','a','2026-10-01','POSTED','DEBIT','BRL','-100','Old','Groceries')",
  ).run();
  await env.DB.prepare(
    "INSERT INTO planning_transactionDetails(id,data) VALUES('old',?)",
  )
    .bind(
      JSON.stringify({
        accountId: "a",
        billId: "old-bill",
        cardNumber: "1234",
        id: "old",
        installmentNumber: 1,
        operationType: "CARTAO",
        purchaseDate: "2026-10-01",
        totalInstallments: 2,
      }),
    )
    .run();
  await applyD1Migrations(env.DB, testMigrations);
  const old = await env.DB.prepare(
    "SELECT amount_minor,identification FROM transactions WHERE id='old'",
  ).first<{ amount_minor: string; identification: string }>();
  assert.equal(old?.amount_minor, "-100");
  assert.ok(old);
  assert.deepEqual(JSON.parse(old.identification), {
    creditCardMetadata: {
      billId: "old-bill",
      cardNumber: "1234",
      installmentNumber: 1,
      purchaseDate: "2026-10-01",
      totalInstallments: 2,
    },
    operationType: "CARTAO",
  });
});
