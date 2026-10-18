import assert from "node:assert/strict";
import {
  chmod,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { tryCatch } from "../../src/shared";
import { createLogger } from "../../src/shared/logger";
import { required, responseJson } from "../support";
import { poll, spawnManaged } from "../support/process";

const logger = createLogger({ level: "info", name: "run-runtime" });

await test("native Workflow and complete D1 backup restore", async () => {
  const cwd = fileURLToPath(new URL("../..", import.meta.url)),
    state = await mkdtemp(join(tmpdir(), "caderninho-test-")),
    port = Number(process.env.PRODUCT_TEST_PORT ?? 8895),
    base = `http://127.0.0.1:${port}`;
  const runtime = fileURLToPath(
    new URL("./bin/wrangler.js", import.meta.resolve("wrangler/package.json")),
  );
  const env = {
    ...process.env,
    WRANGLER_LOG_PATH: join(state, "wrangler.log"),
    WRANGLER_SEND_METRICS: "false",
  };
  async function command(args: string[], extra: Record<string, string> = {}) {
    const task = spawnManaged(args, {
      cwd,
      env: { ...env, ...extra },
      stdio: "inherit",
    });
    try {
      await task.wait();
    } finally {
      await task.stop();
    }
  }
  await command([
    runtime,
    "d1",
    "migrations",
    "apply",
    "DB",
    "--local",
    "--config",
    "tests/integration/wrangler.jsonc",
    "--persist-to",
    state,
  ]);
  let logs = "";
  async function start() {
    const task = spawnManaged(
      [
        runtime,
        "dev",
        "--config",
        "tests/integration/wrangler.jsonc",
        "--persist-to",
        state,
        "--port",
        String(port),
        "--ip",
        "127.0.0.1",
        "--inspector-port",
        "0",
      ],
      { cwd, env, stdio: "pipe" },
    );
    task.child.stdout?.on("data", (chunk) => {
      logs = (logs + chunk).slice(-5000);
    });
    task.child.stderr?.on("data", (chunk) => {
      logs = (logs + chunk).slice(-5000);
    });
    const { data: _data, error } = await tryCatch(() =>
      poll({
        attempts: 60,
        intervalMs: 500,
        async read() {
          if (task.child.exitCode !== null || task.child.signalCode !== null) {
            throw new Error("Runtime exited before readiness");
          }
          const { data, error: requestError } = await tryCatch(() =>
            fetch(base, { signal: AbortSignal.timeout(1000) }),
          );
          if (requestError) {
            return false;
          }
          await data.body?.cancel();
          return true;
        },
        until: (ready) => ready,
      }),
    );
    if (!error) {
      return task;
    }
    await task.stop();
    throw new Error(`Runtime not ready: ${logs}`, { cause: error });
  }
  const worker = await start();
  const { data: _data, error } = await tryCatch(async () => {
    await fetch(`${base}/setup`, { method: "POST" });
    const meta = {
      "io.modelcontextprotocol/clientCapabilities": {
        extensions: { "io.modelcontextprotocol/tasks": {} },
      },
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
    };
    const rpc = async (
      method: string,
      params: { name?: string; taskId?: string; arguments?: object },
    ) =>
      responseJson(
        await fetch(`${base}/mcp`, {
          body: JSON.stringify({
            id: 1,
            jsonrpc: "2.0",
            method,
            params: { ...params, _meta: meta },
          }),
          headers: {
            Accept: "application/json, text/event-stream",
            "Content-Type": "application/json",
            "Mcp-Method": method,
            "Mcp-Name": params.name ?? params.taskId ?? "",
            "Mcp-Protocol-Version": "2026-07-28",
          },
          method: "POST",
        }),
      );
    const started = await rpc("tools/call", {
      arguments: {
        itemIds: ["11111111-1111-4111-8111-111111111111"],
        requestKey: "restart-test",
      },
      name: "caderninho_sync",
    });
    const taskId = required(required(started.result).taskId);
    const partial = await poll({
      attempts: 30,
      intervalMs: 100,
      read: () => rpc("tasks/get", { taskId }),
      until: (value) =>
        required(value.result).status === "working" &&
        required(required(value.result).statusMessage).startsWith(
          "transactions",
        ),
    });
    assert.equal(
      required(partial.result).status,
      "working",
      "observe a committed page while workflow is still executing",
    );
    // Disconnect all HTTP clients while the native Workflow continues. Stopping
    // the complete Wrangler process also kills its emulated Workflow service;
    // that emulator restart limitation is documented separately.
    const terminal = required(
      (
        await poll({
          attempts: 40,
          intervalMs: 500,
          read: () => rpc("tasks/get", { taskId }),
          until: (value) => required(value.result).status !== "working",
        })
      ).result,
    );
    assert.equal(terminal.status, "completed");
    assert.equal(required(terminal.result).isError, false);
    logger.info(
      "PASS: native Workflow continues without a connected subscriber, same durable Task",
    );
    await command(["--import", "tsx", "tests/integration/runtime-check.ts"], {
      PRODUCT_TEST_URL: base,
    });
  });
  await worker.stop();
  if (error) {
    logger.error({ logs }, "Synthetic runtime diagnostic");
    throw error;
  }
  // Restore only into a new, isolated local database. Never reuse the source state.
  const restored = await mkdtemp(join(tmpdir(), "caderninho-restore-test-"));
  const backup = join(state, "synthetic-backup.sql");
  const reexport = join(restored, "synthetic-restored.sql");
  // Wrangler export does not support --persist-to. Copy the stopped synthetic DB
  // into its default layout, leaving the source untouched.
  const snapshot = await mkdtemp(join(tmpdir(), "caderninho-export-test-"));
  await mkdir(join(snapshot, ".wrangler/state/v3"), { recursive: true });
  await cp(join(state, "v3/d1"), join(snapshot, ".wrangler/state/v3/d1"), {
    recursive: true,
  });
  const config = JSON.stringify({
    compatibility_date: "2026-10-06",
    d1_databases: [
      { binding: "DB", database_id: "local-test", database_name: "test" },
    ],
    name: "synthetic-backup",
  });
  await writeFile(join(snapshot, "wrangler.json"), config);
  await writeFile(join(restored, "wrangler.json"), config);
  const sourceDatabase = [
    "DB",
    "--local",
    "--config",
    join(snapshot, "wrangler.json"),
  ];
  const restoredDatabase = [
    "DB",
    "--local",
    "--config",
    join(restored, "wrangler.json"),
  ];
  await command([
    runtime,
    "d1",
    "export",
    ...sourceDatabase,
    "--output",
    backup,
  ]);
  await chmod(backup, 0o600);
  await command([
    runtime,
    "d1",
    "execute",
    ...restoredDatabase,
    "--file",
    backup,
  ]);
  await command([
    runtime,
    "d1",
    "export",
    ...restoredDatabase,
    "--output",
    reexport,
  ]);
  await chmod(reexport, 0o600);
  const canonical = (sql: string) =>
    sql
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .sort();
  assert.deepEqual(
    canonical(await readFile(reexport, "utf8")),
    canonical(await readFile(backup, "utf8")),
  );
  logger.info(
    "PASS: complete synthetic D1 export restores into an empty local database without loss",
  );
  logger.info(
    { state },
    "Local workerd integration passed; isolated synthetic state",
  );
});
