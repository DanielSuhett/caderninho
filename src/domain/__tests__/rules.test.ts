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
