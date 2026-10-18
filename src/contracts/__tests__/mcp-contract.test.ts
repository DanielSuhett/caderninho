import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { tools, validateTool } from "#contracts/mcp-contract.ts";
import { parseJson } from "#shared/json.ts";

await test("MCP catalogue preserves the baseline with the documented override limit", async () => {
  const baseline = parseJson(
    await readFile(
      new URL("./fixtures/mcp-catalog.json", import.meta.url),
      "utf8",
    ),
  );
  assert.deepEqual(tools, baseline);
  const input = {
    itemId: "item",
    resource: "transactions",
    id: "transaction",
    field: "description",
    value: "x".repeat(2048),
  };
  assert.doesNotThrow(() => validateTool("caderninho_override", input));
  assert.throws(() =>
    validateTool("caderninho_override", { ...input, value: "x".repeat(2049) }),
  );
});
