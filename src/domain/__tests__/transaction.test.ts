import assert from "node:assert/strict";
import test from "node:test";

import { normalizeAccount, normalizeTransaction } from "..";

const bank = normalizeAccount(
  {
    balance: "9007199254740993.01",
    currencyCode: "BRL",
    id: "a",
    itemId: "c",
    name: "Synthetic",
    taxNumber: "11122233344",
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
    bank,
  );
  assert.equal(tx.amountMinor, "-900719925474099301");
  assert.equal(tx.date, "2026-10-01");
  assert.equal(tx.classification, "unknown");
});
test("ownership and explicit financial operations precede merchant evidence", () => {
  const source = {
    accountId: "a",
    amount: "10",
    currencyCode: "BRL",
    date: "2026-10-01",
    description: "Synthetic",
    id: "t",
    merchant: { name: "Synthetic shop" },
    operationType: "PAGAMENTO_FATURA",
    status: "POSTED",
    type: "DEBIT",
  } as const;
  assert.equal(
    normalizeTransaction(source, bank).classification,
    "bill_payment",
  );
  assert.equal(
    normalizeTransaction(
      {
        ...source,
        paymentData: {
          payer: { documentNumber: { value: "11122233344" } },
          receiver: { documentNumber: { value: "11122233344" } },
        },
      },
      bank,
    ).classification,
    "own_transfer",
  );
  assert.equal(
    normalizeTransaction(
      {
        ...source,
        operationType: "PIX",
        paymentData: { paymentMethod: "PIX" },
      },
      bank,
    ).classification,
    "transfer_uncertain",
  );
});
