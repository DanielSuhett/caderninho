import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmdirSync, unlinkSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import test from "node:test";

const project = resolve(import.meta.dirname, "../../..");

function check(input: {
  root?: string;
  file: string;
  source: string;
  rule?: string;
}) {
  const directory = mkdtempSync(
    join(project, input.root ?? "src/worker", "architecture-probe-"),
  );
  const file = join(directory, input.file);
  try {
    writeFileSync(file, input.source, { flag: "wx" });
    const result = spawnSync(
      process.execPath,
      [
        join(project, "node_modules/@biomejs/biome/bin/biome"),
        "lint",
        file,
        `--only=style/${input.rule ?? "noRestrictedImports"}`,
        "--colors=off",
      ],
      { cwd: project, encoding: "utf8" },
    );
    assert.ifError(result.error);
    return { status: result.status, output: result.stdout + result.stderr };
  } finally {
    unlinkSync(file);
    rmdirSync(directory);
  }
}

await test("native layer rules reject SQL in application helpers, aliases, dynamic imports and barrel exports", () => {
  for (const source of [
    'import { database } from "../database";',
    'import { database } from "@/worker/database";',
    'import { sql } from "drizzle-orm";',
    'import { createSyncRepository } from "@/worker/sync/repository";',
    'export { createSyncRepository } from "@/worker/sync/repository";',
    'export * from "../sync/repository";',
    'export const load = () => import("@/worker/sync/repository");',
  ]) {
    const result = check({ file: "helper.ts", source });
    assert.equal(result.status, 1, source + result.output);
    assert.match(result.output, /lint\/style\/noRestrictedImports/);
  }
  const barrel = check({
    file: "index.ts",
    source: 'export { createSyncRepository } from "@/worker/sync/repository";',
  });
  assert.equal(barrel.status, 1, barrel.output);
});

await test("native rules reject services depending on transport, repositories depending on services, and frontend depending on backend", () => {
  for (const input of [
    {
      file: "service.ts",
      source: 'import { syncService } from "../composition";',
    },
    {
      file: "helper.ts",
      source: 'import { syncService } from "../composition";',
    },
    {
      file: "execution.service.ts",
      source: 'import { createPluggyAdapter } from "@/worker/pluggy/adapter";',
    },
    {
      file: "repository.ts",
      source: 'import { runOperation } from "../sync/service";',
    },
    {
      file: "repository.ts",
      source: 'import { runOperation } from "@/worker/sync";',
    },
    {
      file: "entity.ts",
      source: 'import { runOperation } from "../sync/service";',
    },
    {
      file: "helper.ts",
      root: "src/web",
      source: 'import { runOperation } from "@/worker/sync";',
    },
  ]) {
    const result = check(input);
    assert.equal(result.status, 1, input.source + result.output);
    assert.match(result.output, /lint\/style\/noRestrictedImports/);
  }
  const directFetch = check({
    file: "service.ts",
    source: 'export const run = () => fetch("https://synthetic.test");',
    rule: "noRestrictedGlobals",
  });
  assert.equal(directFetch.status, 1, directFetch.output);
  assert.match(directFetch.output, /lint\/style\/noRestrictedGlobals/);
  const binding = check({
    file: "service.ts",
    source: "export type Dependencies = { db: D1Database };",
    rule: "noRestrictedTypes",
  });
  assert.equal(binding.status, 1, binding.output);
  assert.match(binding.output, /lint\/style\/noRestrictedTypes/);
});

await test("native rules allow entity ports, composition in controllers and SQL in repositories", () => {
  for (const input of [
    {
      file: "service.ts",
      source: 'import type { ExecutionRepository } from "../sync/entity";',
    },
    {
      file: "controller.ts",
      source: 'import { syncService } from "../composition";',
    },
    {
      file: "repository.ts",
      source: 'import { database } from "../database";',
    },
    {
      file: "execution.repository.ts",
      source: 'import { sql } from "drizzle-orm";',
    },
    {
      file: "entity.ts",
      source: 'import type { operations } from "../schema";',
    },
  ]) {
    const result = check(input);
    assert.equal(result.status, 0, input.source + result.output);
  }
});
