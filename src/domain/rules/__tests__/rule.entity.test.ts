import assert from "node:assert/strict";
import test from "node:test";

import { exactJSON } from "@/domain/exact";
import { NORMALIZER } from "@/domain/finance.entity";
import { FinanceRecordSchema } from "@/domain/finance.schema";
import { required } from "@/testing/helpers";

import { importRules, parseRuleJson } from "../import-rules";
import { compileStoredRules, EMPTY_RULES, txContext } from "../rule.entity";
import { compileRules, RuleSchema } from "../rule.schema";

const rulesV1RequiresExplicitConversionAndActivationPattern =
  /RULES_V1_REQUIRES_EXPLICIT_CONVERSION_AND_ACTIVATION/;
const normalizerVersionRequiresExplicitUpgradePattern =
  /NORMALIZER_VERSION_REQUIRES_EXPLICIT_UPGRADE/;
const mapPattern = /map/;
const unsafeRuleNumberPattern = /UNSAFE_RULE_NUMBER/;

const tx = (description = "CAFÉ") =>
  txContext({
    accountingDate: "2026-01-01",
    amount: "9007199254740993.01",
    description,
    id: "synthetic",
  });

const legacy = (when: object | boolean) => ({
  ...EMPTY_RULES,
  rules: [
    {
      actions: [{ op: "set_description", value: "Converted" }],
      id: "legacy",
      is_active: true,
      name: "Legacy",
      priority: 0,
      stage: "enrich",
      when,
    },
  ],
  version: 1,
});

await test("stored rule revisions require explicit legacy conversion and a matching normalizer", () => {
  assert.throws(
    () =>
      compileStoredRules({
        document: { ...EMPTY_RULES, rules: [], version: 1 },
        normalizer: "older",
      }),
    rulesV1RequiresExplicitConversionAndActivationPattern,
  );
  assert.throws(
    () => compileStoredRules({ document: EMPTY_RULES, normalizer: "older" }),
    normalizerVersionRequiresExplicitUpgradePattern,
  );
  assert.doesNotThrow(() =>
    compileStoredRules({ document: EMPTY_RULES, normalizer: NORMALIZER }),
  );
});

await test("rule context preserves exact scalar values and explicit absences after boundary validation", () => {
  const context = txContext(
    FinanceRecordSchema.parse({
      accountName: null,
      amount: "-9007199254740993.0100",
      "creditCardMetadata.installmentNumber": 0,
      "creditCardMetadata.totalInstallments": 12,
      id: "synthetic",
    }),
  );
  assert.equal(context.amount, "-9007199254740993.0100");
  assert.equal(context.amount_abs, "9007199254740993.0100");
  assert.equal(context.account_name, "");
  assert.equal(context.installment_number, "0");
  assert.equal(context.total_installments, "12");
  assert.throws(() =>
    FinanceRecordSchema.parse({
      accountName: { invalid: true },
      id: "synthetic",
    }),
  );
  assert.throws(() =>
    FinanceRecordSchema.parse({ amount: { invalid: true }, id: "synthetic" }),
  );
});

await test("rule import diagnostics retain a navigable source path for nested unsupported conditions", () => {
  const report = importRules(
    {
      format: "securo-categorization-rules",
      rules: [
        {
          actions: [{ op: "set_description", value: "Synthetic" }],
          conditions: [
            {
              conditions: [{ field: "unsupported", op: "equals", value: "x" }],
              op: "and",
            },
          ],
          conditions_op: "and",
          is_active: true,
          name: "Synthetic",
          priority: 0,
        },
      ],
      version: 1,
    },
    EMPTY_RULES,
  );
  assert.equal(report.compatible, false);
  assert.ok(
    report.issues.some(
      (issue) =>
        issue.path === "rules.0.conditions.0.0" &&
        issue.code === "FIELD_MAPPING_REQUIRED",
    ),
  );
  const missingCatalog = importRules({
    format: "securo-categorization-rules",
    rules: [],
    version: 1,
  });
  assert.equal(missingCatalog.document, null);
  assert.ok(
    missingCatalog.issues.some((issue) => issue.code === "CATALOG_REQUIRED"),
  );
  const invalid = importRules({
    format: "securo-categorization-rules",
    rules: [{ name: 42 }],
    version: 1,
  });
  assert.ok(invalid.issues.some((issue) => issue.path === "rules.0.name"));
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
    report = importRules(source);

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
  const report = importRules(
    legacy({ and: [true, { map: [true, true, false] }] }),
  );

  assert.equal(report.compatible, false);
  assert.equal(report.document, null);
  assert.equal(required(report.issues[0]).path, "rules.0.when.and.1");
  assert.match(required(report.issues[0]).message, mapPattern);

  for (const when of [
    { var: ["tx.description", "fallback"] },
    { and: [] },
    { "==": [{ var: "tx.amount" }, 1] },
  ]) {
    assert.equal(importRules(legacy(when)).compatible, false);
  }
});

await test("equal priorities preserve document order, derived facts update and concurrent evaluations isolate state", async () => {
  const doc = structuredClone(EMPTY_RULES);
  doc.categories.push({
    aliases: [],
    group_id: "other",
    id: "food",
    name: "Food",
  });
  doc.rules = [
    {
      conditions: {
        all: [{ fact: "tx.description", operator: "regex", value: "^cafe$" }],
      },
      event: {
        params: { actions: [{ op: "set_category", value: "food" }] },
        type: "classify",
      },
      id: "classify",
      is_active: true,
      name: "Classify",
      priority: 1,
    },
    {
      conditions: { all: [] },
      event: {
        params: { actions: [{ op: "set_category", value: "uncategorized" }] },
        type: "classify",
      },
      id: "classify-second",
      is_active: true,
      name: "Second classifier",
      priority: 1,
    },
    {
      conditions: {
        all: [{ fact: "result.category_id", operator: "equal", value: "food" }],
      },
      event: {
        params: { actions: [{ key: "kind", op: "set_tag", value: "food" }] },
        type: "enrich",
      },
      id: "tag",
      is_active: true,
      name: "Tag",
      priority: 1,
    },
    {
      conditions: {
        all: [{ fact: "result.tags.kind", operator: "equal", value: "food" }],
      },
      event: {
        params: {
          actions: [
            { op: "set_description", value: "{{tx.counterparty_name}}" },
            { op: "set_description", value: "First" },
            { key: "kind", op: "set_tag", value: "later" },
            { op: "ignore" },
          ],
        },
        type: "enrich",
      },
      id: "description",
      is_active: true,
      name: "Description",
      priority: 1,
    },
    {
      conditions: { all: [] },
      event: {
        params: { actions: [{ op: "set_description", value: "Second" }] },
        type: "enrich",
      },
      id: "fallback",
      is_active: true,
      name: "Fallback",
      priority: 1,
    },
  ];

  const engine = compileRules(doc),
    [a, b] = await Promise.all([
      engine.evaluate(tx()),
      engine.evaluate(tx("Other")),
    ]);

  assert.equal(a.description, "First");
  assert.equal(a.tags.kind, "food");
  assert.equal(a.ignored, true);
  assert.equal(b.description, "Second");
  assert.deepEqual(b.tags, {});
  assert.equal(b.ignored, false);
  assert.deepEqual(
    a.evidence.map((e) => e.ruleId),
    ["classify", "tag", "description", "description"],
  );
  assert.deepEqual(
    b.evidence.map((e) => e.ruleId),
    ["classify-second", "fallback"],
  );
  assert.deepEqual(
    await Promise.all([engine.evaluate(tx()), engine.evaluate(tx("Other"))]),
    [a, b],
  );
});

await test("schemas reject arbitrary paths, dynamic facts, unsafe priorities and invalid exact bounds", () => {
  const base = {
    event: { params: { actions: [{ op: "ignore" }] }, type: "enrich" },
    id: "bad",
    is_active: true,
    name: "Bad",
    priority: 1,
  };

  for (const condition of [
    { fact: "tx.secret", operator: "equal", value: "x" },
    { fact: "tx.description", operator: "equal", value: { fact: "database" } },
    { fact: "tx.description", operator: "equal", path: "$.x", value: "x" },
    { fact: "tx.description", operator: "regex", value: "(a)\\1" },
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
      conditions: { all: [] },
      priority: Number.MAX_SAFE_INTEGER + 1,
    }).success,
    false,
  );
});

await test("lossless JSON rejects malformed numeric tokens and preserves financial lexemes", () => {
  assert.deepEqual(
    parseRuleJson('{"value":9007199254740993.001,"priority":2}'),
    {
      priority: 2,
      value: "9007199254740993.001",
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
    unsafeRuleNumberPattern,
  );
  const report = importRules(parseRuleJson(JSON.stringify(legacy(true))));
  assert.equal(report.compatible, true);
});

await test("false conversion and short-circuit conditions never execute an unreachable exact predicate", async () => {
  const converted = importRules(legacy(false));
  assert.ok(converted.document);
  assert.equal(
    (await compileRules(converted.document).evaluate(tx())).description,
    "CAFÉ",
  );
  const doc = structuredClone(EMPTY_RULES);
  doc.rules = [
    {
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
        params: { actions: [{ op: "set_description", value: "Short" }] },
        type: "enrich",
      },
      id: "short",
      is_active: true,
      name: "Short",
      priority: 1,
    },
  ];
  assert.equal(
    (await compileRules(doc).evaluate(txContext({ id: "missing-date" })))
      .description,
    "Short",
  );

  const conditional = importRules(
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
      { aliases: [], group_id: "other", id: "food", name: "Food" },
    ],
  };

  const source = {
    format: "securo-categorization-rules",
    rules: [
      {
        actions: [
          { op: "set_category", value: "food" },
          { key: "source", op: "set_tag", value: "securo" },
        ],
        conditions: [
          { field: "amount", op: "equals", value: "9007199254740993.01" },
          {
            conditions: [
              { field: "currency", op: "equals", value: "BRL" },
              { field: "description", op: "starts_with", value: "CAFÉ" },
            ],
            op: "or",
          },
          { field: "date", op: "gte", value: "2026-01-01" },
          { field: "amount", op: "lte", value: "9007199254740993.01" },
          { field: "description", op: "contains", value: "FÉ" },
          { field: "description", op: "regex", value: "^cafe$" },
        ],
        conditions_op: "and",
        id: "securo",
        is_active: true,
        name: "Securo",
        priority: 2,
      },
    ],
    version: 1,
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
    [{ conditions: [], op: "and" }],
    [{ field: "description", op: "equals", value: ["CAFÉ"] }],
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
