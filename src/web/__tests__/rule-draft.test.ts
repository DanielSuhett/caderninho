import assert from "node:assert/strict";
import { test } from "node:test";

import { conditionDraft, parseRuleDraft } from "../account/rule-draft";

test("rule draft preserves decimal precision and rejects incomplete or currencyless amounts", () => {
  const input = {
    accountId: null,
    alternatives: [
      {
        conditions: [
          { ...conditionDraft("amount"), value: "90071992547409,93" },
        ],
        id: "a",
      },
    ],
    csrf: "test",
    currency: "BRL",
    direction: null,
    spaceId: "personal",
    text: "",
  };
  const draft = parseRuleDraft(input);
  assert.equal(draft.success, true);
  if (draft.success) {
    assert.equal(
      draft.data.filter?.alternatives[0]?.conditions[0]?.value,
      "9007199254740993",
    );
  }
  assert.equal(parseRuleDraft({ ...input, currency: "" }).success, false);
  assert.equal(
    parseRuleDraft({
      ...input,
      alternatives: [{ conditions: [conditionDraft()], id: "a" }],
    }).success,
    false,
  );
  assert.equal(parseRuleDraft({ ...input, alternatives: [] }).success, false);
});
