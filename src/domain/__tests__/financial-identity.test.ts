import assert from "node:assert/strict";
import { test } from "node:test";

import {
  cardBrandKey,
  matchesFinancialIdentity,
} from "../financial-identity.entity";

test("identity filters use exact institutions and canonical card brands without guessing missing metadata", () => {
  const identity = {
    cardBrand: "American Express",
    institution: { id: "bank-a", logoUrl: null, name: "Banco" },
  };
  assert.equal(cardBrandKey("amex"), "AMERICANEXPRESS");
  assert.equal(cardBrandKey("Diners Club"), "DINERS");
  assert.equal(matchesFinancialIdentity(identity, { cardBrand: "AMEX" }), true);
  assert.equal(
    matchesFinancialIdentity(identity, {
      cardBrand: "american_express",
      institutionId: "bank-a",
    }),
    true,
  );
  assert.equal(
    matchesFinancialIdentity(identity, {
      cardBrand: "AMEX",
      institutionId: "bank-b",
    }),
    false,
  );
  assert.equal(matchesFinancialIdentity(undefined, {}), true);
  assert.equal(
    matchesFinancialIdentity(undefined, { cardBrand: "VISA" }),
    false,
  );
  assert.equal(
    matchesFinancialIdentity(undefined, { institutionId: "bank-a" }),
    false,
  );
  assert.equal(
    matchesFinancialIdentity(
      { cardBrand: null, institution: null },
      { cardBrand: "--" },
    ),
    false,
  );
});
