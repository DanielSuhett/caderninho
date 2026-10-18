import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { z } from "zod/v4";

import { EMPTY_RULES } from "#domain/rules/rules.ts";
import { SnapshotSchema } from "#domain/schemas.ts";
import { tryCatch } from "#shared/result.ts";

import { adminEndpoint, adminRequest } from "../admin-request.ts";
import { projectRoot } from "../check-imports.ts";

const exec = promisify(execFile);
const cli = (name: string, args: string[]) =>
  exec(
    process.execPath,
    [join(projectRoot, "scripts", name + ".ts"), ...args],
    {
      timeout: 15_000,
      env: { ...process.env, CADERNINHO_TOKEN: "" },
    },
  );

await test("administrative CLIs reject invalid options before reading files or requesting data", async () => {
  for (const [name, args] of [
    ["import-rules", []],
    ["import-rules", ["--file"]],
    ["import-rules", ["--file", "missing", "--unknown"]],
    ["import-rules", ["--file", "missing", "--save", "--activate"]],
    ["import-rules", ["--file", "missing", "--save"]],
    [
      "import-rules",
      ["--file", "missing", "--endpoint", "http://synthetic.invalid", "--save"],
    ],
    [
      "migrate-r2",
      ["--directory", "missing", "--item", "synthetic", "--apply"],
    ],
    [
      "migrate-r2",
      ["--directory", "missing", "--item", "synthetic", "--policy", "typo"],
    ],
    [
      "migrate-r2",
      ["--directory", "missing", "--item", "synthetic", "--batch-size", "0"],
    ],
    [
      "migrate-r2",
      ["--directory", "missing", "--item", "synthetic", "--overlap", "typo"],
    ],
  ] as const) {
    const result = await tryCatch(cli(name, [...args]));
    assert.ok(result.error, `${name} ${args.join(" ")}`);
    assert.doesNotMatch(result.error.message, /ENOENT|ENOTFOUND/);
  }
});

await test("rules and exported-snapshot CLIs default to local dry runs with private, exclusive output", async () => {
  const dir = await mkdtemp(join(tmpdir(), "caderninho-cli-"));
  try {
    const source = join(dir, "rules.json");
    const output = join(dir, "converted.json");
    await writeFile(source, JSON.stringify(EMPTY_RULES));
    const result = await cli("import-rules", [
      "--file",
      source,
      "--output",
      output,
    ]);
    assert.equal(
      z.object({ compatible: z.boolean() }).parse(JSON.parse(result.stdout))
        .compatible,
      true,
    );
    assert.deepEqual(JSON.parse(await readFile(output, "utf8")), EMPTY_RULES);
    assert.equal((await stat(output)).mode & 0o777, 0o600);
    await assert.rejects(
      cli("import-rules", ["--file", source, "--output", output]),
      /EEXIST/,
    );
    const snapshot = SnapshotSchema.parse({
      snapshotId: "synthetic-snapshot",
      owner: "synthetic-owner",
      itemId: "synthetic-item",
      item: { id: "synthetic-item", connector: { id: "synthetic-connector" } },
      collections: {},
    });
    await writeFile(join(dir, "snapshot.json"), JSON.stringify(snapshot));
    const migrated = await cli("migrate-r2", [
      "--directory",
      dir,
      "--item",
      "synthetic-item",
    ]);
    assert.equal(
      z
        .object({ applied: z.boolean(), manifests: z.number() })
        .parse(JSON.parse(migrated.stdout)).applied,
      false,
    );
    assert.deepEqual(
      JSON.parse(await readFile(join(dir, "snapshot.json"), "utf8")),
      snapshot,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

await test("administrative requests time out without retry and require HTTPS endpoints", async (context) => {
  assert.throws(
    () => adminEndpoint("http://synthetic.invalid"),
    /HTTPS_REQUIRED/,
  );
  let calls = 0;
  context.mock.method(
    globalThis,
    "fetch",
    (input: RequestInfo | URL, init?: RequestInit) => {
      calls++;
      const request = new Request(input, init);
      assert.equal(request.redirect, "error");
      assert.equal(request.headers.get("Authorization"), "Bearer synthetic");
      return new Promise<Response>((_resolve, reject) => {
        request.signal.addEventListener(
          "abort",
          () => reject(request.signal.reason),
          { once: true },
        );
      });
    },
  );
  // AbortSignal's native timeout is unref'ed; keep the synthetic transport alive.
  const keepAlive = setInterval(() => {}, 1000);
  try {
    await assert.rejects(
      adminRequest(
        adminEndpoint("https://synthetic.invalid"),
        "synthetic",
        {},
        25,
      ),
      /abort|timed out|timeout/i,
    );
    assert.equal(calls, 1);
  } finally {
    clearInterval(keepAlive);
  }
});
