import assert from "node:assert/strict";

import { beforeEach, test } from "vitest";
import { z } from "zod/v4";

import {
  PlanningCommandSchema,
  type PortalMutation,
  RuleImportPackageSchema,
  RuleImportResultSchema,
} from "../../src/contracts";
import { transactionFixture } from "../../src/fixtures/finance";
import { createDemoSession } from "../../src/web/demo-session";
import { createPlanningService } from "../../src/worker/planning";
import { createPlanningRepository } from "../../src/worker/planning/repository";
import { account, collect, setup, source, transaction } from "./fixture";
import { env } from "cloudflare:workers";

beforeEach(setup);
const { signal } = new AbortController();
const period = { from: "2026-10-01", spaceId: "personal", to: "2026-10-31" };
const pack = RuleImportPackageSchema.parse({
  categories: [
    { key: "first", kind: "expense", name: "Primeira sintética" },
    { key: "second", kind: "expense", name: "Segunda sintética" },
  ],
  id: "reapply-synthetic",
  rules: [
    {
      categoryKey: "second",
      key: "unused",
      name: "Outra",
      text: "NUNCA_CORRESPONDE",
    },
    {
      categoryKey: "first",
      key: "workshop",
      name: "Oficina sintética",
      text: "OFICINA",
    },
  ],
  version: 1,
});

for (const backend of ["product", "demo"] as const) {
  test(`${backend}: preview and confirmed reapplication agree, protect manual null/ignored rows and allow automatic categories to be revised`, async () => {
    const ledger = [
      transactionFixture({ description: "OFICINA", id: "free" }),
      transactionFixture({ description: "OFICINA", id: "manual" }),
      transactionFixture({
        description: "OFICINA",
        id: "ignored",
        ignored: true,
      }),
      transactionFixture({
        date: "2026-09-10",
        description: "OFICINA",
        id: "old",
      }),
      transactionFixture({
        accountId: "demo-card",
        description: "OFICINA",
        id: "other-account",
      }),
    ];
    const demo = createDemoSession({ ledger });
    const repository = createPlanningRepository(env.DB);
    const product = createPlanningService(repository);
    const revision = () =>
      backend === "product"
        ? repository.revision()
        : Promise.resolve(demo.revision());
    const save = (input: PortalMutation) =>
      backend === "product"
        ? product.execute(PlanningCommandSchema.parse(input))
        : demo.api.planning(input, "synthetic", signal);
    const Applied = z.object({
      changed: z.number(),
      count: z.number(),
      ids: z.array(z.string()),
      preserved: z.number(),
      truncated: z.boolean(),
    });
    const reapply = async (key: string) =>
      Applied.parse(
        await save({
          ...period,
          accountId: "demo-bank",
          confirmed: true,
          expected_revision: await revision(),
          idempotency_key: key,
          preserveManual: true,
          tool: "apply_rules",
        }),
      );
    if (backend === "product") {
      await collect(
        source(
          ledger.map((row) =>
            transaction({
              accountId: row.accountId,
              date: row.date,
              description: row.description,
              id: row.id,
            }),
          ),
          [
            account({ id: "demo-bank" }),
            account({ id: "demo-card", type: "CREDIT" }),
          ],
        ),
      );
      await product.execute(
        PlanningCommandSchema.parse({
          confirmed: true,
          id: "ignored",
          idempotency_key: "ignore",
          ignored: true,
          spaceId: "personal",
          tool: "edit_transaction",
        }),
      );
    }
    await save({
      category: null,
      confirmed: true,
      expected_revision: await revision(),
      idempotency_key: "manual-null",
      ids: ["manual"],
      spaceId: "personal",
      tool: "batch_edit_transactions",
    });
    const imported =
      backend === "product"
        ? z.object({ data: RuleImportResultSchema }).parse(
            await product.execute(
              PlanningCommandSchema.parse({
                pack,
                spaceId: "personal",
                tool: "preview_rule_import",
              }),
            ),
          ).data
        : (
            await demo.api.query(
              { pack, spaceId: "personal", tool: "preview_rule_import" },
              "synthetic",
              signal,
            )
          ).data;
    await save({
      confirmed: true,
      idempotency_key: "import",
      pack,
      revision: imported.revision,
      spaceId: "personal",
      tool: "import_rules",
    });
    const command = {
      ...period,
      accountId: "demo-bank",
      confirmed: true,
      expected_revision: await revision(),
      idempotency_key: "apply",
      preserveManual: true,
      tool: "apply_rules",
    } as const;
    const outcome = Applied.parse(await save(command));
    assert.equal(outcome.count, 3);
    assert.equal(outcome.changed, 1);
    assert.equal(outcome.preserved, 2);
    assert.deepEqual(outcome.ids, ["free"]);
    assert.equal(outcome.truncated, false);
    assert.deepEqual(Applied.parse(await save(command)), outcome);
    await assert.rejects(save({ ...command, idempotency_key: "stale" }), {
      message: "RESTART_REQUIRED",
    });
    await assert.rejects(save({ ...command, to: "2026-10-30" }), {
      message: "IDEMPOTENCY_CONFLICT",
    });
    assert.equal((await reapply("settled")).changed, 0);
    const rules =
      backend === "product"
        ? (await repository.read()).state.rules
        : demo.catalog("personal").rules;
    const categories =
      backend === "product"
        ? (await repository.read()).state.categories
        : demo.catalog("personal").categories;
    const rule = rules.find(
      (row) => row.pack?.id === pack.id && row.pack.key === "workshop",
    );
    const category = categories.find((row) => row.name === "Segunda sintética");
    assert.ok(rule);
    assert.ok(category);
    await save({
      categoryId: category.id,
      confirmed: true,
      id: rule.id,
      idempotency_key: "revise-rule",
      name: rule.name,
      spaceId: "personal",
      text: rule.text,
      tool: "update_rule",
    });
    const revised = await reapply("apply-revised");
    assert.equal(revised.changed, 1);
    assert.equal(revised.preserved, 2);
    assert.equal((await reapply("revised-settled")).changed, 0);
  });

  test(`${backend}: preserving applications above 500 changes converge in bounded atomic passes`, async () => {
    const ledger = Array.from({ length: 501 }, (_, index) =>
      transactionFixture({ description: "OFICINA", id: `large-${index}` }),
    );
    const demo = createDemoSession({ ledger });
    const repository = createPlanningRepository(env.DB);
    const product = createPlanningService(repository);
    const revision = () =>
      backend === "product"
        ? repository.revision()
        : Promise.resolve(demo.revision());
    const save = (input: PortalMutation) =>
      backend === "product"
        ? product.execute(PlanningCommandSchema.parse(input))
        : demo.api.planning(input, "synthetic", signal);
    if (backend === "product") {
      await collect(
        source(
          ledger.map((row) =>
            transaction({
              accountId: row.accountId,
              description: row.description,
              id: row.id,
            }),
          ),
          [account({ id: "demo-bank" })],
        ),
      );
    }
    const imported =
      backend === "product"
        ? z.object({ data: RuleImportResultSchema }).parse(
            await product.execute(
              PlanningCommandSchema.parse({
                pack,
                spaceId: "personal",
                tool: "preview_rule_import",
              }),
            ),
          ).data
        : (
            await demo.api.query(
              { pack, spaceId: "personal", tool: "preview_rule_import" },
              "synthetic",
              signal,
            )
          ).data;
    await save({
      confirmed: true,
      idempotency_key: "import",
      pack,
      revision: imported.revision,
      spaceId: "personal",
      tool: "import_rules",
    });
    const pass = async (key: string) =>
      z.object({ changed: z.number(), truncated: z.boolean() }).parse(
        await save({
          ...period,
          confirmed: true,
          expected_revision: await revision(),
          idempotency_key: key,
          preserveManual: true,
          tool: "apply_rules",
        }),
      );
    assert.deepEqual(await pass("first"), { changed: 500, truncated: true });
    assert.deepEqual(await pass("second"), { changed: 1, truncated: false });
    assert.deepEqual(await pass("third"), { changed: 0, truncated: false });
  });
}

test("rules applied during import retain their origin and can be reapplied without overwriting subsequent manual categories", async () => {
  const repository = createPlanningRepository(env.DB);
  const service = createPlanningService(repository);
  const save = (input: Record<string, unknown>) =>
    service.execute(
      PlanningCommandSchema.parse({
        confirmed: true,
        idempotency_key: crypto.randomUUID(),
        spaceId: "personal",
        ...input,
      }),
    );
  const category = z
    .object({ id: z.string() })
    .parse(
      await save({ kind: "expense", name: "Origem", tool: "create_category" }),
    );
  const rule = z.object({ id: z.string() }).parse(
    await save({
      categoryId: category.id,
      name: "Importação",
      text: "Synthetic",
      tool: "create_rule",
    }),
  );
  await collect(source([transaction()]));
  assert.equal(
    (await repository.read()).state.edits[0]?.categoryRuleId,
    rule.id,
  );
  await save({
    categoryId: "personal:expense",
    id: rule.id,
    name: "Mudou",
    text: "Synthetic",
    tool: "update_rule",
  });
  const reapply = async () =>
    z
      .object({ changed: z.number(), preserved: z.number() })
      .parse(
        await save({ ...period, preserveManual: true, tool: "apply_rules" }),
      );
  assert.equal((await reapply()).changed, 1);
  await save({ category: null, id: "t", tool: "edit_transaction" });
  const protectedPass = await reapply();
  assert.equal(protectedPass.changed, 0);
  assert.equal(protectedPass.preserved, 1);
});
