import assert from "node:assert/strict";
import test from "node:test";

import { exactJSON } from "#domain/exact.ts";
import { convertRules } from "#domain/rules/convert-rules.ts";
import { importRules, parseRuleJson } from "#domain/rules/import-rules.ts";
import {
  compileRules,
  EMPTY_RULES,
  RuleSchema,
  txContext,
} from "#domain/rules/rules.ts";
import { required } from "#testing/helpers.ts";

const tx = (description = "CAFÉ") =>
  txContext({
    id: "synthetic",
    description,
    amount: "9007199254740993.01",
    accountingDate: "2026-01-01",
  });

const legacy = (when: object | boolean) => ({
  ...EMPTY_RULES,
  version: 1,
  rules: [
    {
      id: "legacy",
      name: "Legacy",
      priority: 0,
      is_active: true,
      stage: "enrich",
      when,
      actions: [{ op: "set_description", value: "Converted" }],
    },
  ],
});

await test("explicit v1 conversion preserves equivalent boolean combinations and exact predicates", async () => {
  const source = legacy({
    and: [
      { "opf.regex": [{ var: "tx.description" }, "^cafe$"] },
      {
        or: [
          {
            "opf.decimal_compare": [
              { var: "tx.amount" },
              "eq",
              "9007199254740993.01",
            ],
          },
          false,
        ],
      },
      { "!": { "opf.date_compare": [{ var: "tx.date" }, "lt", "2026-01-01"] } },
    ],
  });

  const before = JSON.stringify(source),
    report = convertRules(source);

  assert.equal(report.compatible, true);
  assert.ok(report.document);
  assert.equal(report.document.version, 2);
  assert.equal(
    (await compileRules(report.document).evaluate(tx())).description,
    "Converted",
  );
  assert.equal(JSON.stringify(source), before);
  assert.throws(() => compileRules(source));
});

await test("conversion rejects unsupported nested expressions with an exact path and no partial output", () => {
  const report = convertRules(
    legacy({ and: [true, { map: [true, true, false] }] }),
  );

  assert.equal(report.compatible, false);
  assert.equal(report.document, null);
  assert.equal(required(report.issues[0]).path, "rules.0.when.and.1");
  assert.match(required(report.issues[0]).message, /map/);

  for (const when of [
    { var: ["tx.description", "fallback"] },
    { and: [] },
    { "==": [{ var: "tx.amount" }, 1] },
  ]) {
    assert.equal(convertRules(legacy(when)).compatible, false);
  }
});

await test("equal priorities preserve document order, derived facts update and concurrent evaluations isolate state", async () => {
  const doc = structuredClone(EMPTY_RULES);
  doc.categories.push({
    id: "food",
    name: "Food",
    group_id: "other",
    aliases: [],
  });
  doc.rules = [
    RuleSchema.parse({
      id: "classify",
      name: "Classify",
      priority: 1,
      is_active: true,
      conditions: {
        all: [{ fact: "tx.description", operator: "regex", value: "^cafe$" }],
      },
      event: {
        type: "classify",
        params: { actions: [{ op: "set_category", value: "food" }] },
      },
    }),
    RuleSchema.parse({
      id: "classify-second",
      name: "Second classifier",
      priority: 1,
      is_active: true,
      conditions: { all: [] },
      event: {
        type: "classify",
        params: { actions: [{ op: "set_category", value: "uncategorized" }] },
      },
    }),
    RuleSchema.parse({
      id: "tag",
      name: "Tag",
      priority: 1,
      is_active: true,
      conditions: {
        all: [{ fact: "result.category_id", operator: "equal", value: "food" }],
      },
      event: {
        type: "enrich",
        params: { actions: [{ op: "set_tag", key: "kind", value: "food" }] },
      },
    }),
    RuleSchema.parse({
      id: "description",
      name: "Description",
      priority: 1,
      is_active: true,
      conditions: {
        all: [{ fact: "result.tags.kind", operator: "equal", value: "food" }],
      },
      event: {
        type: "enrich",
        params: { actions: [{ op: "set_description", value: "First" }] },
      },
    }),
    RuleSchema.parse({
      id: "fallback",
      name: "Fallback",
      priority: 1,
      is_active: true,
      conditions: { all: [] },
      event: {
        type: "enrich",
        params: { actions: [{ op: "set_description", value: "Second" }] },
      },
    }),
  ];

  const engine = compileRules(doc),
    [a, b] = await Promise.all([
      engine.evaluate(tx()),
      engine.evaluate(tx("Other")),
    ]);

  assert.equal(a.description, "First");
  assert.equal(a.tags.kind, "food");
  assert.equal(b.description, "Second");
  assert.deepEqual(b.tags, {});
  assert.deepEqual(
    a.evidence.map((e) => e.ruleId),
    ["classify", "tag", "description"],
  );
  assert.deepEqual(
    b.evidence.map((e) => e.ruleId),
    ["classify-second", "fallback"],
  );
});

await test("schemas reject arbitrary paths, dynamic facts, unsafe priorities and invalid exact bounds", () => {
  const base = {
    id: "bad",
    name: "Bad",
    priority: 1,
    is_active: true,
    event: { type: "enrich", params: { actions: [{ op: "ignore" }] } },
  };

  for (const condition of [
    { fact: "tx.secret", operator: "equal", value: "x" },
    { fact: "tx.description", operator: "equal", value: { fact: "database" } },
    { fact: "tx.description", path: "$.x", operator: "equal", value: "x" },
    { fact: "tx.amount", operator: "decimalBetween", value: ["2", "1"] },
    {
      fact: "tx.date",
      operator: "dateCompare",
      value: { op: "eq", value: "2026-02-30" },
    },
  ]) {
    assert.equal(
      RuleSchema.safeParse({ ...base, conditions: { all: [condition] } })
        .success,
      false,
    );
  }
  assert.equal(
    RuleSchema.safeParse({
      ...base,
      priority: Number.MAX_SAFE_INTEGER + 1,
      conditions: { all: [] },
    }).success,
    false,
  );
});

await test("lossless JSON rejects malformed numeric tokens and preserves financial lexemes", () => {
  assert.deepEqual(
    parseRuleJson('{"value":9007199254740993.001,"priority":2}'),
    {
      value: "9007199254740993.001",
      priority: 2,
    },
  );
  assert.deepEqual(
    exactJSON('{"amount":9007199254740993.0100,"rate":1e-8,"text":"12"}'),
    {
      amount: "9007199254740993.0100",
      rate: "1e-8",
      text: "12",
    },
  );

  for (const text of ['{"x":01}', '{"x":NaN}', '{"x":1.}']) {
    assert.throws(() => exactJSON(text));
  }
  assert.throws(
    () => parseRuleJson('{"priority":9007199254740993}'),
    /UNSAFE_RULE_NUMBER/,
  );
  const report = importRules(parseRuleJson(JSON.stringify(legacy(true))));
  assert.equal(report.compatible, true);
});

await test("false conversion and short-circuit conditions never execute an unreachable exact predicate", async () => {
  const converted = convertRules(legacy(false));
  assert.ok(converted.document);
  assert.equal(
    (await compileRules(converted.document).evaluate(tx())).description,
    "CAFÉ",
  );
  const doc = structuredClone(EMPTY_RULES);
  doc.rules = [
    RuleSchema.parse({
      id: "short",
      name: "Short",
      priority: 1,
      is_active: true,
      conditions: {
        any: [
          { all: [] },
          {
            fact: "tx.date",
            operator: "dateCompare",
            value: { op: "eq", value: "2026-01-01" },
          },
        ],
      },
      event: {
        type: "enrich",
        params: { actions: [{ op: "set_description", value: "Short" }] },
      },
    }),
  ];
  assert.equal(
    (await compileRules(doc).evaluate(txContext({ id: "missing-date" })))
      .description,
    "Short",
  );

  const conditional = convertRules(
    legacy({
      if: [
        true,
        true,
        { "opf.date_compare": [{ var: "tx.date" }, "eq", "2026-01-01"] },
      ],
    }),
  );

  assert.ok(conditional.document);
  assert.equal(
    (
      await compileRules(conditional.document).evaluate(
        txContext({ id: "missing-date" }),
      )
    ).description,
    "Converted",
  );
});

await test("Securo imports directly into v2 with exact amounts, native groups and separate phases", async () => {
  const catalog = {
    ...EMPTY_RULES,
    categories: [
      ...EMPTY_RULES.categories,
      { id: "food", name: "Food", group_id: "other", aliases: [] },
    ],
  };

  const source = {
    format: "securo-categorization-rules",
    version: 1,
    rules: [
      {
        id: "securo",
        name: "Securo",
        priority: 2,
        is_active: true,
        conditions_op: "and",
        conditions: [
          { op: "equals", field: "amount", value: "9007199254740993.01" },
          {
            op: "or",
            conditions: [
              { op: "equals", field: "currency", value: "BRL" },
              { op: "starts_with", field: "description", value: "CAFÉ" },
            ],
          },
          { op: "gte", field: "date", value: "2026-01-01" },
          { op: "lte", field: "amount", value: "9007199254740993.01" },
          { op: "contains", field: "description", value: "FÉ" },
          { op: "regex", field: "description", value: "^cafe$" },
        ],
        actions: [
          { op: "set_category", value: "food" },
          { op: "set_tag", key: "source", value: "securo" },
        ],
      },
    ],
  };

  const report = importRules(source, catalog);
  assert.deepEqual(report.issues, []);
  assert.ok(report.document);
  assert.equal(report.document.version, 2);
  assert.deepEqual(
    report.document.rules.map((r) => r.event.type),
    ["classify", "enrich"],
  );
  const result = await compileRules(report.document).evaluate(tx());
  assert.equal(result.category_id, "food");
  assert.equal(result.tags.source, "securo");

  for (const conditions of [
    [],
    [{ op: "and", conditions: [] }],
    [{ op: "equals", field: "description", value: ["CAFÉ"] }],
  ]) {
    const rejected = importRules(
      { ...source, rules: [{ ...source.rules[0], conditions }] },
      catalog,
    );

    assert.equal(rejected.compatible, false);
    assert.equal(rejected.document, null);
  }

  const invalidCatalog = importRules(source, { ...catalog, groups: [] });
  assert.equal(invalidCatalog.compatible, false);
  assert.equal(invalidCatalog.document, null);
});
