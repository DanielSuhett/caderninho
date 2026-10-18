// Local integration host only. Never referenced by the product Wrangler config.

import { eq, sql } from "drizzle-orm";
import { sqliteTable, text } from "drizzle-orm/sqlite-core";

import type { ProviderRecord } from "#domain/provider.types.ts";
import { tryCatch } from "#shared/result.ts";
import { authenticatedFetch } from "#worker/auth/controller.ts";
import type { Bindings } from "#worker/bindings.ts";
import {
  synchronizationDependencies,
  syncService,
} from "#worker/composition.ts";
import { database } from "#worker/database.ts";
import { receiveWebhook } from "#worker/index.ts";
import { fetchMcp } from "#worker/mcp/controller.ts";
import * as tables from "#worker/schema.ts";
import { type FinancialSource, runOperation } from "#worker/sync/service.ts";

import {
  WorkflowEntrypoint,
  type WorkflowEvent,
  type WorkflowStep,
} from "cloudflare:workers";

const fixtureRows = sqliteTable("fixture", {
  id: text("id").primaryKey(),
  payload: text("payload", { mode: "json" }).$type<ProviderRecord>().notNull(),
});
const item = "11111111-1111-4111-8111-111111111111",
  account = "22222222-2222-4222-8222-222222222222";
class Fixture implements FinancialSource {
  private db: D1Database;
  constructor(env: Bindings) {
    this.db = env.DB;
  }
  async page({
    resource,
    cursor,
    floor,
  }: Parameters<FinancialSource["page"]>[0]) {
    if (resource === "accounts") {
      return {
        records: [
          {
            id: account,
            itemId: item,
            type: "BANK",
            name: "Synthetic",
            currencyCode: "BRL",
            balance: "100",
          },
        ],
        next: null,
      };
    }
    if (resource !== "transactions") {
      return { records: [], next: null };
    }
    const result = await database(this.db)
      .select()
      .from(fixtureRows)
      .where(eq(fixtureRows.id, cursor ?? "first"))
      .get();
    if (!result) {
      throw new Error("FIXTURE_MISSING");
    }
    const record = result.payload;
    return { records: [record], next: !cursor && !floor ? "second" : null };
  }
  async ids(_account: string, ids: string[]) {
    const result = await database(this.db).select().from(fixtureRows);
    return result
      .map((r) => r.payload)
      .filter((r) => ids.includes(String(r.id)));
  }
}
export class TestWorkflow extends WorkflowEntrypoint<
  Bindings,
  { operationId: string }
> {
  async run(event: WorkflowEvent<{ operationId: string }>, step: WorkflowStep) {
    return runOperation(
      {
        ...synchronizationDependencies(this.env),
        source: async () => new Fixture(this.env),
      },
      event.payload.operationId,
      {
        do: (name, fn) =>
          step.do(name, { retries: { limit: 1, delay: "1 second" } }, fn),
        sleep: (name) => step.sleep(name, "3 seconds"),
      },
    );
  }
}
const worker = {
  async fetch(req: Request, env: Bindings, ctx: ExecutionContext) {
    const path = new URL(req.url).pathname;
    if (path === "/auth-probe") {
      return authenticatedFetch(
        new Request("https://synthetic.example.com/mcp", req),
        env,
        ctx,
        async () => new Response("unexpected-auth", { status: 599 }),
      );
    }
    if (path === "/setup") {
      await env.DB.exec(
        "CREATE TABLE IF NOT EXISTS fixture(id TEXT PRIMARY KEY,payload TEXT NOT NULL);",
      );
      await env.DB.exec(
        "CREATE TRIGGER IF NOT EXISTS fixture_fail BEFORE INSERT ON inbox WHEN NEW.event_id='synthetic-force-failure' BEGIN SELECT RAISE(ABORT,'synthetic storage failure'); END;",
      );
      await database(env.DB)
        .insert(tables.items)
        .values({
          id: item,
          resources: ["accounts", "transactions"],
          enabled: 1,
        })
        .onConflictDoNothing()
        .run();
      for (const [key, id] of [
        ["first", "33333333-3333-4333-8333-333333333333"],
        ["second", "44444444-4444-4444-8444-444444444444"],
      ] as const) {
        await database(env.DB)
          .insert(fixtureRows)
          .values({
            id: key,
            payload: {
              id,
              accountId: account,
              type: "DEBIT",
              amount: "-9007199254740993.01",
              currencyCode: "BRL",
              date: "2026-01-01T00:00:00.000Z",
              status: "POSTED",
              description: "Synthetic",
              createdAt: "2026-10-01T00:00:00.000Z",
            },
          })
          .onConflictDoUpdate({
            target: fixtureRows.id,
            set: { payload: sql`excluded.payload` },
          })
          .run();
      }
      return Response.json({ synthetic: true });
    }
    if (path === "/inspect-native") {
      return Response.json(
        await (
          await env.FINANCE.get(new URL(req.url).searchParams.get("id") ?? "")
        ).status(),
      );
    }
    if (path === "/recover") {
      await syncService(env).recover();
      return Response.json({ done: true });
    }
    if (path === "/inspect-event") {
      const eventId = new URL(req.url).searchParams.get("id") ?? "";
      const receipt = await database(env.DB)
        .select({
          processed_at: tables.inbox.processed_at,
          operation_id: tables.inbox.operation_id,
        })
        .from(tables.inbox)
        .where(eq(tables.inbox.event_id, eventId))
        .get();
      return Response.json({
        receipts: receipt ? 1 : 0,
        processed: Boolean(receipt?.processed_at),
        operations: receipt?.operation_id ? 1 : 0,
      });
    }
    if (path === "/webhook") {
      const { data, error } = await tryCatch(() => receiveWebhook(req, env));
      return error ? new Response("Receipt failed", { status: 503 }) : data;
    }
    if (path === "/mcp") {
      return fetchMcp(req, env, ctx);
    }
    return new Response("Not found", { status: 404 });
  },
};

export default worker;
