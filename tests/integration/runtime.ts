import { eq } from "drizzle-orm";
import { z } from "zod/v4";

import { TransactionQuerySchema } from "../../src/contracts";
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

type RuntimeEnv = Pick<Bindings, "DB" | "FINANCE" | "OAUTH_KV">;
function syntheticSource(
  connectionId: string,
  instrumentation: KVNamespace,
  importId: string,
  referenceDay: string,
): FinancialSource {
  const sizes: Record<string, number> = {
    "volume-10000": 10_000,
    "volume-100000": 100_000,
  };
  const resourceOffsets: Record<string, number> = {
    c: 1,
    failure: 300_000,
    history: 500_000,
    replay: 400_000,
    "volume-10000": 10_000,
    "volume-100000": 100_000,
  };
  const base = resourceOffsets[connectionId] ?? 1;
  // Fixture resources are unique UUIDs, independently from bank account numbers.
  const resourceId = (index: number) =>
    `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
  const bankId = resourceId(base);
  const cardId = resourceId(base + 1);
  const count = sizes[connectionId] ?? 1200;
  const perAccount = count / 2;
  return {
    accounts: async () =>
      (connectionId === "history" ? [bankId] : [bankId, cardId]).map((id) => ({
        balance: "123.45",
        currencyCode: "BRL",
        id,
        itemId: connectionId,
        name: "Synthetic",
        type: id === bankId ? "BANK" : "CREDIT",
      })),
    connection: async () => ({ connector: { id: 200 }, id: connectionId }),
    transactions: async (id, cursor) => {
      if (connectionId === "history") {
        if (cursor) {
          throw new Fault(FaultCode.UPSTREAM_AUTH);
        }
        const pages: Record<string, { id: string; amount: string }[]> = {
          "2026-10-01": [
            { amount: "-10", id: "A" },
            { amount: "-20", id: "B" },
          ],
          "2026-10-02": [
            { amount: "-25", id: "B" },
            { amount: "-30", id: "C" },
          ],
          "2026-10-03": [
            { amount: "-25", id: "B" },
            { amount: "-30", id: "C" },
          ],
          "2026-10-04": [],
          "2026-10-05": [
            { amount: "-27", id: "B" },
            { amount: "-40", id: "D" },
          ],
        };
        return {
          next: referenceDay === "2026-10-05" ? "next" : null,
          records: (pages[referenceDay] ?? []).map((row) => ({
            ...row,
            accountId: id,
            currencyCode: "BRL",
            date: "2026-10-01",
            description: "Synthetic history",
            id: resourceId(base + 2 + row.id.charCodeAt(0)),
            status: "POSTED",
            type: "DEBIT",
          })),
        };
      }
      if (
        connectionId === "replay" &&
        id === bankId &&
        !cursor &&
        (await instrumentation.get(`test:committed:${importId}`))
      ) {
        throw new Error("COMMITTED_PAGE_REFETCHED");
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
            id: resourceId(base + 2 + (id === bankId ? 0 : perAccount) + index),
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
        source: syntheticSource(
          run.connectionId,
          this.env.OAUTH_KV,
          run.id,
          run.admittedAt.slice(0, 10),
        ),
        steps: {
          do: async (name, fn) => {
            const result = await steps.do(name, async () => {
              const receipt = await fn();
              if (
                run.connectionId === "replay" &&
                receipt.sequence === 2 &&
                !(await this.env.OAUTH_KV.get(`test:committed:${run.id}`))
              ) {
                await this.env.OAUTH_KV.put(`test:committed:${run.id}`, "true");
                const lost = new Fault(FaultCode.UPSTREAM_RATE_LIMIT);
                lost.details = { retryAfterSeconds: 0 };
                throw lost;
              }
              return receipt;
            });
            if (JSON.stringify(result).length > 1024) {
              throw new Error("STEP_RESULT_TOO_LARGE");
            }
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
        ![
          "c",
          "volume-10000",
          "volume-100000",
          "failure",
          "replay",
          "history",
        ].includes(id)
      ) {
        return new Response("Invalid fixture", { status: 400 });
      }
      await installation.register({ connector: { id: 200 }, id });
      return Response.json({ ok: true });
    }
    if (path === "/start" && request.method === "POST") {
      const id = new URL(request.url).searchParams.get("connection") ?? "c";
      const day = z
        .enum(["1", "2", "3", "4", "5"])
        .parse(new URL(request.url).searchParams.get("day") ?? "1");
      const now = () =>
        id === "history"
          ? new Date(`2026-10-0${day}T00:00:00.000Z`)
          : new Date();
      return Response.json(
        await createSyncService(
          createSyncRepository(env.DB),
          {
            create: async (runId) => {
              await env.FINANCE.create({ id: runId, params: { runId } });
            },
            status: async (runId) =>
              (await (await env.FINANCE.get(runId)).status()).status,
          },
          now,
        ).request([id]),
      );
    }
    if (path === "/query" && request.method === "POST") {
      return Response.json(
        await createFinancialService(createFinancialRepository(env.DB)).query(
          TransactionQuerySchema.parse(await request.json()),
        ),
      );
    }
    if (path === "/state") {
      const connection =
        new URL(request.url).searchParams.get("connection") ?? "c";
      const finance = createFinancialService(createFinancialRepository(env.DB));
      return Response.json({
        ...(await installation.state({ connectionIds: [connection] })),
        sequence:
          (
            await database(env.DB)
              .select({ value: connections.importSequence })
              .from(connections)
              .where(eq(connections.id, connection))
              .get()
          )?.value ?? 0,
        totals: await finance.aggregate({
          filter: { connectionIds: [connection] },
          metric: "debits",
        }),
      });
    }
    return new Response("Synthetic local runtime");
  },
};
