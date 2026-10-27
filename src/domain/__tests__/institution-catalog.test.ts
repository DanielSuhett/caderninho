import assert from "node:assert/strict";
import test from "node:test";

import {
  accountCompes,
  accountHolderKey,
  compeFromInstitutionId,
  compeInstitutionId,
  institutionLogoUrl,
  isDuplicateConnection,
  normalizeCompe,
  transferCompe,
} from "..";

await test("COMPE codes normalize to three digits", () => {
  assert.equal(normalizeCompe("1"), "001");
  assert.equal(normalizeCompe(" 208 "), "208");
  assert.equal(normalizeCompe("2080"), null);
  assert.equal(normalizeCompe("2a8"), null);
  assert.equal(normalizeCompe(null), null);
});

await test("the COMPE is the first segment of the transfer number", () => {
  assert.equal(transferCompe("208/0001/123456-7"), "208");
  assert.equal(transferCompe("260 / 0001 / 1"), "260");
  assert.equal(transferCompe("/0001/1"), null);
  assert.equal(transferCompe("abc/0001/1"), null);
  assert.equal(transferCompe(undefined), null);
});

await test("institution ids round-trip and never collide with connector ids", () => {
  assert.equal(compeInstitutionId("208"), "compe:208");
  assert.equal(compeFromInstitutionId("compe:208"), "208");
  assert.equal(compeFromInstitutionId("208"), null);
  assert.equal(compeFromInstitutionId("compe:x"), null);
});

await test("bundled bank logos are accepted, other local paths are not", () => {
  assert.equal(institutionLogoUrl("/bancos/208.svg"), "/bancos/208.svg");
  assert.equal(institutionLogoUrl("/bancos/../x.svg"), null);
  assert.equal(institutionLogoUrl("/outro/208.svg"), null);
});

await test("a conflicting set of COMPE codes is visible to the caller", () => {
  const one = [{ bankData: { transferNumber: "208/1/1" } }, { bankData: null }];
  assert.deepEqual([...accountCompes(one)], ["208"]);
  assert.equal(
    accountCompes([...one, { bankData: { transferNumber: "260/1/1" } }]).size,
    2,
  );
});

await test("account keys need COMPE, agency and account", () => {
  assert.equal(accountHolderKey("208 / 0001 / 123-4"), "208/0001/123-4");
  assert.equal(accountHolderKey("8/1/1"), "008/1/1");
  assert.equal(accountHolderKey("208/0001"), null);
  assert.equal(accountHolderKey("/0001/123"), null);
  assert.equal(accountHolderKey(null), null);
});

await test("a connection is a duplicate only when every identifiable account is held", () => {
  const held = new Set(["a", "b"]);
  assert.equal(isDuplicateConnection(["a", "b"], held), true);
  assert.equal(isDuplicateConnection(["a", "c"], held), false);
  assert.equal(isDuplicateConnection([], held), false);
});
