import assert from "node:assert/strict";

import { beforeEach, test } from "vitest";
import { z } from "zod/v4";

import { RuleJobStatus } from "../../src/domain";
import { ruleJobService } from "../../src/worker/composition";
import { createPlanningService } from "../../src/worker/planning";
import { createPlanningRepository } from "../../src/worker/planning/repository";
import { settings } from "./access-fixture";
import { collect, setup, source, transaction } from "./fixture";
import { env } from "cloudflare:workers";

beforeEach(setup);

const rides = Array.from({ length: 1201 }, (_, index) =>
  transaction({
    date: "2026-09-01",
    description: "CORRIDA SINTETICA",
    id: `ride-${String(index).padStart(4, "0")}`,
  }),
);
const categories = [
  { key: "transport", kind: "expense", name: "Transporte sintético" },
  { key: "subscriptions", kind: "expense", name: "Assinatura sintética" },
  { invalid: true },
];

async function drive(id: string) {
  const service = ruleJobService(settings());
  const job = await service.begin(id);
  async function imports(seq: number): Promise<void> {
    if (seq < job.chunks) {
      await service.importChunk(id, seq);
      await imports(seq + 1);
    }
  }
  async function passes(pass: number): Promise<void> {
    if (!(await service.applyPass(id, pass)).done) {
      await passes(pass + 1);
    }
  }
  await imports(0);
  await passes(0);
  await service.finish(id);
  return service.read(id);
}

test("an import job accepts every valid rule, skips the rest and reapplies the whole history", async () => {
  await collect(
    source([
      ...rides,
      transaction({ description: "STREAMING SINTETICO", id: "stream" }),
    ]),
  );
  const service = ruleJobService(settings());
  const created = await service.command({
    action: "create_import",
    chunks: 2,
    csrf: "",
    pack: { categories, id: "synthetic-job", version: 1 },
    received: 5,
    spaceId: "personal",
  });
  await service.command({
    action: "append",
    csrf: "",
    id: created.id,
    rules: [
      {
        categoryKey: "transport",
        key: "rides",
        name: "Corridas",
        text: "corrida",
      },
      { categoryKey: "transport", key: "empty", name: "Sem condição" },
      { categoryKey: "missing", key: "orphan", name: "Órfã", text: "x" },
    ],
    seq: 0,
  });
  await service.command({
    action: "append",
    csrf: "",
    id: created.id,
    rules: [
      {
        categoryKey: "subscriptions",
        key: "streaming",
        name: "Streaming",
        text: "streaming",
      },
      { categoryKey: "transport", key: "rides", name: "Repetida", text: "y" },
      { categoryKey: "transport", key: "numeric", name: 7, text: "z" },
    ],
    seq: 1,
  });
  const queued = await service.command({
    action: "start",
    csrf: "",
    id: created.id,
  });
  assert.equal(queued.status, RuleJobStatus.queued);
  await assert.rejects(
    service.command({ action: "reapply", csrf: "", spaceId: "personal" }),
    { message: "JOB_ACTIVE" },
  );
  const service2 = ruleJobService(settings());
  await service2.begin(created.id);
  await service2.importChunk(created.id, 0);
  const done = await drive(created.id);
  assert.ok(done);
  assert.equal(done.status, RuleJobStatus.succeeded);
  assert.equal(done.imported.rulesCreated, 2);
  assert.equal(
    done.imported.rulesExisting,
    1,
    "a key repeated in a later chunk is the same imported rule",
  );
  assert.deepEqual(
    done.imported.skipped.toSorted((a, b) => a.key.localeCompare(b.key)),
    [
      {
        key: "empty",
        reason: "Adicione texto ou condições compostas à regra.",
      },
      {
        key: "numeric",
        reason: "name: Entrada inválida: esperava um texto, recebeu um número",
      },
      { key: "orphan", reason: "Categoria não declarada no arquivo." },
    ],
  );
  assert.equal(done.applied.changed, 1202);
  assert.ok(done.applied.passes >= 3);

  const planning = createPlanningService(createPlanningRepository(env.DB));
  const rows = await planning.execute({
    from: "2026-09-01",
    include_ignored: false,
    limit: 5,
    order: "id",
    spaceId: "personal",
    to: "2026-10-31",
    tool: "get_transactions",
    uncategorized: true,
  });
  assert.deepEqual(
    z.object({ data: z.object({ records: z.array(z.unknown()) }) }).parse(rows)
      .data.records,
    [],
    "no matching transaction is left uncategorized",
  );

  const reapplied = await service.command({
    action: "reapply",
    csrf: "",
    spaceId: "personal",
  });
  const settled = await drive(reapplied.id);
  assert.equal(settled?.applied.changed, 0);
  assert.equal(settled?.applied.passes, 1);
});
