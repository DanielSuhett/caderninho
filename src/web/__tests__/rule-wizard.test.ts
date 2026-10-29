import assert from "node:assert/strict";
import { test } from "node:test";

import { parseRuleDraft } from "../account/rule-draft";
import {
  initialJourney,
  journeyAlternatives,
  RuleJourney,
} from "../account/rule-wizard";

const parse = (journey: ReturnType<typeof initialJourney>) =>
  parseRuleDraft({
    accountId: null,
    alternatives: journeyAlternatives(journey),
    csrf: "x",
    currency: "",
    direction: null,
    spaceId: "personal",
    text: "",
  });

test("a transaction with a receiver starts the beneficiary journey by CNPJ", () => {
  const journey = initialJourney(undefined, {
    accountId: "a",
    category: null,
    currency: "BRL",
    description: "Bankslip",
    direction: "DEBIT",
    identification: {
      paymentData: {
        receiver: {
          documentNumber: { value: "22.222.222/0001-22" },
          name: "Imobiliária",
        },
      },
    },
  });
  assert.equal(journey.journey, RuleJourney.counterparty);
  const draft = parse(journey);
  assert.equal(draft.success, true);
  assert.deepEqual(draft.data?.filter?.alternatives[0]?.conditions, [
    { field: "receiverDocument", operator: "equals", value: "22222222000122" },
    { field: "direction", operator: "equals", value: "DEBIT" },
  ]);
});

test("existing rules reopen in the simplest journey and fold legacy scope", () => {
  const base = {
    categoryId: "c",
    enabled: true,
    id: "r",
    name: "Regra",
    priority: 100,
    spaceId: "personal",
  };
  const simple = initialJourney({
    ...base,
    accountId: null,
    direction: null,
    filter: {
      alternatives: [
        {
          conditions: [
            { field: "description", operator: "contains", value: "netflix" },
          ],
        },
      ],
      currency: null,
    },
    text: "",
  });
  assert.equal(simple.journey, RuleJourney.description);
  assert.equal(simple.debitOnly, false);
  const legacy = initialJourney({
    ...base,
    accountId: "a",
    direction: null,
    filter: {
      alternatives: [
        {
          conditions: [
            { field: "status", operator: "equals", value: "POSTED" },
          ],
        },
      ],
      currency: null,
    },
    text: "pix",
  });
  assert.equal(legacy.journey, RuleJourney.advanced);
  assert.deepEqual(
    parse(legacy).data?.filter?.alternatives[0]?.conditions.map((c) => c.field),
    ["status", "accountId", "description"],
  );
});
