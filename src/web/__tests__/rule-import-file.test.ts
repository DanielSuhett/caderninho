import assert from "node:assert/strict";
import { test } from "node:test";

import { RULE_IMPORT_MAX_BYTES } from "../../contracts";
import {
  parseRuleImportText,
  readRuleImportFile,
} from "../account/rule-import-file";

const invalidJson = /JSON inválido/;
const missingCategory = /Categoria não declarada/;
const invalidContract = /Contrato inválido/;
const rulesPath = /rules/;
const duplicates = /duplicadas/;
const tooLarge = /64 KiB/;
const pack = {
  categories: [{ key: "curso", kind: "expense", name: "Cursos" }],
  id: "catalogo-livre",
  rules: [
    {
      categoryKey: "curso",
      key: "curso",
      name: "Curso sintético",
      text: "CURSO",
    },
  ],
  version: 1,
};
test("JSON files use the native schema, support BOM and reject malformed files, missing categories and unsupported filters", async () => {
  assert.equal(
    parseRuleImportText(`\uFEFF${JSON.stringify(pack)}`).rules[0]?.priority,
    100,
  );
  assert.throws(() => parseRuleImportText("{"), invalidJson);
  assert.throws(
    () =>
      parseRuleImportText(
        JSON.stringify({
          ...pack,
          rules: [{ ...pack.rules[0], categoryKey: "missing" }],
        }),
      ),
    missingCategory,
  );
  assert.throws(
    () =>
      parseRuleImportText(
        JSON.stringify({
          ...pack,
          rules: [
            {
              ...pack.rules[0],
              filter: {
                alternatives: [
                  {
                    conditions: [
                      { field: "cnpj", operator: "equals", value: "synthetic" },
                    ],
                  },
                ],
              },
            },
          ],
        }),
      ),
    invalidContract,
  );
  assert.throws(
    () =>
      parseRuleImportText(
        JSON.stringify({
          ...pack,
          rules: Array.from({ length: 101 }, (_, i) => ({
            ...pack.rules[0],
            key: `rule-${i}`,
          })),
        }),
      ),
    rulesPath,
  );
  assert.throws(
    () =>
      parseRuleImportText(
        JSON.stringify({ ...pack, rules: [pack.rules[0], pack.rules[0]] }),
      ),
    duplicates,
  );
  const file = new File([JSON.stringify(pack)], "generic.json", {
    type: "application/json",
  });
  assert.equal((await readRuleImportFile(file)).id, "catalogo-livre");
});
test("file byte limits are enforced before reading and text limits count UTF-8 bytes", async () => {
  let read = false;
  await assert.rejects(
    () =>
      readRuleImportFile({
        size: RULE_IMPORT_MAX_BYTES + 1,
        text: () => {
          read = true;
          return Promise.resolve("{}");
        },
      }),
    tooLarge,
  );
  assert.equal(read, false);
  assert.throws(
    () => parseRuleImportText("é".repeat(RULE_IMPORT_MAX_BYTES)),
    tooLarge,
  );
});
