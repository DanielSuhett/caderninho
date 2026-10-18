import assert from "node:assert/strict";
import test from "node:test";

import { z } from "zod/v4";

import {
  accountingDay,
  decimal,
  exactJSON,
  localDay,
  minor,
} from "#domain/exact.ts";
import { normalizeResource } from "#domain/finance-model.ts";

const aid = "22222222-2222-2222-2222-222222222222",
  cid = "33333333-3333-3333-3333-333333333333";

const tx = (
  id: string,
  accountId: string,
  type: string,
  amount: number,
  extra: Record<string, unknown> = {},
) => ({
  id,
  accountId,
  type,
  amount,
  currencyCode: "BRL",
  date: "2026-09-01T00:00:00.000Z",
  status: "POSTED",
  description: "Synthetic",
  ...extra,
});

await test("exact money, quantities and no unsafe integer/coercion", () => {
  const x = z
    .object({ v: z.string(), q: z.string(), label: z.string() })
    .parse(
      exactJSON(
        '{"v":9007199254740993.29,"q":1.234567890123456789,"label":"12"}',
      ),
    );

  assert.equal(minor(x.v, "BRL"), "900719925474099329");
  assert.equal(decimal(x.q), "1.234567890123456789");
  assert.equal(minor("0.29", "BRL"), "29");
  assert.equal(minor(null, "BRL"), null);
  assert.equal(decimal("1e-7"), "0.0000001");
  assert.throws(() => minor("1.001", "BRL"), /PRECISION/);
  assert.throws(() => minor("1", "XYZ"), /CURRENCY_SCALE/);
  assert.equal(accountingDay("2026-09-01T00:00:00Z"), "2026-09-01");
  assert.equal(localDay(new Date("2026-09-01T00:00:00Z")), "2026-08-31");
  assert.throws(() => accountingDay("2026-02-30"), /INVALID_DATE/);
});

await test("card signs, uncertainty and nulls remain explicit; no ticker deduplication", () => {
  const card = { id: cid, type: "CREDIT" },
    r = normalizeResource("transactions", tx("c", cid, "DEBIT", 10), card, {
      referenceDay: "2026-09-30",
    });

  assert.equal(r.knownConsumptionMinor, "1000");
  assert.equal(r.signedFlowMinor, null);

  const payment = normalizeResource(
    "transactions",
    tx("p", cid, "CREDIT", -10, { operationType: "PAGAMENTO_FATURA" }),
    card,
    { referenceDay: "2026-09-30" },
  );

  assert.equal(payment.classification, "bill_payment");
  assert.equal(payment.knownConsumptionMinor, null);

  const unknown = normalizeResource(
    "transactions",
    tx("u", aid, "DEBIT", -10, {
      paymentData: {
        paymentMethod: "PIX",
        payer: { documentNumber: { value: "***1111" } },
        receiver: { documentNumber: { value: "***1111" } },
      },
    }),
    { id: aid, type: "BANK", ownerDocument: "11111111111" },
    { referenceDay: "2026-09-30" },
  );

  assert.equal(unknown.ownTransferEvidence, false);
  assert.equal(unknown.classification, "transfer_uncertain");

  const i = normalizeResource(
    "investments",
    {
      id: "x",
      currencyCode: "BRL",
      balance: null,
      quantity: "0.1234567890123456789",
    },
    undefined,
    { referenceDay: null },
  );

  assert.equal(i.balance, null);
  assert.equal(i.quantity, "0.1234567890123456789");
  assert.equal(i.balanceMinor, undefined);
});

await test("provider capabilities distinguish missing products, revoked consent and unsupported resources", async () => {
  const { itemInfo, productState } = await import("#domain/provider-state.ts");

  const item = itemInfo({
    id: "synthetic-item",
    products: ["INVESTMENTS"],
    connector: { id: 1, isOpenFinance: false, products: ["INVESTMENTS"] },
  });

  assert.equal(
    productState("investments", item, [], Date.parse("2026-09-30")),
    null,
  );
  assert.equal(
    productState("resources", item, [], Date.parse("2026-09-30")),
    "unsupported",
  );
  assert.equal(
    productState("loans", item, [], Date.parse("2026-09-30")),
    "unsupported",
  );
  assert.equal(
    productState(
      "investments",
      { ...item, products: [] },
      [],
      Date.parse("2026-09-30"),
    ),
    "not_enabled",
  );
  assert.equal(
    productState(
      "investments",
      item,
      [
        {
          id: "synthetic-consent",
          products: ["INVESTMENTS"],
          expiresAt: "2020-01-01",
        },
      ],
      Date.parse("2026-09-30"),
    ),
    "not_authorized",
  );
});

await test("normalization uses the operation reference day rather than the wall clock", () => {
  const input = tx("dated", cid, "DEBIT", 10);
  const parent = { id: cid, type: "CREDIT" };
  assert.equal(
    normalizeResource("transactions", input, parent, {
      referenceDay: "2026-08-31",
    }).knownConsumptionMinor,
    null,
  );
  assert.equal(
    normalizeResource("transactions", input, parent, {
      referenceDay: "2026-09-01",
    }).knownConsumptionMinor,
    "1000",
  );
});

await test("normalization establishes the persisted monetary range for primary and secondary amounts", () => {
  const overflow = "10000000000000000000000000000";
  for (const fields of [{ balance: overflow }, { amountProfit: overflow }]) {
    assert.throws(
      () =>
        normalizeResource(
          "investments",
          {
            id: "synthetic-investment",
            currencyCode: "BRL",
            ...fields,
          },
          undefined,
          { referenceDay: null },
        ),
      /canonical integer, at most 30 digits/,
    );
  }
  assert.throws(
    () =>
      normalizeResource(
        "transactions",
        tx("overflow", cid, "DEBIT", 10, { balance: overflow }),
        { id: cid, type: "CREDIT" },
        { referenceDay: "2026-09-30" },
      ),
    /canonical integer, at most 30 digits/,
  );
});
