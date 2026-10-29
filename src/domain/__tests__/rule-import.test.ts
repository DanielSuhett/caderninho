import assert from "node:assert/strict";
import { test } from "node:test";

import type { Category, Rule } from "../planning.entity";
import {
  prepareRuleImport,
  type RuleImportPackage,
} from "../rule-import.entity";

const pack: RuleImportPackage = {
  categories: [{ key: "constructor", kind: "expense", name: "Livros" }],
  id: "synthetic-books",
  rules: [
    {
      accountId: null,
      categoryKey: "constructor",
      direction: null,
      enabled: true,
      filter: {
        alternatives: [
          {
            conditions: [
              { field: "description", operator: "contains", value: "livraria" },
            ],
          },
        ],
        currency: "BRL",
      },
      key: "bookshop",
      name: "Livraria",
      priority: 100,
      text: "",
    },
  ],
  version: 1,
};
function category(overrides: Partial<Category> = {}): Category {
  return {
    fixedCost: false,
    hidden: false,
    id: "local-books",
    kind: "expense",
    limitMinor: null,
    name: "Livros",
    spaceId: "personal",
    system: false,
    ...overrides,
  };
}
function prepare({
  categories = [],
  categoryIds = {},
  rules = [],
}: {
  categories?: Category[];
  categoryIds?: Record<string, string>;
  rules?: Rule[];
} = {}) {
  return prepareRuleImport({
    categories,
    categoryIds,
    pack,
    prefix: "synthetic-pack:",
    revision: 7,
    rules,
    spaceId: "personal",
  });
}

test("rule import plans are read-only and replay stable package identities without overwriting edits", () => {
  const input = { categories: [], rules: [] };
  const before = structuredClone(input);
  const plan = prepare(input);
  assert.deepEqual(input, before);
  assert.equal(plan.result.categoriesCreated, 1);
  assert.equal(plan.result.rulesCreated, 1);
  assert.equal(plan.result.categories[0]?.status, "create");
  assert.equal(plan.result.revision, 7);
  const rules = plan.rules.map((rule) => ({
    ...rule,
    enabled: false,
    name: "Nome escolhido pelo usuário",
    priority: 900,
  }));
  const replay = prepare({ categories: plan.categories, rules });
  assert.equal(replay.result.categoriesCreated, 0);
  assert.equal(replay.result.rulesCreated, 0);
  assert.equal(replay.result.rulesExisting, 1);
  assert.deepEqual(replay.result.rules[0], {
    categoryName: "Livros",
    enabled: false,
    key: "bookshop",
    name: "Nome escolhido pelo usuário",
    priority: 900,
    status: "existing",
  });
  assert.deepEqual(replay.categories, []);
  assert.deepEqual(replay.rules, []);
});

test("semantic duplicates ignore JSON property order and preserve personal pauses and priorities", () => {
  const original: Rule = {
    accountId: null,
    categoryId: "local-books",
    direction: null,
    enabled: false,
    filter: {
      alternatives: [
        {
          conditions: [
            { field: "description", operator: "contains", value: "livraria" },
          ],
        },
      ],
      currency: "BRL",
    },
    id: "personal-rule",
    name: "Minha regra pausada",
    priority: 1000,
    spaceId: "personal",
    text: "",
  };
  const before = structuredClone(original);
  const result = prepare({ categories: [category()], rules: [original] });
  assert.equal(result.result.rulesCreated, 0);
  assert.equal(result.result.rulesExisting, 1);
  assert.deepEqual(result.rules, []);
  assert.deepEqual(original, before);
  assert.equal(
    prepare({
      categories: [category()],
      rules: [{ ...original, spaceId: "other" }],
    }).result.rulesCreated,
    1,
  );
});

test("category ambiguity, hidden mappings and foreign scope stay visible until explicitly resolved", () => {
  const categories = [category(), category({ id: "duplicate-books" })];
  const ambiguous = prepare({ categories });
  assert.equal(ambiguous.result.categories[0]?.status, "ambiguous");
  assert.equal(ambiguous.result.rules[0]?.status, "blocked");
  assert.deepEqual(ambiguous.categories, []);
  assert.deepEqual(ambiguous.rules, []);
  const resolved = prepare({
    categories,
    categoryIds: { constructor: "local-books" },
  });
  assert.equal(resolved.result.categories[0]?.status, "existing");
  assert.equal(resolved.result.rulesCreated, 1);
  for (const invalid of [
    category({ hidden: true }),
    category({ spaceId: "other" }),
    category({ kind: "income" }),
  ]) {
    const result = prepare({
      categories: [invalid],
      categoryIds: { constructor: invalid.id },
    });
    assert.equal(result.result.categories[0]?.status, "invalid");
    assert.equal(result.result.rules[0]?.status, "blocked");
  }
});
