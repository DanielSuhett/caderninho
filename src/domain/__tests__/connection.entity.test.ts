import assert from "node:assert/strict";
import test from "node:test";

import {
  assertConnectionCapacity,
  assertPersonalConnector,
} from "../connection.entity";

const meuPluggyRequiredPattern = /MEU_PLUGGY_REQUIRED/;
const itemLimitPattern = /ITEM_LIMIT/;

await test("personal connector policy permits reconnection at capacity", () => {
  for (const id of [200, "200"]) {
    assert.doesNotThrow(() => assertPersonalConnector(id));
  }
  for (const id of [undefined, 201, "0200"]) {
    assert.throws(() => assertPersonalConnector(id), meuPluggyRequiredPattern);
  }
  assert.doesNotThrow(() =>
    assertConnectionCapacity({ count: 9, exists: false }),
  );
  assert.doesNotThrow(() =>
    assertConnectionCapacity({ count: 10, exists: true }),
  );
  assert.throws(
    () => assertConnectionCapacity({ count: 10, exists: false }),
    itemLimitPattern,
  );
});
