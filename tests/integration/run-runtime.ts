import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { z } from "zod/v4";

import { TransactionQuerySchema } from "../../src/contracts";
import type { Cursor } from "../../src/domain";
import { tryCatch } from "../../src/shared";
import { createLogger } from "../../src/shared/logger";
import { syntheticJwt } from "../support";
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

  let historySuccess: string | null = null;
  const { data: _data, error } = await tryCatch(async () => {
    await fetch(`${base}/setup`, { method: "POST" });
    const stateSchema = z.object({
      connections: z.array(
        z.object({
          importStatus: z.string().nullable(),
          lastSuccessAt: z.string().nullable(),
        }),
      ),
      sequence: z.number(),
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
        value.connections[0]?.importStatus === "running" &&
        value.totals.groups.some((group) => BigInt(group.count) > 0n),
    });
    assert.equal(partial.totals.partial, true);
    const completed = await poll({
      attempts: 120,
      intervalMs: 250,
      read: () => readState(),
      until: (value) => value.connections[0]?.importStatus === "succeeded",
    });
    assert.equal(completed.totals.partial, false);
    assert.equal(
      completed.totals.groups.reduce(
        (sum, group) => sum + BigInt(group.count),
        0n,
      ),
      1200n,
    );
    logger.info(
      "PASS: native Workflow completes all pages after the starting HTTP client disconnects",
    );
    await startRun("failure");
    const failed = await poll({
      attempts: 60,
      intervalMs: 250,
      read: () => readState("failure"),
      until: (value) => value.connections[0]?.importStatus === "failed",
    });
    assert.equal(
      failed.totals.groups.reduce(
        (sum, group) => sum + BigInt(group.count),
        0n,
      ),
      500n,
    );
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
        value.connections[0]?.importStatus === "succeeded" ||
        value.connections[0]?.importStatus === "failed",
    });
    assert.equal(replay.connections[0]?.importStatus, "succeeded");
    assert.equal(replay.sequence, 6);
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
          value.connections[0]?.importStatus ===
          (day === 5 ? "failed" : "succeeded"),
      });
      const expected = ["3000", "6500", "6500", "6500", "10700"];
      assert.equal(result.totals.groups[0]?.totalMinor, expected[day - 1]);
      const expectedCounts = ["2", "3", "3", "3", "4"];
      assert.equal(result.totals.groups[0]?.count, expectedCounts[day - 1]);
      assert.equal(result.totals.partial, day === 5);
      if (day === 4) {
        historySuccess = result.connections[0]?.lastSuccessAt ?? null;
      }
      if (day === 5) {
        assert.equal(result.connections[0]?.lastSuccessAt, historySuccess);
      }
      assert.equal(
        result.connections[0]?.importStatus,
        day === 5 ? "failed" : "succeeded",
      );
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
          value.connections[0]?.importStatus === "succeeded" ||
          value.connections[0]?.importStatus === "failed",
      });
      assert.equal(result.connections[0]?.importStatus, "succeeded");
      assert.equal(
        result.totals.groups.reduce(
          (sum, group) => sum + BigInt(group.count),
          0n,
        ),
        BigInt(size),
      );
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
      if (size === 100_000) {
        const pageSchema = z.object({
          cursor: TransactionQuerySchema.shape.cursor.unwrap().nullable(),
          records: z.array(z.object({ accountId: z.string(), id: z.string() })),
        });
        const seen = new Set<string>();
        async function readPage(cursor: Cursor | null): Promise<void> {
          const response = await fetch(`${base}/query`, {
            body: JSON.stringify({
              filter: { connectionIds: [connection] },
              limit: 200,
              ...(cursor && { cursor }),
            }),
            headers: { "Content-Type": "application/json" },
            method: "POST",
          });
          assert.equal(response.status, 200);
          const page = pageSchema.parse(await response.json());
          for (const row of page.records) {
            const identity = row.id;
            assert.equal(seen.has(identity), false);
            seen.add(identity);
          }
          if (page.cursor) {
            await readPage(page.cursor);
          }
        }
        await readPage(null);
        assert.equal(seen.size, 100_000);
      }
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
        connections: z.array(z.object({ importStatus: z.string().nullable() })),
        sequence: z.number(),
        totals: z.object({ groups: z.array(z.object({ count: z.string() })) }),
      })
      .parse(
        await (await fetch(`${base}/state?connection=volume-100000`)).json(),
      );
    assert.equal(persisted.connections[0]?.importStatus, "succeeded");
    assert.equal(
      persisted.totals.groups.reduce(
        (sum, group) => sum + BigInt(group.count),
        0n,
      ),
      100_000n,
    );
    const history = z
      .object({
        connections: z.array(
          z.object({
            importStatus: z.string().nullable(),
            lastSuccessAt: z.string().nullable(),
          }),
        ),
        totals: z.object({
          groups: z.array(
            z.object({ count: z.string(), totalMinor: z.string().nullable() }),
          ),
          partial: z.boolean(),
        }),
      })
      .parse(await (await fetch(`${base}/state?connection=history`)).json());
    assert.equal(history.connections[0]?.importStatus, "failed");
    assert.ok(historySuccess);
    assert.equal(history.connections[0]?.lastSuccessAt, historySuccess);
    assert.equal(history.totals.groups[0]?.count, "4");
    assert.equal(history.totals.groups[0]?.totalMinor, "10700");
    assert.equal(history.totals.partial, true);
    const historyPage = z
      .object({
        records: z.array(
          z.object({ amountMinor: z.string().nullable(), id: z.string() }),
        ),
      })
      .parse(
        await (
          await fetch(`${base}/query`, {
            body: JSON.stringify({
              filter: { connectionIds: ["history"] },
              limit: 200,
            }),
            headers: { "Content-Type": "application/json" },
            method: "POST",
          })
        ).json(),
      );
    assert.deepEqual(
      historyPage.records.map((row) => [row.id, row.amountMinor]).sort(),
      [
        ["00000000-0000-4000-8000-000000500067", "-1000"],
        ["00000000-0000-4000-8000-000000500068", "-2700"],
        ["00000000-0000-4000-8000-000000500069", "-3000"],
        ["00000000-0000-4000-8000-000000500070", "-4000"],
      ],
    );
    const assetRoot = join(cwd, "dist/web");
    const assets = await readdir(assetRoot, {
      recursive: true,
      withFileTypes: true,
    });
    const contents = await Promise.all(
      assets
        .filter((asset) => asset.isFile())
        .map((asset) => readFile(join(asset.parentPath, asset.name), "utf8")),
    );
    assert.ok(contents.length > 0);
    for (const secret of [
      "synthetic-personal-password",
      "synthetic-client",
      "synthetic-secret",
      syntheticJwt("installation-private-api-key"),
      "synthetic-limited-widget-token",
    ]) {
      assert.equal(
        contents.some((content) => content.includes(secret)),
        false,
      );
    }
    logger.info(
      "PASS: restart preserves cumulative history, exact totals and partial failure; built assets omit synthetic credentials",
    );
    logger.info(
      { state },
      "PASS: restarting the local Worker preserves the installed financial database",
    );
  } finally {
    await restarted.stop();
    await rm(state, { force: true, recursive: true });
  }
});
