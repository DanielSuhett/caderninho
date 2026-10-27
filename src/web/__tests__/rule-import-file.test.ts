import assert from "node:assert/strict";
import { test } from "node:test";

import { RULE_JOB_CHUNK_RULES } from "../../domain";
import { parseRuleJobText, readRuleJobFile } from "../account/rule-import-file";

const invalidJson = /JSON inválido/;
const noRules = /não tem regras/;
const rule = (index: number) => ({
  categoryKey: "curso",
  key: `curso-${index}`,
  name: "Curso sintético",
  text: "CURSO",
});

test("rule files of any size are split into job chunks without validating each rule in the browser", () => {
  const rules = Array.from({ length: RULE_JOB_CHUNK_RULES * 2 + 1 }, (_, i) =>
    rule(i),
  );
  const file = parseRuleJobText(
    `﻿${JSON.stringify({
      categories: [{ key: "curso", kind: "expense", name: "Cursos" }],
      id: "catalogo-livre",
      rules: [...rules, { invalid: true }],
      version: 3,
    })}`,
    "catalogo.json",
  );
  assert.equal(file.id, "catalogo-livre");
  assert.equal(file.version, 3);
  assert.equal(file.rules, rules.length + 1);
  assert.deepEqual(
    file.chunks.map((chunk) => chunk.length),
    [RULE_JOB_CHUNK_RULES, RULE_JOB_CHUNK_RULES, 2],
  );
});

test("a missing or invalid package identity falls back to the file name", async () => {
  const file = await readRuleJobFile({
    name: "Minhas Regras (2026).json",
    text: async () => JSON.stringify({ id: "inválido!", rules: [rule(1)] }),
  });
  assert.equal(file.id, "Minhas-Regras-2026");
  assert.equal(file.version, 1);
  assert.deepEqual(file.categories, []);
});

test("malformed JSON and files without rules are rejected before upload", () => {
  assert.throws(() => parseRuleJobText("{", "a.json"), invalidJson);
  assert.throws(
    () => parseRuleJobText(JSON.stringify({ rules: [] }), "a.json"),
    noRules,
  );
});
