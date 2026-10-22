import assert from "node:assert/strict";
import test from "node:test";

import { assertPersonalConnector } from "..";

const meuPluggyRequiredPattern = /MEU_PLUGGY_REQUIRED/;

await test("personal connector policy validates the selected source", () => {
  for (const id of [200, "200"]) {
    assert.doesNotThrow(() => assertPersonalConnector(id));
  }
  for (const id of [undefined, 201, "0200"]) {
    assert.throws(() => assertPersonalConnector(id), meuPluggyRequiredPattern);
  }
});
