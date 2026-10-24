import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildRuleComposition,
  ruleSummary,
} from "../account/rule-presentation";

const context = {
  accounts: [
    { id: "checking", name: "Conta principal", personName: "Pessoa exemplo" },
  ],
  category: "Mercado",
  enabled: true,
  people: [{ id: "owner", name: "Pessoa exemplo" }],
};

test("legacy rule composition retains mandatory account and direction without inventing OR branches", () => {
  const model = buildRuleComposition({
    ...context,
    rule: {
      accountId: "checking",
      direction: "DEBIT",
      filter: null,
      text: "mercado",
    },
  });
  assert.deepEqual(
    model.scope.map(({ field, operator, value }) => [field, operator, value]),
    [
      ["Moeda", null, "Todas as moedas"],
      ["Conta", "é", "Conta principal · Pessoa exemplo"],
      ["Movimento", "é", "Saída"],
    ],
  );
  assert.equal(model.alternatives.length, 1);
  assert.deepEqual(
    model.alternatives[0]?.conditions.map(({ field, operator, value }) => [
      field,
      operator,
      value,
    ]),
    [["Descrição", "contém", "“mercado”"]],
  );
});

test("OR branches preserve their AND conditions and cannot bypass global scope, currency or exact amounts", () => {
  const model = buildRuleComposition({
    ...context,
    rule: {
      accountId: "checking",
      direction: "DEBIT",
      filter: {
        alternatives: [
          {
            conditions: [
              { field: "description", operator: "contains", value: "PENDING" },
              { field: "amount", operator: "gte", value: "9007199254740993" },
            ],
          },
          {
            conditions: [
              { field: "personId", operator: "equals", value: "owner" },
              { field: "date", operator: "lte", value: "2026-10-24" },
            ],
          },
        ],
        currency: "BRL",
      },
      text: "loja",
    },
  });
  assert.deepEqual(
    model.scope.map(({ field, operator, value }) => [field, operator, value]),
    [
      ["Moeda", null, "BRL"],
      ["Conta", "é", "Conta principal · Pessoa exemplo"],
      ["Movimento", "é", "Saída"],
      ["Descrição", "contém", "“loja”"],
    ],
  );
  assert.deepEqual(
    model.alternatives.map((alternative) =>
      alternative.conditions.map(({ field, operator, value }) => [
        field,
        operator,
        value,
      ]),
    ),
    [
      [
        ["Descrição", "contém", "“PENDING”"],
        ["Valor absoluto", "≥", "90.071.992.547.409,93 BRL"],
      ],
      [
        ["Pessoa", "é", "Pessoa exemplo"],
        ["Data", "≤", "24/10/2026"],
      ],
    ],
  );
  assert.equal(
    model.alternatives[0]?.conditions[1]?.value,
    "90.071.992.547.409,93 BRL",
  );
  assert.equal(model.alternatives[0]?.conditions[1]?.monetary, true);
  assert.equal(model.alternatives[0]?.conditions[0]?.monetary, false);
});

test("unknown references stay explicit and repeated conditions retain distinct presentation identities", () => {
  const condition = {
    field: "accountId",
    operator: "equals",
    value: "missing",
  } as const;
  const model = buildRuleComposition({
    ...context,
    enabled: false,
    rule: {
      accountId: null,
      direction: null,
      filter: {
        alternatives: [
          { conditions: [condition, condition] },
          { conditions: [condition, condition] },
        ],
        currency: "JPY",
      },
      text: "",
    },
  });
  assert.equal(model.enabled, false);
  assert.equal(
    new Set(model.alternatives.map((alternative) => alternative.id)).size,
    2,
  );
  assert.equal(
    new Set(model.alternatives[0]?.conditions.map((item) => item.id)).size,
    2,
  );
  assert.equal(
    model.alternatives[0]?.conditions[0]?.value,
    "Conta não identificada",
  );
});

test("rule summaries preserve the original meaning of literal descriptions and directions", () => {
  assert.equal(
    ruleSummary({
      ...context,
      rule: {
        accountId: null,
        direction: null,
        filter: {
          alternatives: [
            {
              conditions: [
                { field: "description", operator: "contains", value: "DEBIT" },
                { field: "direction", operator: "equals", value: "CREDIT" },
              ],
            },
          ],
          currency: null,
        },
        text: "",
      },
    }),
    "Entradas com “DEBIT”",
  );
});

test("complex rule summaries report the absolute count across alternatives", () => {
  assert.equal(
    ruleSummary({
      rule: {
        accountId: null,
        direction: null,
        filter: {
          alternatives: [
            {
              conditions: [
                {
                  field: "description",
                  operator: "contains",
                  value: "mercado",
                },
                { field: "amount", operator: "gte", value: "10000" },
              ],
            },
            {
              conditions: [
                {
                  field: "description",
                  operator: "contains",
                  value: "farmácia",
                },
                { field: "status", operator: "equals", value: "POSTED" },
              ],
            },
          ],
          currency: "BRL",
        },
        text: "",
      },
    }),
    "2 alternativas · 4 condições",
  );
});
