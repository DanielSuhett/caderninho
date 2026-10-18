import assert from "node:assert/strict";
import test from "node:test";

import {
  OperationKind,
  OperationPhase,
  OperationStatus,
} from "@/contracts/operation.types";

import type { Steps, SynchronizationSession } from "../entity";
import { runOperation } from "../service";

function execution(kind: OperationKind) {
  const calls: string[] = [];
  const step: Steps = {
    async do(name, callback) {
      calls.push(name);
      return callback();
    },
    async sleep(name) {
      calls.push(name);
    },
  };
  const session: SynchronizationSession = {
    operation: {
      id: "synthetic-operation",
      status: OperationStatus.working,
      kind,
    },
    cancelled: async () => false,
    acquire: async () => true,
    mature: async () => ({ phase: OperationPhase.matured }),
    migrate: async () => {
      calls.push("migration");
    },
    reapply: async () => false,
    resolveEvent: async () => false,
    synchronize: async () => false,
    hasErrors: async () => false,
    finish: async (status, error) => {
      calls.push(`${status}:${!!error}`);
    },
  };
  return { calls, step, session };
}

await test("offline migration uses application ports and preserves durable step names without opening the source", async () => {
  const { calls, step, session } = execution(OperationKind.migration);
  await runOperation(
    {
      open: async () => session,
      source: async () => {
        throw new Error("SOURCE_MUST_STAY_CLOSED");
      },
    },
    session.operation.id,
    step,
  );
  assert.deepEqual(calls, [
    "acquire-0",
    "mature",
    "migration",
    "finish",
    "completed:false",
  ]);
});

await test("cancelled use case finishes once and never publishes completion", async () => {
  const { calls, step, session } = execution(OperationKind.reapply);
  session.reapply = async () => true;
  await runOperation(
    {
      open: async () => session,
      source: async () => {
        throw new Error("SOURCE_MUST_STAY_CLOSED");
      },
    },
    session.operation.id,
    step,
  );
  assert.deepEqual(calls, ["acquire-0", "mature", "cancelled:false"]);
});

await test("source failure is recorded by the application boundary and propagated to the durable runtime", async () => {
  const { calls, step, session } = execution(OperationKind.sync);
  const failure = new Error("synthetic source unavailable");
  session.synchronize = async (source) => {
    await source.ids("account", ["tx"]);
    return false;
  };
  await assert.rejects(
    runOperation(
      {
        open: async () => session,
        source: async () => {
          throw failure;
        },
      },
      session.operation.id,
      step,
    ),
    (error) => error === failure,
  );
  assert.deepEqual(calls, ["acquire-0", "mature", "completed:true"]);
});
