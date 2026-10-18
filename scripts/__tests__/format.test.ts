import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { z } from "zod/v4";

import { tryCatch } from "#shared/result.ts";

import { projectRoot } from "../check-imports.ts";

const exec = promisify(execFile);
const biome = join(projectRoot, "node_modules/@biomejs/biome/bin/biome");

async function fixtureConfig(directory: string) {
  const config = z
    .record(z.string(), z.json())
    .parse(JSON.parse(await readFile(join(projectRoot, "biome.json"), "utf8")));
  const path = join(directory, "biome.json");
  await writeFile(path, JSON.stringify({ ...config, vcs: { enabled: false } }));

  return path;
}

await test("Biome import fixes and formatting converge while retaining aliases, comments and side-effect order", async () => {
  const directory = await mkdtemp(join(tmpdir(), "caderninho-biome-imports-"));
  try {
    const config = await fixtureConfig(directory);
    await writeFile(
      join(directory, "model.ts"),
      "export const value = 1; export type Model = string;",
    );
    await writeFile(join(directory, "types.ts"), "export type Other = number;");
    for (const effect of ["first", "second"]) {
      await writeFile(join(directory, `${effect}.ts`), "export {};\n");
    }
    const file = join(directory, "fixture.tsx");
    await writeFile(
      file,
      `// Preserve this explanation of the model.
import "./first.ts";
import { value as renamed, type Model } from "./model.ts";
import "./second.ts";
import { type Other } from "./types.ts";
export { renamed as alias };
export type { Model, Other };
export const view = <input aria-label="Synthetic" disabled={false} value={renamed} />;
`,
    );
    const fix = () =>
      exec(
        process.execPath,
        [
          biome,
          "check",
          "--write",
          "--config-path",
          config,
          "--only",
          "assist/source/organizeImports",
          "--only",
          "style/useImportType",
          "--only",
          "style/useExportType",
          file,
        ],
        { timeout: 30000 },
      );
    await fix();
    const once = await readFile(file, "utf8");
    await fix();
    assert.equal(await readFile(file, "utf8"), once);
    assert.match(once, /value as renamed/);
    assert.match(once, /import type \{ Other \}/);
    assert.match(once, /Preserve this explanation/);
    assert.match(once, /renamed as alias/);
    assert.ok(once.indexOf('"./first.ts"') < once.indexOf('"./second.ts"'));
    assert.match(
      once,
      /<input\n\s+aria-label="Synthetic"\n\s+disabled=\{false\}\n\s+value=\{renamed\}/,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

await test("Biome enforces native braces, nested ternaries and type assertions without formatter conflict", async () => {
  const directory = await mkdtemp(join(tmpdir(), "caderninho-biome-policy-"));
  try {
    const config = await fixtureConfig(directory);
    const file = join(directory, "fixture.ts");
    await writeFile(
      file,
      `export function value(input: unknown) {
  if (input) return input as string;
  return flag ? yes ? 1 : 2 : 3;
}
`,
    );
    const result = await tryCatch(
      exec(
        process.execPath,
        [
          biome,
          "lint",
          "--config-path",
          config,
          "--reporter=json",
          "--only",
          "style/useBlockStatements",
          "--only",
          "style/noNestedTernary",
          "--only",
          "nursery/noUnsafeTypeAssertion",
          file,
        ],
        { timeout: 30000 },
      ),
    );
    assert.ok(result.error);
    const failure = z
      .object({ code: z.number(), stdout: z.string() })
      .parse(result.error);
    assert.equal(failure.code, 1);
    const report = z
      .object({ diagnostics: z.array(z.object({ category: z.string() })) })
      .parse(JSON.parse(failure.stdout));
    assert.deepEqual(
      new Set(report.diagnostics.map((item) => item.category)),
      new Set([
        "lint/style/useBlockStatements",
        "lint/style/noNestedTernary",
        "lint/nursery/noUnsafeTypeAssertion",
      ]),
    );
    await writeFile(file, "export const result = left === right;\n");
    await exec(
      process.execPath,
      [biome, "format", "--write", "--config-path", config, file],
      { timeout: 30000 },
    );
    await exec(
      process.execPath,
      [
        biome,
        "lint",
        "--config-path",
        config,
        "--only",
        "style/useBlockStatements",
        "--only",
        "style/noNestedTernary",
        file,
      ],
      { timeout: 30000 },
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
