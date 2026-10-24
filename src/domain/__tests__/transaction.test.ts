import assert from "node:assert/strict";
import test from "node:test";

import {
  transactionIdentification,
  transactionIdentificationInput,
} from "../../fixtures/transaction-identification";
import {
  normalizeAccount,
  normalizeTransaction,
  ProviderTransactionSchema,
  TransactionIdentificationSchema,
  transactionMatchesText,
} from "..";

const bank = normalizeAccount(
  {
    balance: "9007199254740993.01",
    currencyCode: "BRL",
    id: "a",
    itemId: "c",
    name: "Synthetic",
    type: "BANK",
  },
  "c",
);
test("account and transaction keep exact money and the provider calendar day", () => {
  assert.equal(bank.balanceMinor, "900719925474099301");
  const tx = normalizeTransaction(
    {
      accountId: "a",
      amount: "-9007199254740993.01",
      currencyCode: "BRL",
      date: "2026-10-01T00:00:00.000Z",
      description: "Synthetic",
      id: "t",
      status: "POSTED",
      type: "DEBIT",
    },
    bank.id,
  );
  assert.equal(tx.amountMinor, "-900719925474099301");
  assert.equal(tx.date, "2026-10-01");
  assert.equal(tx.identification?.date, "2026-10-01T00:00:00.000Z");
});

test("transaction identification keeps typed merchant, participants and exact card/boleto money without unknown payload fields", () => {
  const parsed = ProviderTransactionSchema.parse({
    accountId: "a",
    amount: "-10",
    currencyCode: "BRL",
    date: "2026-10-01",
    description: "Synthetic",
    id: "t",
    type: "DEBIT",
    ...transactionIdentificationInput,
    privatePayload: { secret: "discard" },
  });
  const row = normalizeTransaction(parsed, "a");
  assert.deepEqual(row.identification, transactionIdentification);
  assert.deepEqual(
    TransactionIdentificationSchema.parse(row.identification),
    transactionIdentification,
  );
  assert.equal(transactionMatchesText(row, "00000000000191"), true);
  assert.equal(transactionMatchesText(row, "RECEBEDOR SINTÉTICO"), true);
  assert.equal(transactionMatchesText(row, "institution-synthetic"), true);
  assert.equal(transactionMatchesText(row, "not-present"), false);
});

test("identification preserves explicit null, absence and partial or masked documents", () => {
  const base = {
    accountId: "a",
    amount: "0",
    currencyCode: "BRL",
    date: "2026-10-01",
    description: "",
    id: "t",
    type: "CREDIT",
  };
  assert.equal(
    normalizeTransaction(ProviderTransactionSchema.parse(base), "a")
      .identification,
    null,
  );
  const row = normalizeTransaction(
    ProviderTransactionSchema.parse({
      ...base,
      merchant: null,
      order: 0,
      paymentData: {
        receiver: { documentNumber: { value: "***.000.000-**" } },
      },
    }),
    "a",
  );
  assert.deepEqual(row.identification, {
    merchant: null,
    order: 0,
    paymentData: { receiver: { documentNumber: { value: "***.000.000-**" } } },
  });
});
