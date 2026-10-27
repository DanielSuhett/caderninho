import assert from "node:assert/strict";
import test from "node:test";

import { createInstitutionCatalog } from "../catalog.adapter";

await test("finds a bank by COMPE with or without leading zeros", async () => {
  const catalog = createInstitutionCatalog();
  const nubank = await catalog.find("260");
  assert.equal(nubank?.id, "compe:260");
  assert.equal(nubank?.name, "Nubank");
  assert.equal(nubank?.logoUrl, "/bancos/260.svg");
  assert.equal((await catalog.find("1"))?.id, "compe:001");
  assert.equal((await catalog.find("001"))?.id, "compe:001");
});

await test("rejects missing and malformed codes", async () => {
  const catalog = createInstitutionCatalog();
  assert.equal(await catalog.find("999"), null);
  assert.equal(await catalog.find("abc"), null);
  assert.equal(await catalog.find(""), null);
  assert.equal(await catalog.find("1234"), null);
});

await test("lists slim institutions sorted in pt-BR", async () => {
  const records = await createInstitutionCatalog().list();
  assert.ok(records.length > 100);
  assert.deepEqual(Object.keys(records[0] ?? {}).sort(), [
    "id",
    "logoUrl",
    "name",
  ]);
  const names = records.map((row) => row.name);
  assert.deepEqual(
    names,
    [...names].sort((a, b) => a.localeCompare(b, "pt-BR")),
  );
  assert.equal(new Set(records.map((row) => row.id)).size, records.length);
});
