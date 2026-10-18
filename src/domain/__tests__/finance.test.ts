import assert from "node:assert/strict";
import test from "node:test";

import { accountingDay, localDay } from "../exact";
import { normalizeResource } from "../finance-model";

const invalidDatePattern = /INVALID_DATE/;
const fieldTooLargePattern = /FIELD_TOO_LARGE/;
const invalidResponsePattern = /INVALID_RESPONSE/;
const canonicalMinorErrorPattern = /canonical integer, at most 30 digits/;

const aid = "22222222-2222-2222-2222-222222222222",
  cid = "33333333-3333-3333-3333-333333333333";

const tx = (
  id: string,
  accountId: string,
  type: string,
  amount: number,
  extra: Record<string, unknown> = {},
) => ({
  accountId,
  amount,
  currencyCode: "BRL",
  date: "2026-09-01T00:00:00.000Z",
  description: "Synthetic",
  id,
  status: "POSTED",
  type,
  ...extra,
});

await test("accounting dates preserve the calendar day separately from the Sao Paulo date", () => {
  assert.equal(accountingDay("2026-09-01T00:00:00Z"), "2026-09-01");
  assert.equal(localDay(new Date("2026-09-01T00:00:00Z")), "2026-08-31");
  assert.throws(() => accountingDay("2026-02-30"), invalidDatePattern);
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
        payer: { documentNumber: { value: "***1111" } },
        paymentMethod: "PIX",
        receiver: { documentNumber: { value: "***1111" } },
      },
    }),
    { id: aid, ownerDocument: "11111111111", type: "BANK" },
    { referenceDay: "2026-09-30" },
  );

  assert.equal(unknown.ownTransferEvidence, false);
  assert.equal(unknown.classification, "transfer_uncertain");

  const i = normalizeResource(
    "investments",
    {
      balance: null,
      currencyCode: "BRL",
      id: "x",
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
  const { itemInfo, productState } = await import("../provider.entity");

  const item = itemInfo({
    connector: { id: 1, isOpenFinance: false, products: ["INVESTMENTS"] },
    id: "synthetic-item",
    products: ["INVESTMENTS"],
  });
  const cardOnly = itemInfo({
    connector: { id: 1, products: ["CREDIT_CARDS"] },
    id: "synthetic-card-item",
    products: ["CREDIT_CARDS"],
  });
  assert.equal(
    productState("accounts", cardOnly, [], Date.parse("2026-09-30")),
    null,
  );

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
          expiresAt: "2020-01-01",
          id: "synthetic-consent",
          products: ["INVESTMENTS"],
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

await test("classification uses provider category and merchant evidence without an auxiliary category catalog", () => {
  for (const [extra, classification] of [
    [{ category: "Credit card payment" }, "bill_payment_category"],
    [{ category: "Investments" }, "patrimonial_category"],
    [{ category: "Transfer - PIX" }, "transfer_uncertain"],
    [{ merchant: { name: "Synthetic shop" } }, "consumption_evidence"],
    [{ category: "Unmapped" }, "unknown"],
  ] as const) {
    const record = normalizeResource(
      "transactions",
      tx("classified", aid, "DEBIT", 10, extra),
      { id: aid, type: "BANK" },
      { referenceDay: "2026-09-30" },
    );
    assert.equal(record.classification, classification);
  }
});

await test("holder and operation evidence retain priority over conflicting categories, transfer methods and merchants", () => {
  const owner = "11111111111";
  for (const [extra, classification, evidence] of [
    [
      {
        operationType: "PAGAMENTO_FATURA",
        paymentData: {
          payer: { documentNumber: { value: owner } },
          paymentMethod: "PIX",
          receiver: { documentNumber: { value: owner } },
        },
      },
      "own_transfer",
      "paymentData participant documents equal authenticated account holder document",
    ],
    [
      { category: "Investments", operationType: "PAGAMENTO_FATURA" },
      "bill_payment",
      "operationType=PAGAMENTO_FATURA (institution or Pluggy synthesized bill payment)",
    ],
    [{ operationType: "ESTORNO" }, "refund", "operationType=ESTORNO"],
    [{ operationType: "CASHBACK" }, "refund", "operationType=CASHBACK"],
    [
      { operationType: "toString" },
      "bill_payment_category",
      "Pluggy category: Credit card payment; classification may be corrected",
    ],
    [
      { category: "Investments" },
      "patrimonial_category",
      "Pluggy category hierarchy; not independently proven economic purpose",
    ],
    [
      { category: "Unknown" },
      "transfer_uncertain",
      "Payment method or transfer category; ownership/economic purpose unknown",
    ],
  ] as const) {
    const record = normalizeResource(
      "transactions",
      tx("conflicting-evidence", aid, "DEBIT", 10, {
        category: "Credit card payment",
        merchant: { name: "Synthetic merchant" },
        paymentData: { paymentMethod: "PIX" },
        ...extra,
      }),
      { id: aid, ownerDocument: owner, type: "BANK" },
      { referenceDay: "2026-09-30" },
    );
    assert.equal(record.classification, classification);
    assert.deepEqual(record.classificationEvidence, [evidence]);
    assert.equal(record.knownConsumptionMinor, null);
  }
});

await test("provider projection preserves nested precision and valid falsy values while rejecting oversized input", () => {
  const account = normalizeResource(
    "accounts",
    {
      balance: 0,
      bankData: {
        hasReservedBalance: false,
        reservedBalances: [
          {
            availableAmounts: [
              { amount: "9007199254740993.29", currencyCode: "BRL" },
            ],
            name: "Synthetic reserve",
            privateExtra: "discarded",
          },
        ],
      },
      currencyCode: "BRL",
      id: aid,
      marketingName: null,
      name: "",
      privateExtra: "discarded",
    },
    undefined,
    { referenceDay: null },
  );
  assert.equal(account.balanceMinor, "0");
  assert.equal(account.name, "");
  assert.equal(account.marketingName, null);
  assert.equal(account["bankData.hasReservedBalance"], false);
  assert.equal(account.privateExtra, undefined);
  assert.deepEqual(account["bankData.reservedBalances"], [
    {
      availableAmounts: [
        { amount: "9007199254740993.29", currencyCode: "BRL" },
      ],
      name: "Synthetic reserve",
    },
  ]);
  const consent = normalizeResource(
    "consents",
    { id: "synthetic-consent", products: ["ACCOUNTS"] },
    undefined,
    { referenceDay: null },
  );
  assert.deepEqual(consent.products, ["ACCOUNTS"]);
  for (const [resource, input, fault] of [
    ["accounts", { name: "x".repeat(4001) }, fieldTooLargePattern],
    [
      "accounts",
      { marketingName: Number.POSITIVE_INFINITY },
      invalidResponsePattern,
    ],
    [
      "accounts",
      { bankData: { reservedBalances: {} } },
      invalidResponsePattern,
    ],
    [
      "consents",
      { products: Array.from({ length: 2001 }, () => "ACCOUNTS") },
      invalidResponsePattern,
    ],
  ] as const) {
    assert.throws(
      () =>
        normalizeResource(resource, { id: aid, ...input }, undefined, {
          referenceDay: null,
        }),
      fault,
    );
  }
});

await test("normalization establishes the persisted monetary range for primary and secondary amounts", () => {
  const overflow = "10000000000000000000000000000";
  for (const fields of [{ balance: overflow }, { amountProfit: overflow }]) {
    assert.throws(
      () =>
        normalizeResource(
          "investments",
          {
            currencyCode: "BRL",
            id: "synthetic-investment",
            ...fields,
          },
          undefined,
          { referenceDay: null },
        ),
      canonicalMinorErrorPattern,
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
    canonicalMinorErrorPattern,
  );
});
