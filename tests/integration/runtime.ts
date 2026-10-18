// Local integration host only. Never referenced by the product Wrangler config.
import {
  WorkflowEntrypoint,
  type WorkflowEvent,
  type WorkflowStep,
} from "cloudflare:workers";
import { z } from "zod/v4";

import type { Resource } from "#domain/enums.ts";
import { ProviderRecordSchema } from "#domain/schemas.ts";
import { parseJson } from "#shared/json.ts";
import { tryCatch } from "#shared/result.ts";
import { authenticatedFetch } from "#worker/auth/controller.ts";
import type { Bindings } from "#worker/bindings.ts";
import {
  syncService,
  synchronizationDependencies,
} from "#worker/composition.ts";
import { statement } from "#worker/database.ts";
import { receiveWebhook } from "#worker/index.ts";
import { fetchMcp } from "#worker/mcp/controller.ts";
import { type FinancialSource, runOperation } from "#worker/sync/service.ts";

const item = "11111111-1111-4111-8111-111111111111",
  account = "22222222-2222-4222-8222-222222222222";
class Fixture implements FinancialSource {
  private db: D1Database;
  constructor(env: Bindings) {
    this.db = env.DB;
  }
  async page(
    resource: Resource,
    _item: string,
    _parent: string,
    cursor: string | null,
    floor: string | null,
  ) {
    if (resource === "accounts")
      return {
        records: [
          ProviderRecordSchema.parse({
            id: account,
            itemId: item,
            type: "BANK",
            name: "Synthetic",
            currencyCode: "BRL",
            balance: "100",
          }),
        ],
        next: null,
      };
    if (resource !== "transactions") return { records: [], next: null };
    const result = await statement(
      this.db,
      "SELECT payload FROM fixture WHERE id=?",
      cursor ?? "first",
    ).first("payload");
    const record = ProviderRecordSchema.parse(
      parseJson(z.string().parse(result)),
    );
    return { records: [record], next: !cursor && !floor ? "second" : null };
  }
  async ids(_account: string, ids: string[]) {
    const result = await statement(
      this.db,
      "SELECT payload FROM fixture",
    ).all();
    return result.results
      .map((r) =>
        ProviderRecordSchema.parse(parseJson(z.string().parse(r.payload))),
      )
      .filter((r) => ids.includes(String(r.id)));
  }
}
export class TestWorkflow extends WorkflowEntrypoint<
  Bindings,
  { operationId: string }
> {
  async run(event: WorkflowEvent<{ operationId: string }>, step: WorkflowStep) {
    return runOperation(
      synchronizationDependencies(this.env),
      event.payload.operationId,
      {
        do: (name, fn) =>
          step.do(name, { retries: { limit: 1, delay: "1 second" } }, fn),
        sleep: (name) => step.sleep(name, "3 seconds"),
      },
      new Fixture(this.env),
    );
  }
}
const worker = {
  async fetch(req: Request, env: Bindings, ctx: ExecutionContext) {
    const path = new URL(req.url).pathname;
    if (path === "/auth-probe")
      return authenticatedFetch(
        new Request("https://synthetic.example.com/mcp", req),
        { ...env, PUBLIC_ORIGIN: "https://synthetic.example.com" },
        ctx,
        async () => new Response("unexpected-auth", { status: 599 }),
      );
    if (path === "/setup") {
      await env.DB.exec(
        "CREATE TABLE IF NOT EXISTS fixture(id TEXT PRIMARY KEY,payload TEXT NOT NULL);",
      );
      await env.DB.exec(
        "CREATE TRIGGER IF NOT EXISTS fixture_fail BEFORE INSERT ON inbox WHEN NEW.event_id='synthetic-force-failure' BEGIN SELECT RAISE(ABORT,'synthetic storage failure'); END;",
      );
      await env.DB.batch([
        statement(
          env.DB,
          "INSERT OR IGNORE INTO principals(id) VALUES('alice'),('bob')",
        ),
        statement(
          env.DB,
          "INSERT OR IGNORE INTO items VALUES('alice',?,'[\"accounts\",\"transactions\"]',1)",
          item,
        ),
      ]);
      for (const [key, id] of [
        ["first", "33333333-3333-4333-8333-333333333333"],
        ["second", "44444444-4444-4444-8444-444444444444"],
      ] as const)
        await statement(
          env.DB,
          "INSERT OR REPLACE INTO fixture VALUES(?,?)",
          key,
          JSON.stringify({
            id,
            accountId: account,
            type: "DEBIT",
            amount: "-9007199254740993.01",
            currencyCode: "BRL",
            date: "2026-01-01T00:00:00.000Z",
            status: "POSTED",
            description: "Synthetic",
            createdAt: "2026-10-01T00:00:00.000Z",
          }),
        ).run();
      return Response.json({ synthetic: true });
    }
    if (path === "/inspect-native")
      return Response.json(
        await (
          await env.FINANCE.get(new URL(req.url).searchParams.get("id") ?? "")
        ).status(),
      );
    if (path === "/recover") {
      await syncService(env).recover();
      return Response.json({ done: true });
    }
    if (path === "/inspect-event") {
      const eventId = new URL(req.url).searchParams.get("id") ?? "";
      const receipt = await statement(
        env.DB,
        "SELECT processed_at,operation_id FROM inbox WHERE event_id=?",
        eventId,
      ).first();
      return Response.json({
        receipts: receipt ? 1 : 0,
        processed: Boolean(receipt?.processed_at),
        operations: receipt?.operation_id ? 1 : 0,
      });
    }
    if (path === "/webhook") {
      const result = await tryCatch(receiveWebhook(req, env));
      return result.error
        ? new Response("Receipt failed", { status: 503 })
        : result.data;
    }
    if (path === "/mcp")
      return fetchMcp(
        req,
        {
          ...env,
          TASK_EVENT_SOURCE:
            req.headers.get("X-Test-Event-Source") === "workflow"
              ? "workflow"
              : "d1",
        },
        req.headers.get("X-Test-Principal") === "bob" ? "bob" : "alice",
        ctx,
      );
    return new Response("Not found", { status: 404 });
  },
};

export default worker;
