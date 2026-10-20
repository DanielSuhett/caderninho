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
});
