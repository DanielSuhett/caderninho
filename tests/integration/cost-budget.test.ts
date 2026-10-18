import assert from "node:assert/strict";

import { eq } from "drizzle-orm";
import { test } from "vitest";

import { Resource } from "../../src/domain";
import { EMPTY_RULES } from "../../src/domain/rules";
import { createLogger } from "../../src/shared/logger";
import worker from "../../src/worker";
import { prepareEntity, reapplyRules } from "../../src/worker/composition";
import { database } from "../../src/worker/database";
import { saveRules } from "../../src/worker/finance/repository";
import { settings as configuration, items } from "../../src/worker/schema";
import { type FinancialSource, runOperation } from "../../src/worker/sync";
import {
  createExecutionRepository,
  startOperation,
} from "../../src/worker/sync/repository";
import { measuredDatabase } from "../support/d1-metrics";
import { settings, testMigrations } from "./personal-fixture";
import {
  applyD1Migrations,
  createScheduledController,
  reset,
} from "cloudflare:test";
import { env } from "cloudflare:workers";

const logger = createLogger({ level: "info", name: "cost-budget" });

test("actual D1 statements fit daily budgets and idle work stays constant at 10x history", async () => {
  await reset();
  await applyD1Migrations(env.DB, testMigrations);
  const orm = database(env.DB);
  const ids = Array.from({ length: 10 }, (_, index) => `item-${index}`);
  await orm.insert(items).values(ids.map((id) => ({ id })));
  const document = structuredClone(EMPTY_RULES);
  document.rules.push({
    conditions: {
      all: [{ fact: "tx.currency", operator: "equal", value: "BRL" }],
    },
    event: {
      params: {
        actions: [
          { key: "project", op: "set_tag", value: "synthetic" },
          { key: "source", op: "set_tag", value: "fixture" },
          { key: "scope", op: "set_tag", value: "cost" },
        ],
      },
      type: "enrich",
    },
    id: "three-tags",
    is_active: true,
    name: "Three synthetic tags",
    priority: 1,
  });
  const rules = await saveRules(env.DB, document, true);
  const measured = measuredDatabase(env.DB);
  const results: {
    scenario: string;
    rowsRead: number;
    rowsWritten: number;
    statements: number;
    sourceCalls: number;
    steps: number;
    elapsedMs: number;
  }[] = [];
  async function execute(scenario: "bootstrap" | "incremental" | "reconcile") {
    measured.reset();
    let sourceCalls = 0,
      steps = 0;
    const started = Date.now();
    const op = await startOperation(measured.db, scenario, {
      itemIds: ids,
      kind: scenario === "reconcile" ? "reconcile" : "sync",
    });
    const source: FinancialSource = {
      ids: (_account, selected) => {
        sourceCalls += 1;
        return Promise.resolve(
          selected.map((id) => ({
            accountId: _account,
            amount: "-1.23",
            createdAt: "2026-01-01T00:00:00Z",
            currencyCode: "BRL",
            date: "2026-01-01",
            id,
            status: scenario === "bootstrap" ? "PENDING" : "POSTED",
            type: "DEBIT",
          })),
        );
      },
      page: ({ item, resource, parent, cursor }) => {
        sourceCalls += 1;
        if (resource === Resource.connections) {
          return Promise.resolve({
            next: null,
            records: [
              { connector: { id: 200, isOpenFinance: false }, id: item },
            ],
          });
        }
        if (resource === Resource.accounts) {
          return Promise.resolve({
            next: null,
            records: [
              {
                balance: "100",
                currencyCode: "BRL",
                id: `account-${item}`,
                itemId: item,
                type: "BANK",
              },
            ],
          });
        }
        if (resource !== Resource.transactions) {
          return Promise.resolve({ next: null, records: [] });
        }
        const offset = Number(cursor ?? 0),
          total = scenario === "bootstrap" ? 1000 : 1010;
        return Promise.resolve({
          next: offset + 100 < total ? String(offset + 100) : null,
          records: Array.from(
            { length: Math.min(100, total - offset) },
            (_, index) => {
              const n = offset + index;
              return {
                accountId: parent,
                amount:
                  scenario !== "bootstrap" && n >= 990 && n < 1000
                    ? "-2.34"
                    : "-1.23",
                createdAt: "2026-01-01T00:00:00Z",
                currencyCode: "BRL",
                date: "2026-01-01",
                id: `${item}-tx-${n}`,
                status:
                  n < 5 && scenario !== "reconcile" ? "PENDING" : "POSTED",
                type: "DEBIT",
              };
            },
          ),
        });
      },
    };
    await runOperation(
      {
        prepare: (input) => prepareEntity(measured.db, input),
        repository: createExecutionRepository(measured.db),
        source: () => Promise.resolve(source),
      },
      op.id,
      {
        do: (_name, callback) => {
          steps += 1;
          return callback();
        },
        sleep: () => {
          steps += 1;
          return Promise.resolve();
        },
      },
    );
    const result = {
      scenario,
      ...measured.totals,
      elapsedMs: Date.now() - started,
      sourceCalls,
      steps,
    };
    results.push(result);
    logger.info(result, "synthetic D1 execution");
    if (scenario === "incremental") {
      assert.ok(result.rowsRead <= 250_000, JSON.stringify(result));
      assert.ok(result.rowsWritten <= 25_000, JSON.stringify(result));
    }
    if (scenario === "reconcile") {
      assert.ok(result.rowsRead <= 1_000_000, JSON.stringify(result));
      assert.ok(result.rowsWritten <= 50_000, JSON.stringify(result));
    }
  }
  await execute("bootstrap");
  await execute("incremental");
  await execute("reconcile");
  const localRules = structuredClone(document);
  const [firstRule] = localRules.rules;
  if (!firstRule) {
    throw new Error("COST_RULE_MISSING");
  }
  firstRule.event.params.actions.push({
    op: "set_description",
    value: "Local fixture",
  });
  await saveRules(env.DB, localRules, true);
  measured.reset();
  await reapplyRules({ ...settings(), DB: measured.db })({
    batches: true,
    itemIds: ids,
    requestKey: "cost-local",
  });
  const local = {
    scenario: "local-batch",
    ...measured.totals,
    elapsedMs: 0,
    sourceCalls: 0,
    steps: 0,
  };
  results.push(local);
  logger.info(local, "synthetic synchronous local batch");
  assert.ok(local.statements <= 50, JSON.stringify(local));
  await orm
    .update(configuration)
    .set({ sync_enabled: 0 })
    .where(eq(configuration.id, 1));
  await [100_000, 1_000_000].reduce(async (previous, size) => {
    await previous;
    await env.DB.prepare(
      "WITH RECURSIVE n(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM n WHERE x<?) INSERT OR IGNORE INTO inbox(event_id,item_id,account_id,event,payload,processed_at,received_at) SELECT 'old-'||x,'item-0','account','transactions/deleted','{}','2000-01-01','2000-01-01' FROM n",
    )
      .bind(size)
      .run();
    await env.DB.prepare(
      "WITH RECURSIVE n(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM n WHERE x<?) INSERT OR IGNORE INTO operations(id,request_key,kind,input,input_hash,rules_revision,reference_day,status,phase,created_at,updated_at,compacted) SELECT 'old-'||x,'old-'||x,'sync','{\"itemIds\":[\"item-0\"],\"kind\":\"sync\"}','synthetic',?,'2000-01-01','completed','completed','2000-01-01','2000-01-01',1 FROM n",
    )
      .bind(size, rules.id)
      .run();
    measured.reset();
    await worker.scheduled(
      createScheduledController({ scheduledTime: Date.now() }),
      { ...settings(), DB: measured.db },
    );
    const result = {
      scenario: `idle-${size}`,
      ...measured.totals,
      elapsedMs: 0,
      sourceCalls: 0,
      steps: 0,
    };
    results.push(result);
    logger.info(result, "synthetic D1 idle day");
    assert.ok(result.rowsRead <= 100, JSON.stringify(result));
    assert.ok(result.rowsWritten <= 10, JSON.stringify(result));
  }, Promise.resolve());
  assert.equal(results.length, 6);
}, 360_000);
