import assert from "node:assert/strict";
import { test } from "node:test";

import {
  conditionDraft,
  initialAlternatives,
  parseRuleDraft,
} from "../account/rule-draft";

const uuidPattern =
  /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/;

test("rule drafts initialize and retain distinct identities without randomUUID on HTTP LAN origins", () => {
  const original = Object.getOwnPropertyDescriptor(crypto, "randomUUID");
  Object.defineProperty(crypto, "randomUUID", {
    configurable: true,
    value: undefined,
  });
  try {
    const alternatives = initialAlternatives();
    const ids = [
      alternatives[0]?.id,
      alternatives[0]?.conditions[0]?.id,
      conditionDraft().id,
      conditionDraft("amount").id,
    ];
    assert.equal(new Set(ids).size, ids.length);
    for (const id of ids) {
      assert.ok(id);
      assert.match(id, uuidPattern);
    }
  } finally {
    if (original) {
      Object.defineProperty(crypto, "randomUUID", original);
    } else {
      Reflect.deleteProperty(crypto, "randomUUID");
    }
  }
});

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
