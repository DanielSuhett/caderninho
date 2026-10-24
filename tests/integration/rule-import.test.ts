import assert from "node:assert/strict";

import { beforeEach, test } from "vitest";
import { z } from "zod/v4";

import {
  PlanningCommandSchema,
  RuleImportPackageSchema,
  RuleImportResultSchema,
} from "../../src/contracts";
import { createPlanningService } from "../../src/worker/planning";
import { createPlanningRepository } from "../../src/worker/planning/repository";
import {
  fixture as appFixture,
  command,
  cookies,
  login,
} from "./access-fixture";
import { collect, setup, source, transaction } from "./fixture";
import { env } from "cloudflare:workers";

beforeEach(setup);
const pack = RuleImportPackageSchema.parse({
  categories: [
    {
      key: "constructor",
      kind: "expense",
      name: "Categoria sintética importada",
    },
  ],
  id: "catalogo-livre",
  rules: [
    {
      categoryKey: "constructor",
      direction: "DEBIT",
      filter: {
        alternatives: [
          {
            conditions: [
              {
                field: "description",
                operator: "equals",
                value: "OFICINA SINTETICA",
              },
            ],
          },
        ],
        currency: "BRL",
      },
      key: "oficina",
      name: "Oficina sintética",
    },
  ],
  version: 1,
});
function fixture() {
  const repository = createPlanningRepository(env.DB);
  const service = createPlanningService(repository);
  const call = (tool: string, args: Record<string, unknown> = {}) =>
    service.execute(
      PlanningCommandSchema.parse({ spaceId: "personal", tool, ...args }),
    );
  const write = (tool: string, args: Record<string, unknown> = {}) =>
    call(tool, {
      confirmed: true,
      idempotency_key: crypto.randomUUID(),
      ...args,
    });
  const preview = async (args: Record<string, unknown> = {}) =>
    z
      .object({ data: RuleImportResultSchema })
      .parse(await call("preview_rule_import", { pack, ...args })).data;
  return { call, preview, repository, write };
}
const identify = (value: unknown) =>
  z.object({ id: z.string() }).parse(value).id;

test("generic preview is read-only; revision guards stale confirmation, exact retry and concurrent double click are atomic", async () => {
  const f = fixture();
  const before = await f.repository.read();
  const preview = await f.preview();
  assert.equal(preview.rulesCreated, 1);
  assert.equal(preview.categoriesCreated, 1);
  assert.deepEqual(await f.repository.read(), before);
  await f.write("create_tag", { color: "blue", name: "Nova revisão" });
  await assert.rejects(
    () => f.write("import_rules", { pack, revision: preview.revision }),
    { message: "RESTART_REQUIRED" },
  );
  assert.equal((await f.repository.read()).state.rules.length, 0);
  const fresh = await f.preview();
  const request = {
    idempotency_key: "same-import",
    pack,
    revision: fresh.revision,
  };
  const results = await Promise.all([
    f.write("import_rules", request),
    f.write("import_rules", request),
  ]);
  assert.deepEqual(results[0], results[1]);
  assert.deepEqual(await f.write("import_rules", request), results[0]);
  const stored = await f.repository.read();
  assert.equal(stored.state.rules.length, 1);
  const categoryId = stored.state.rules[0]?.categoryId;
  assert.ok(categoryId);
  await f.write("update_category", {
    id: categoryId,
    name: "Meu nome preservado",
  });
  const repeat = await f.preview();
  assert.equal(repeat.rulesCreated, 0);
  assert.equal(repeat.categoriesCreated, 0);
  await f.write("import_rules", { pack, revision: repeat.revision });
  assert.equal((await f.repository.read()).state.rules.length, 1);
  assert.equal(
    (await f.repository.read()).state.categories.find(
      (c) => c.id === categoryId,
    )?.name,
    "Meu nome preservado",
  );
  await collect(source([transaction({ description: "OFICINA SINTETICA" })]));
  assert.equal(
    (await f.repository.read()).state.edits.find((e) => e.id === "t")?.category,
    categoryId,
  );
});

test("ambiguous categories are visible in preview and block the entire write until explicitly resolved", async () => {
  const f = fixture();
  const selected = identify(
    await f.write("create_category", { kind: "expense", name: "Duplicada" }),
  );
  await f.write("create_category", { kind: "expense", name: "Duplicada" });
  const ambiguous = RuleImportPackageSchema.parse({
    ...pack,
    categories: [
      ...pack.categories,
      { key: "ambigua", kind: "expense", name: "Duplicada" },
    ],
    rules: [
      ...pack.rules,
      {
        ...pack.rules[0],
        categoryKey: "ambigua",
        key: "second",
        text: "OUTRA",
      },
    ],
  });
  const before = await f.repository.read();
  const preview = await f.preview({ pack: ambiguous });
  assert.equal(
    preview.categories.find((c) => c.key === "ambigua")?.status,
    "ambiguous",
  );
  assert.equal(
    preview.rules.find((r) => r.key === "second")?.status,
    "blocked",
  );
  await assert.rejects(
    () =>
      f.write("import_rules", { pack: ambiguous, revision: preview.revision }),
    { message: "INVALID_RULE_IMPORT_CATEGORY" },
  );
  assert.deepEqual(await f.repository.read(), before);
  const categoryIds = { ambigua: selected };
  const resolved = await f.preview({ categoryIds, pack: ambiguous });
  assert.equal(resolved.rulesCreated, 2);
  await f.write("import_rules", {
    categoryIds,
    pack: ambiguous,
    revision: resolved.revision,
  });
  assert.equal((await f.repository.read()).state.rules.length, 2);
});

test("identical rules across packages or repeated keys preserve existing personal priorities and pauses", async () => {
  const f = fixture();
  const categoryId = identify(
    await f.write("create_category", {
      kind: "expense",
      name: pack.categories[0]?.name,
    }),
  );
  const [native] = pack.rules;
  assert.ok(native);
  const { key: _key, categoryKey: _categoryKey, ...fields } = native;
  const personal = identify(
    await f.write("create_rule", {
      ...fields,
      categoryId,
      enabled: false,
      priority: 1000,
    }),
  );
  const preview = await f.preview();
  assert.equal(preview.rulesCreated, 0);
  assert.equal(preview.rulesExisting, 1);
  await f.write("import_rules", { pack, revision: preview.revision });
  const {
    state: { rules },
  } = await f.repository.read();
  assert.equal(rules.length, 1);
  assert.equal(rules[0]?.id, personal);
  assert.equal(rules[0]?.enabled, false);
  assert.equal(rules[0]?.priority, 1000);
  const twins = RuleImportPackageSchema.parse({
    ...pack,
    categories: [
      { ...pack.categories[0], key: "constructor", name: "Outra categoria" },
    ],
    id: "twins",
    rules: [native, { ...native, key: "clone" }],
  });
  const twinPreview = await f.preview({ pack: twins });
  assert.equal(twinPreview.rulesCreated, 1);
  assert.equal(twinPreview.rulesExisting, 1);
});

test("scope and native account references are checked before persistence", async () => {
  const f = fixture();
  const spaceId = identify(
    await f.write("create_space", { currency: "BRL", name: "Outro" }),
  );
  const foreign = identify(
    await f.write("create_category", {
      kind: "expense",
      name: "Outro curso",
      spaceId,
    }),
  );
  const preview = await f.preview({ categoryIds: { constructor: foreign } });
  assert.equal(preview.categories[0]?.status, "invalid");
  await assert.rejects(
    () =>
      f.write("import_rules", {
        categoryIds: { constructor: foreign },
        pack,
        revision: preview.revision,
      }),
    { message: "INVALID_RULE_IMPORT_CATEGORY" },
  );
  const accountId = identify(
    await f.write("create_manual_account", {
      currency: "BRL",
      name: "Outra conta",
      openingBalanceMinor: "0",
      spaceId,
      type: "BANK",
    }),
  );
  const scoped = RuleImportPackageSchema.parse({
    ...pack,
    rules: [{ ...pack.rules[0], accountId }],
  });
  await assert.rejects(() => f.preview({ pack: scoped }), {
    message: "SPACE_MISMATCH",
  });
  assert.equal((await f.repository.read()).state.rules.length, 0);
});

test("authenticated UI endpoints preview and import the same JSON, enforce CSRF and reject invalid schema and oversized bodies", async () => {
  const app = appFixture();
  const cookie = cookies(await login(app));
  const previewResponse = await command(app, cookie, "query", {
    query: { pack, spaceId: "personal", tool: "preview_rule_import" },
  });
  assert.equal(previewResponse.status, 200);
  const preview = z
    .object({ data: RuleImportResultSchema })
    .parse(await previewResponse.json()).data;
  const input = {
    confirmed: true,
    idempotency_key: "panel-import",
    pack,
    revision: preview.revision,
    spaceId: "personal",
    tool: "import_rules",
  };
  const applied = await command(app, cookie, "planning", { command: input });
  assert.equal(applied.status, 200);
  const result = RuleImportResultSchema.parse(await applied.json());
  assert.equal(result.rulesCreated, 1);
  assert.deepEqual(
    await (await command(app, cookie, "planning", { command: input })).json(),
    result,
  );
  assert.equal(
    (await createPlanningRepository(env.DB).read()).state.rules.length,
    1,
  );
  const invalid = await command(app, cookie, "query", {
    query: {
      pack: {
        ...pack,
        rules: Array.from({ length: 101 }, (_, i) => ({
          ...pack.rules[0],
          key: `rule-${i}`,
        })),
      },
      spaceId: "personal",
      tool: "preview_rule_import",
    },
  });
  assert.equal(invalid.status, 400);
  const huge = await command(app, cookie, "query", {
    query: {
      pack: { ...pack, id: "x".repeat(90_000) },
      spaceId: "personal",
      tool: "preview_rule_import",
    },
  });
  assert.equal(huge.status, 413);
  const csrf = await app.request("/api/account/planning", {
    body: JSON.stringify({ command: input, csrf: "wrong" }),
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
      Origin: "https://caderninho.test",
    },
    method: "POST",
  });
  assert.equal(csrf.status, 403);
});

test("the declared maximum is persisted in one atomic import", async () => {
  const f = fixture();
  const maximum = RuleImportPackageSchema.parse({
    categories: Array.from({ length: 50 }, (_, i) => ({
      key: `category-${i}`,
      kind: "expense",
      name: `Categoria sintética ${i}`,
    })),
    id: "maximum",
    rules: Array.from({ length: 100 }, (_, i) => ({
      categoryKey: `category-${i % 50}`,
      key: `rule-${i}`,
      name: `Regra sintética ${i}`,
      text: `SYNTHETIC ${i}`,
    })),
    version: 1,
  });
  const preview = await f.preview({ pack: maximum });
  assert.equal(preview.rulesCreated, 100);
  assert.equal(preview.categoriesCreated, 50);
  await f.write("import_rules", { pack: maximum, revision: preview.revision });
  const { state } = await f.repository.read();
  assert.equal(state.rules.length, 100);
  assert.equal(
    state.categories.filter((c) => c.name.startsWith("Categoria sintética "))
      .length,
    50,
  );
});
