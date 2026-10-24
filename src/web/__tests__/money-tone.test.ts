import assert from "node:assert/strict";
import { test } from "node:test";

import { transactionTone } from "../money";

test("financial color follows the source direction, even when the amount sign disagrees", () => {
  assert.equal(
    transactionTone({
      amountMinor: "-1250",
      direction: "CREDIT",
      ignored: false,
    }),
    "income",
  );
  assert.equal(
    transactionTone({
      amountMinor: "1250",
      direction: "DEBIT",
      ignored: false,
    }),
    "expense",
  );
  assert.equal(
    transactionTone({
      amountMinor: "9007199254740993",
      direction: "CREDIT",
      ignored: false,
    }),
    "income",
  );
});

test("zero, unavailable and ignored amounts have no income or expense emphasis", () => {
  assert.equal(
    transactionTone({ amountMinor: "0", direction: "CREDIT", ignored: false }),
    "neutral",
  );
  assert.equal(
    transactionTone({ amountMinor: null, direction: "DEBIT", ignored: false }),
    "neutral",
  );
  assert.equal(
    transactionTone({
      amountMinor: "-1250",
      direction: "DEBIT",
      ignored: true,
    }),
    "neutral",
  );
});
