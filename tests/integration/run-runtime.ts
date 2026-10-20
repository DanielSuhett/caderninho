import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { z } from "zod/v4";

import { tryCatch } from "../../src/shared";
import { createLogger } from "../../src/shared/logger";
import { poll, spawnManaged } from "../support/process";

const whitespacePattern = /\s+/;
const logger = createLogger({ level: "info", name: "run-runtime" });

await test("native Workflow, 10k/100k volume and persistent installation", {
  timeout: 900_000,
}, async () => {
  const cwd = fileURLToPath(new URL("../..", import.meta.url)),
    temporaryRoot = join(cwd, "work/tmp"),
    state = await mkdir(temporaryRoot, { recursive: true }).then(() =>
      mkdtemp(join(temporaryRoot, "caderninho-test-")),
    ),
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
  const processList = promisify(execFile);
  let peakWorkerdRssKiB = 0;
  let sampledAt = 0;
  async function sampleMemory() {
    if (performance.now() - sampledAt < 1000) {
      return;
    }
    sampledAt = performance.now();
    const { stdout } = await processList("ps", ["-eo", "pgid=,rss=,comm="]);
    const memory = stdout
      .split("\n")
      .map((row) => row.trim().split(whitespacePattern))
      .filter(
        ([group, , name]) =>
          group === String(worker.child.pid) && name === "workerd",
      )
      .reduce((sum, [, rss]) => sum + Number(rss ?? 0), 0);
    peakWorkerdRssKiB = Math.max(peakWorkerdRssKiB, memory);
  }

  const { data: _data, error } = await tryCatch(async () => {
    await fetch(`${base}/setup`, { method: "POST" });
    const stateSchema = z.object({
      runs: z.array(
        z.object({ id: z.string(), records: z.number(), status: z.string() }),
      ),
      totals: z.object({
        groups: z.array(
          z.object({
            count: z.string(),
            currency: z.string(),
            totalMinor: z.string().nullable(),
          }),
        ),
        partial: z.boolean(),
      }),
    });
    const readState = async (connection = "c") => {
      await sampleMemory();
      return stateSchema.parse(
        await (await fetch(`${base}/state?connection=${connection}`)).json(),
      );
    };
    const startRun = async (connection = "c", day = 1) => {
      await fetch(`${base}/setup?connection=${connection}`, { method: "POST" });
      const response = await fetch(
        `${base}/start?connection=${connection}&day=${day}`,
        {
          method: "POST",
        },
      );
      assert.equal(response.status, 200);
      await response.body?.cancel();
    };
    await startRun();
    const partial = await poll({
      attempts: 60,
      intervalMs: 100,
      read: () => readState(),
      until: (value) =>
        value.runs.some((run) => run.status === "running" && run.records > 2),
    });
    assert.equal(partial.totals.partial, true);
    const completed = await poll({
      attempts: 120,
      intervalMs: 250,
      read: () => readState(),
      until: (value) => value.runs[0]?.status === "succeeded",
    });
    assert.equal(completed.totals.partial, false);
    assert.equal(completed.runs[0]?.records, 1202);
    logger.info(
      "PASS: native Workflow completes all pages after the starting HTTP client disconnects",
    );
    await startRun("failure");
    const failed = await poll({
      attempts: 60,
      intervalMs: 250,
      read: () => readState("failure"),
      until: (value) => value.runs[0]?.status === "failed",
    });
    assert.equal(failed.runs[0]?.records, 502);
    assert.equal(failed.totals.partial, true);
    assert.equal(
      failed.totals.groups.find((group) => group.currency === "USD")
        ?.totalMinor,
      "1504202275541745851617283765004",
    );
    assert.equal(
      failed.totals.groups.find((group) => group.currency === "BRL")
        ?.totalMinor,
      "2999397351828750710111110740996",
    );
    logger.info(
      "PASS: native terminal provider failure preserves committed pages and fails the import",
    );
    await startRun("replay");
    const replay = await poll({
      attempts: 180,
      intervalMs: 250,
      read: () => readState("replay"),
      until: (value) =>
        value.runs[0]?.status === "succeeded" ||
        value.runs[0]?.status === "failed",
    });
    assert.equal(replay.runs[0]?.status, "succeeded");
    assert.equal(replay.runs[0]?.records, 1202);
    assert.equal(replay.totals.partial, false);
    logger.info(
      "PASS: native retry recovers a committed page without querying the provider again",
    );
    await [1, 2, 3, 4, 5].reduce(async (previous, day) => {
      await previous;
      await startRun("history", day);
      const result = await poll({
        attempts: 120,
        intervalMs: 250,
        read: () => readState("history"),
        until: (value) =>
          value.runs.length === day &&
          value.runs.every((run) =>
            ["succeeded", "failed"].includes(run.status),
          ),
      });
      const expected = ["3000", "6500", "6500", "6500", "10700"];
      assert.equal(result.totals.groups[0]?.totalMinor, expected[day - 1]);
      const expectedCounts = ["2", "3", "3", "3", "4"];
      assert.equal(result.totals.groups[0]?.count, expectedCounts[day - 1]);
      assert.equal(result.totals.partial, day === 5);
      assert.equal(result.runs[0]?.status, day === 5 ? "failed" : "succeeded");
    }, Promise.resolve());
    logger.info(
      "PASS: native imports accumulate history through updates, repeats, empty windows and partial failure",
    );
    await [10_000, 100_000].reduce(async (previous, size) => {
      await previous;
      const connection = `volume-${size}`;
      const started = performance.now();
      await startRun(connection);
      const result = await poll({
        attempts: 1200,
        intervalMs: 500,
        read: () => readState(connection),
        until: (value) =>
          value.runs[0]?.status === "succeeded" ||
          value.runs[0]?.status === "failed",
      });
      assert.equal(result.runs[0]?.status, "succeeded");
      assert.equal(result.runs[0]?.records, size + 2);
      assert.equal(result.totals.partial, false);
      const usd = 2 * Math.ceil(size / 2 / 3);
      const unit = 9007199254740993123456789012n;
      assert.equal(
        result.totals.groups.find((group) => group.currency === "USD")
          ?.totalMinor,
        (BigInt(usd) * unit).toString(),
      );
      assert.equal(
        result.totals.groups.find((group) => group.currency === "BRL")
          ?.totalMinor,
        (BigInt(size - usd) * unit).toString(),
      );
      logger.info(
        {
          elapsedMs: Math.round(performance.now() - started),
          pageSize: 500,
          peakWorkerdRssKiB,
          records: size,
        },
        "PASS: bounded-page native import and exact SQL totals",
      );
    }, Promise.resolve());
  });
  await worker.stop();
  if (error) {
    logger.error({ logs }, "Synthetic runtime diagnostic");
    throw error;
  }
  const restarted = await start();
  try {
    const persisted = z
      .object({
        runs: z.array(z.object({ records: z.number(), status: z.string() })),
      })
      .parse(
        await (await fetch(`${base}/state?connection=volume-100000`)).json(),
      );
    assert.equal(persisted.runs[0]?.status, "succeeded");
    assert.equal(persisted.runs[0]?.records, 100_002);
    logger.info(
      { state },
      "PASS: restarting the local Worker preserves the installed financial database",
    );
  } finally {
    await restarted.stop();
    await rm(state, { force: true, recursive: true });
  }
});
