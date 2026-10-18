// Local integration host only. Never referenced by the product Wrangler config.

import { eq, sql } from "drizzle-orm";
import { sqliteTable, text } from "drizzle-orm/sqlite-core";

import type { ProviderRecord } from "../../src/domain";
import { tryCatch } from "../../src/shared";
import { receiveWebhook } from "../../src/worker";
import { authenticatedFetch } from "../../src/worker/auth/controller";
import type { Bindings } from "../../src/worker/bindings";
import {
  synchronizationDependencies,
  syncService,
} from "../../src/worker/composition";
import { database } from "../../src/worker/database";
import { fetchMcp } from "../../src/worker/mcp";
import {
  inbox as inboxTable,
  items as itemsTable,
} from "../../src/worker/schema";
import { type FinancialSource, runOperation } from "../../src/worker/sync";
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
  private readonly db: D1Database;
  constructor(env: Bindings) {
    this.db = env.DB;
  }
  async page({
    resource,
    cursor,
    floor,
  }: Parameters<FinancialSource["page"]>[0]) {
    if (resource === "connections") {
      return {
        next: null,
        records: [{ connector: { id: 200, isOpenFinance: false }, id: item }],
      };
    }
    if (resource === "accounts") {
      return {
        next: null,
        records: [
          {
            balance: "100",
            currencyCode: "BRL",
            id: account,
            itemId: item,
            name: "Synthetic",
            type: "BANK",
          },
        ],
      };
    }
    if (resource !== "transactions") {
      return { next: null, records: [] };
    }
    const result = await database(this.db)
      .select()
      .from(fixtureRows)
      .where(eq(fixtureRows.id, cursor ?? "first"))
      .get();
    if (!result) {
      throw new Error("FIXTURE_MISSING");
    }
    const { payload: record } = result;
    return { next: cursor || floor ? null : "second", records: [record] };
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
    return await runOperation(
      {
        ...synchronizationDependencies(this.env),
        source: () => Promise.resolve(new Fixture(this.env)),
      },
      event.payload.operationId,
      {
        do: (name, fn) =>
          step.do(name, { retries: { delay: "1 second", limit: 1 } }, fn),
        sleep: (name) => step.sleep(name, "3 seconds"),
      },
    );
  }
}
const worker = {
  async fetch(req: Request, env: Bindings, ctx: ExecutionContext) {
    const { pathname: path } = new URL(req.url);
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
        .insert(itemsTable)
        .values({
          id: item,
        })
        .onConflictDoNothing()
        .run();
      await (
        [
          ["first", "33333333-3333-4333-8333-333333333333"],
          ["second", "44444444-4444-4444-8444-444444444444"],
        ] as const
      ).reduce(async (priorCase, [key, id]) => {
        await priorCase;
        await database(env.DB)
          .insert(fixtureRows)
          .values({
            id: key,
            payload: {
              accountId: account,
              amount: "-9007199254740993.01",
              createdAt: "2026-10-01T00:00:00.000Z",
              currencyCode: "BRL",
              date: "2026-01-01T00:00:00.000Z",
              description: "Synthetic",
              id,
              status: "POSTED",
              type: "DEBIT",
            },
          })
          .onConflictDoUpdate({
            set: { payload: sql`excluded.payload` },
            target: fixtureRows.id,
          })
          .run();
      }, Promise.resolve());
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
          operation_id: inboxTable.operation_id,
          processed_at: inboxTable.processed_at,
        })
        .from(inboxTable)
        .where(eq(inboxTable.event_id, eventId))
        .get();
      return Response.json({
        operations: receipt?.operation_id ? 1 : 0,
        processed: Boolean(receipt?.processed_at),
        receipts: receipt ? 1 : 0,
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
