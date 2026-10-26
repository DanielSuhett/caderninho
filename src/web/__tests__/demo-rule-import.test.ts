import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";

import {
  type PortalMutation,
  RuleImportPackageSchema,
  RuleImportResultSchema,
} from "../../contracts";
import { createDemoSession } from "../demo-session";

const { signal } = new AbortController();
afterEach(() => mock.restoreAll());
const pack = RuleImportPackageSchema.parse({
  categories: [{ key: "books", kind: "expense", name: "Livros de teste" }],
  id: "qa-synthetic",
  rules: [
    {
      categoryKey: "books",
      key: "bookshop",
      name: "Livraria QA",
      text: "livraria",
    },
  ],
  version: 1,
});
async function preview(session: ReturnType<typeof createDemoSession>) {
  return (
    await session.api.query(
      { pack, spaceId: "personal", tool: "preview_rule_import" },
      "synthetic",
      signal,
    )
  ).data;
}
function command(revision: number, key = "demo-import"): PortalMutation {
  return {
    confirmed: true,
    idempotency_key: key,
    pack,
    revision,
    spaceId: "personal",
    tool: "import_rules",
  };
}
test("demo rule import previews without writing and imports without touching history", async () => {
  const session = createDemoSession();
  const original = structuredClone(session.view().records);
  const initial = session.catalog("personal");
  const result = RuleImportResultSchema.parse(await preview(session));
  assert.equal(result.rulesCreated, 1);
  assert.equal(result.categoriesCreated, 1);
  assert.equal(
    (await preview(session)).categories[0]?.id,
    result.categories[0]?.id,
  );
  assert.deepEqual(session.catalog("personal"), initial);
  await session.api.planning(command(result.revision), "synthetic", signal);
  const imported = session.catalog("personal");
  assert.equal(imported.rules.length, initial.rules.length + 1);
  assert.equal(imported.categories.length, initial.categories.length + 1);
  assert.ok(
    imported.categories.some(
      (category) => category.id === result.categories[0]?.id,
    ),
  );
  assert.deepEqual(session.view().records, original);
  const revision = session.revision();
  await session.api.planning(command(result.revision), "synthetic", signal);
  assert.equal(session.revision(), revision);
  const repeated = await preview(session);
  assert.equal(repeated.rulesCreated, 0);
  assert.equal(repeated.rulesExisting, 1);
});
test("stale import revisions and invalid rule references leave the synthetic catalog intact", async () => {
  const session = createDemoSession();
  const result = await preview(session);
  session.applyRules("personal");
  const original = session.catalog("personal");
  await assert.rejects(
    session.api.planning(command(result.revision), "synthetic", signal),
    { message: "RESTART_REQUIRED" },
  );
  const invalid = RuleImportPackageSchema.parse({
    ...pack,
    rules: pack.rules.map((rule) => ({
      ...rule,
      accountId: "missing-account",
    })),
  });
  await assert.rejects(
    session.api.query(
      { pack: invalid, spaceId: "personal", tool: "preview_rule_import" },
      "synthetic",
      signal,
    ),
    { message: "NOT_FOUND" },
  );
  assert.deepEqual(session.catalog("personal"), original);
});

test("concurrent retries share a receipt and preserve the imported rule on a repeated package", async () => {
  const session = createDemoSession();
  const result = await preview(session);
  const write = command(result.revision);
  await Promise.all([
    session.api.planning(write, "synthetic", signal),
    session.api.planning(write, "synthetic", signal),
  ]);
  assert.equal(session.revision(), 1);
  const imported = session
    .catalog("personal")
    .rules.find((rule) => rule.pack?.id === pack.id);
  assert.ok(imported);
  const { pack: _origin, ...editable } = imported;
  await session.api.planning(
    {
      ...editable,
      confirmed: true,
      enabled: false,
      idempotency_key: "edit-imported",
      name: "Nome escolhido",
      spaceId: "personal",
      tool: "update_rule",
    },
    "synthetic",
    signal,
  );
  const repeated = await preview(session);
  assert.equal(repeated.rulesExisting, 1);
  assert.equal(repeated.rulesCreated, 0);
  assert.equal(repeated.rules[0]?.enabled, false);
  assert.equal(repeated.rules[0]?.name, "Nome escolhido");
});

test("demo import works on an HTTP LAN preview without a secure-context digest", async () => {
  mock.method(crypto.subtle, "digest", () =>
    Promise.reject(new Error("Unavailable outside a secure context")),
  );
  const session = createDemoSession();
  const result = await preview(session);
  await session.api.planning(command(result.revision), "synthetic", signal);
  assert.equal((await preview(session)).rulesExisting, 1);
});
