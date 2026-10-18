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
await test("import fixes and formatting converge while retaining aliases, comments and side-effect order", async () => {
  const dir = await mkdtemp(join(tmpdir(), "caderninho-imports-"));
  try {
    const config = z
      .object({
        plugins: z.array(z.string()),
        rules: z.record(z.string(), z.json()),
      })
      .parse(
        JSON.parse(await readFile(join(projectRoot, ".oxlintrc.json"), "utf8")),
      );
    const configFile = join(dir, "lint.json");
    await writeFile(
      configFile,
      JSON.stringify({
        plugins: config.plugins,
        rules: Object.fromEntries(
          Object.entries(config.rules).filter(
            ([name]) =>
              name.startsWith("import/") ||
              [
                "typescript/consistent-type-imports",
                "typescript/no-import-type-side-effects",
                "no-duplicate-imports",
              ].includes(name),
          ),
        ),
      }),
    );
    await writeFile(
      join(dir, "model.ts"),
      "export const value = 1; export type Model = string;",
    );
    await writeFile(join(dir, "types.ts"), "export type Other = number;");
    for (const effect of ["first", "second"])
      await writeFile(join(dir, effect + ".ts"), "export {};\n");
    const file = join(dir, "fixture.tsx");
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
          join(projectRoot, "node_modules/oxlint/bin/oxlint"),
          "-c",
          configFile,
          "--fix",
          file,
        ],
        { timeout: 30_000 },
      );
    const format = () =>
      exec(
        process.execPath,
        [
          join(projectRoot, "node_modules/oxfmt/bin/oxfmt"),
          "-c",
          join(projectRoot, ".oxfmtrc.json"),
          "--write",
          file,
        ],
        { timeout: 30_000 },
      );
    // Some duplicate diagnostics remain in the first fixing pass; the next
    // pass must validate the complete result before checking idempotence.
    await tryCatch(fix());
    await format();
    await fix();
    await format();
    const once = await readFile(file, "utf8");
    await fix();
    await format();
    assert.equal(await readFile(file, "utf8"), once);
    assert.match(once, /value as renamed, type Model/);
    assert.match(once, /import type \{ Other \}/);
    assert.match(once, /Preserve this explanation/);
    assert.match(once, /renamed as alias/);
    assert.ok(once.indexOf('"./first.ts"') < once.indexOf('"./second.ts"'));
    assert.match(
      once,
      /<input\n\s+aria-label="Synthetic"\n\s+disabled=\{false\}\n\s+value=\{renamed\}/,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
