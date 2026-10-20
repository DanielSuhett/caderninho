import { eq } from "drizzle-orm";

import { Fault, FaultCode, type FinancialSource } from "../../src/domain";
import type { Bindings } from "../../src/worker/bindings";
import { database } from "../../src/worker/database";
import { createFinancialService } from "../../src/worker/finance";
import { createFinancialRepository } from "../../src/worker/finance/repository";
import { createInstallationRepository } from "../../src/worker/installation/repository";
import { connections } from "../../src/worker/schema";
import { createSyncService, runImport } from "../../src/worker/sync";
import { createSyncRepository } from "../../src/worker/sync/repository";
import { workflowSteps } from "../../src/worker/sync/workflow";
import {
  WorkflowEntrypoint,
  type WorkflowEvent,
  type WorkflowStep,
} from "cloudflare:workers";

type RuntimeEnv = Pick<Bindings, "DB" | "FINANCE">;
function syntheticSource(
  connectionId: string,
  db: D1Database,
): FinancialSource {
  const sizes: Record<string, number> = {
    "volume-10000": 10_000,
    "volume-100000": 100_000,
  };
  const count = sizes[connectionId] ?? 1200;
  const perAccount = count / 2;
  return {
    accounts: async () =>
      ["a", "b"].map((id) => ({
        balance: "123.45",
        currencyCode: "BRL",
        id,
        itemId: connectionId,
        name: "Synthetic",
        type: id === "a" ? "BANK" : "CREDIT",
      })),
    connection: async () => ({ connector: { id: 200 }, id: connectionId }),
    transactions: async (id, cursor) => {
      if (connectionId === "replay" && id === "a" && !cursor) {
        const connection = await database(db)
          .select({ status: connections.status })
          .from(connections)
          .where(eq(connections.id, connectionId))
          .get();
        if (connection?.status === "lost_response_committed") {
          throw new Error("COMMITTED_PAGE_REFETCHED");
        }
      }
      if (connectionId === "failure" && cursor) {
        throw new Fault(FaultCode.UPSTREAM_AUTH);
      }
      const from = Number(cursor ?? 0);
      const until = Math.min(from + 500, perAccount);
      return Promise.resolve({
        next: until < perAccount ? String(until) : null,
        records: Array.from({ length: until - from }, (_, offset) => {
          const index = from + offset;
          return {
            accountId: id,
            amount: "-90071992547409931234567890.12",
            category: "Fixture",
            currencyCode: index % 3 === 0 ? "USD" : "BRL",
            date: "2026-10-01",
            description: "Synthetic transaction",
            details: "synthetic ".repeat(50),
            id: `tx-${String(index).padStart(6, "0")}`,
            merchant: { name: "Synthetic merchant" },
            status: "POSTED",
            type: "DEBIT",
          };
        }),
      });
    },
  };
}
export class TestWorkflow extends WorkflowEntrypoint<
  RuntimeEnv,
  { runId: string }
> {
  async run(event: WorkflowEvent<{ runId: string }>, step: WorkflowStep) {
    const repository = createSyncRepository(this.env.DB);
    const run = await repository.read(event.payload.runId);
    const steps = workflowSteps(step);
    await runImport(
      {
        now: () => new Date().toISOString(),
        repository,
        source: syntheticSource(run.connectionId, this.env.DB),
        steps: {
          do: async (name, fn) => {
            const result = await steps.do(name, async () => {
              const receipt = await fn();
              if (run.connectionId === "replay" && receipt.sequence === 2) {
                const row = await database(this.env.DB)
                  .select({ status: connections.status })
                  .from(connections)
                  .where(eq(connections.id, run.connectionId))
                  .get();
                if (row?.status !== "lost_response_committed") {
                  await database(this.env.DB)
                    .update(connections)
                    .set({ status: "lost_response_committed" })
                    .where(eq(connections.id, run.connectionId));
                  const lost = new Fault(FaultCode.UPSTREAM_RATE_LIMIT);
                  lost.details = { retryAfterSeconds: 0 };
                  throw lost;
                }
              }
              return receipt;
            });
            if (run.connectionId === "c") {
              await step.sleep(`${name}-inspection`, 200);
            }
            return result;
          },
        },
      },
      run.id,
    );
  }
}
export default {
  async fetch(request: Request, env: RuntimeEnv) {
    const path = new URL(request.url).pathname;
    const installation = createInstallationRepository(env.DB);
    if (path === "/setup" && request.method === "POST") {
      const id = new URL(request.url).searchParams.get("connection") ?? "c";
      if (
        !["c", "volume-10000", "volume-100000", "failure", "replay"].includes(
          id,
        )
      ) {
        return new Response("Invalid fixture", { status: 400 });
      }
      await installation.register(
        { connector: { id: 200 }, id },
        new Date().toISOString(),
      );
      return Response.json({ ok: true });
    }
    if (path === "/start" && request.method === "POST") {
      const id = new URL(request.url).searchParams.get("connection") ?? "c";
      return Response.json(
        await createSyncService(createSyncRepository(env.DB), {
          create: async (runId) => {
            await env.FINANCE.create({ id: runId, params: { runId } });
          },
          status: async (runId) =>
            (await (await env.FINANCE.get(runId)).status()).status,
        }).request([id]),
      );
    }
    if (path === "/state") {
      const connection =
        new URL(request.url).searchParams.get("connection") ?? "c";
      const finance = createFinancialService(createFinancialRepository(env.DB));
      return Response.json({
        ...(await installation.state({ connectionIds: [connection] })),
        totals: await finance.aggregate({
          filter: { connectionIds: [connection] },
          metric: "debits",
        }),
      });
    }
    return new Response("Synthetic local runtime");
  },
};
