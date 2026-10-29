import assert from "node:assert/strict";
import { test } from "node:test";

import type { PlanningTransaction } from "../planning.entity";
import { type RuleCondition, ruleMatches } from "../rules.entity";

const row: PlanningTransaction = {
  accountId: "Account-A",
  amountMinor: "-9007199254740993",
  category: null,
  currency: "BRL",
  date: "2026-10-22",
  description: "CAFÉ %_ Loja",
  direction: "DEBIT",
  goalId: null,
  id: "t",
  ignored: false,
  manual: false,
  personId: "Person-A",
  personName: "Pessoa",
  profileId: null,
  spaceId: "personal",
  status: "POSTED",
  tagIds: [],
};
function matches(
  conditions: RuleCondition[],
  overrides: Partial<PlanningTransaction> = {},
) {
  return ruleMatches(
    { ...row, ...overrides },
    {
      accountId: null,
      direction: null,
      filter: { alternatives: [{ conditions }], currency: "BRL" },
      text: "",
    },
  );
}
test("rule text is literal, IDs retain case and amount comparisons preserve exact magnitudes", () => {
  assert.equal(
    matches([{ field: "description", operator: "contains", value: "cafÉ %_" }]),
    true,
  );
  assert.equal(
    matches([{ field: "description", operator: "contains", value: "café" }]),
    false,
  );
  assert.equal(
    matches([
      { field: "description", operator: "not_contains", value: "mercado" },
    ]),
    true,
  );
  assert.equal(
    matches([{ field: "personId", operator: "equals", value: "person-a" }]),
    false,
  );
  assert.equal(
    matches([{ field: "accountId", operator: "equals", value: "Account-A" }]),
    true,
  );
  assert.equal(
    matches([
      { field: "amount", operator: "equals", value: "9007199254740993" },
    ]),
    true,
  );
  assert.equal(
    matches([{ field: "amount", operator: "lte", value: "9007199254740992" }]),
    false,
  );
  assert.equal(
    matches([{ field: "amount", operator: "gte", value: "1" }], {
      amountMinor: null,
    }),
    false,
  );
  assert.equal(
    matches(
      [{ field: "amount", operator: "equals", value: "9007199254740993" }],
      { currency: "USD" },
    ),
    false,
  );
  assert.equal(
    matches([{ field: "date", operator: "gte", value: "2026-10-23" }]),
    false,
  );
});
test("beneficiary conditions read the payment receiver, then the card merchant", () => {
  const paid = {
    identification: {
      merchant: { cnpj: "11.111.111/0001-11", name: "Loja" },
      paymentData: {
        receiver: {
          documentNumber: { type: "CNPJ", value: "22.222.222/0001-22" },
          name: "Imobiliária Exemplo S.A.",
        },
      },
    },
  };
  assert.equal(
    matches(
      [
        {
          field: "receiverDocument",
          operator: "equals",
          value: "22222222000122",
        },
      ],
      paid,
    ),
    true,
  );
  assert.equal(
    matches(
      [{ field: "receiverName", operator: "contains", value: "IMOBILIÁRIA" }],
      paid,
    ),
    false,
  );
  assert.equal(
    matches(
      [{ field: "receiverName", operator: "contains", value: "IMOBILIária" }],
      paid,
    ),
    true,
  );
  assert.equal(
    matches(
      [
        {
          field: "receiverDocument",
          operator: "equals",
          value: "11111111000111",
        },
      ],
      { identification: { merchant: { cnpj: "11.111.111/0001-11" } } },
    ),
    true,
  );
  // Without a counterparty no beneficiary condition matches, not even negations.
  assert.equal(
    matches([
      { field: "receiverName", operator: "not_contains", value: "loja" },
    ]),
    false,
  );
});
