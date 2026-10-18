import assert from "node:assert/strict";
import test from "node:test";

import { hash, secretsEqual } from "../crypto";

await test("hash preserves persisted fingerprints, exact amounts and falsy values", async () => {
  // Captured from the original database helper before moving it to shared.
  const vectors: { value: unknown; expected: string }[] = [
    {
      expected:
        "3e1f415c01c8eb3bf7c9086d7a819b75b535298a588feedf6eef41f62fe05c59",
      value: "synthetic-session-id",
    },
    {
      expected:
        "02fde065b528fa74db01ec5f08b1097e2cab38e58a242eedc8fc053006b2daba",
      value: { amount: "9007199254740993.0100", currency: "BRL" },
    },
    {
      expected:
        "74234e98afe7498fb5daf1f36ac2d78acc339464f950703b8c019892f982b90b",
      value: null,
    },
    {
      expected:
        "5feceb66ffc86f38d952786c6d696c79c2dbc239dd4e91b46729d73a27fb57e9",
      value: 0,
    },
    {
      expected:
        "fcbcf165908dd18a9e49f7ff27810176db8e9f63b4352213741664245224f8aa",
      value: false,
    },
    {
      expected:
        "12ae32cb1ec02d01eda3581b127c1fee3b0dc53572ed6baf239721a03d82e126",
      value: "",
    },
    {
      expected:
        "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      value: undefined,
    },
  ];
  await Promise.all(
    vectors.map(async ({ value, expected }) => {
      assert.equal(await hash(value), expected);
    }),
  );
  await Promise.all(
    [
      { a: 1, b: 2, nested: { a: [0, null, "", { x: 1, y: 2 }], z: false } },
      { a: 1, b: 2, nested: { a: [0, null, "", { x: 1, y: 2 }], z: false } },
    ].map(async (value) => {
      assert.equal(
        await hash(value),
        "4fad2c1d1036f0984243c76e0752a74909ecb7e42b59373efeb4d56fe073c25a",
      );
    }),
  );
  assert.notEqual(await hash([1, 2]), await hash([2, 1]));
});

await test("secret comparisons preserve exact bytes across lengths and Unicode", async () => {
  await Promise.all(
    ["", "synthetic-secret", "segredo-ação-🔐"].map(async (expected) => {
      assert.equal(await secretsEqual({ expected, supplied: expected }), true);
      await Promise.all(
        [`x${expected}`, `${expected}x`].map(async (supplied) => {
          assert.equal(await secretsEqual({ expected, supplied }), false);
        }),
      );
    }),
  );
  await Promise.all(
    ["Xynthetic-secret", "synthetic-secreX", "synthetic"].map(
      async (supplied) => {
        assert.equal(
          await secretsEqual({ expected: "synthetic-secret", supplied }),
          false,
        );
      },
    ),
  );
  assert.equal(
    await secretsEqual({ expected: "é", supplied: "e\u0301" }),
    false,
  );
});
