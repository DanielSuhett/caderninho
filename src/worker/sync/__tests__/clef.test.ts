import assert from "node:assert/strict";
import test from "node:test";

import { classificationState } from "../../../domain";
import { createClefClassifier } from "../clef.adapter";

const state = classificationState({
  accountId: "a",
  amountMinor: "-100",
  category: "Groceries",
  currency: "BRL",
  date: "2026-10-01",
  description: "Mercado sintético",
  direction: "DEBIT",
  id: "t",
  status: "POSTED",
});
test("Clef only accepts a fixed category with sufficient confidence and offers unknown", async () => {
  await Promise.all(
    (
      [
        ["mercado", 0.9, true],
        ["mercado", 0.79, false],
        ["unknown", 0.99, false],
        ["invented", 0.99, false],
      ] as const
    ).map(async ([choice, confidence, accepted]) => {
      const classify = createClefClassifier({
        run: (model, input) => {
          assert.equal(model, "@cf/cloudflare/clef-flash");
          assert.equal(
            Object.keys(input.questions.category.criteria).length,
            34,
          );
          assert.ok(input.questions.category.criteria.unknown);
          return Promise.resolve({
            answers: { category: { choice, confidence, type: "choice" } },
          });
        },
      });
      assert.equal(!!(await classify(state)), accepted);
    }),
  );
});
test("quota/network/invalid responses fall back and stop later AI calls in the same run", async () => {
  await Promise.all(
    [
      null,
      {
        answers: {
          category: { choice: "mercado", confidence: 2, type: "choice" },
        },
      },
      "quota",
    ].map(async (response) => {
      let calls = 0;
      const classify = createClefClassifier({
        run: () => {
          calls += 1;
          if (response === "quota") {
            throw new Error("quota exhausted");
          }
          return Promise.resolve(response);
        },
      });
      assert.equal(await classify(state), null);
      assert.equal(await classify(state), null);
      assert.equal(calls, 1);
    }),
  );
});
