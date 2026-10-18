import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";

import { tryCatch } from "#shared/result.ts";
import { required } from "#testing/helpers.ts";
import { spawnManaged } from "#testing/process.ts";

await test("failed fixture subprocesses report errors and repeated cleanup is safe", async () => {
  const failed = spawnManaged(["--eval", "process.exitCode = 7"], {
    stdio: "pipe",
  });
  await assert.rejects(failed.wait(), /Command exit 7/);
  await failed.stop();
  await failed.stop();
});

await test("fixture shutdown kills a subprocess that ignores SIGTERM", {
  timeout: 7000,
}, async () => {
  const task = spawnManaged(
    [
      "--eval",
      'process.on("SIGTERM", () => {}); setInterval(() => {}, 1000); console.log("ready")',
    ],
    { stdio: "pipe" },
  );
  try {
    await once(required(task.child.stdout), "data");
    await task.stop();
    assert.equal(task.child.signalCode, "SIGKILL");
    await assert.rejects(task.wait(), /SIGKILL/);
  } finally {
    await task.stop();
  }
});

await test("SIGINT and SIGTERM stop a runner's managed server without process.exit", {
  timeout: 10_000,
}, async () => {
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    const source = `import { spawnManaged } from ${JSON.stringify(new URL("../process.ts", import.meta.url).href)};
const task = spawnManaged(["--eval", 'setInterval(() => {}, 1000); console.log("ready")'], { stdio: "pipe" });
task.child.stdout.once("data", () => console.log("ready"));
try { await task.wait(); } catch { process.exitCode ||= 1; } finally { await task.stop(); }`;
    const runner = spawnManaged(["--input-type=module", "--eval", source], {
      stdio: "pipe",
    });
    try {
      await once(required(runner.child.stdout), "data");
      runner.child.kill(signal);
      const result = await tryCatch(runner.wait());
      assert.ok(result.error);
      assert.equal(runner.child.exitCode, signal === "SIGINT" ? 130 : 143);
    } finally {
      await runner.stop();
    }
  }
});
