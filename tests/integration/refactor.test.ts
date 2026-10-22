import assert from "node:assert/strict";

import { beforeEach, test } from "vitest";
import { z } from "zod/v4";

import { createInstallationService } from "../../src/worker/installation";
import { createInstallationRepository } from "../../src/worker/installation/repository";
import { runImport } from "../../src/worker/sync";
import { createSyncRepository } from "../../src/worker/sync/repository";
import { applyD1Migrations, reset } from "cloudflare:test";
import { env } from "cloudflare:workers";

const migrations = z
  .object({
    TEST_MIGRATIONS: z.array(
      z.object({ name: z.string(), queries: z.array(z.string()) }),
    ),
  })
  .parse(env).TEST_MIGRATIONS;

beforeEach(async () => {
  await reset();
  await applyD1Migrations(env.DB, migrations);
});

test("one import publishes exact transactions and repeating the request reuses the active run", async () => {
  await createInstallationRepository(env.DB).register("c");
  const repository = createSyncRepository(env.DB);
  const first = await repository.admit(["c"], "2026-10-01T00:00:00Z");
  const repeated = await repository.admit(["c"], "2026-10-01T00:00:00Z");
  assert.equal(first[0]?.importId, repeated[0]?.importId);
  const id = first[0]?.importId;
  assert.ok(id);
  await runImport(
    {
      now: () => "2026-10-01T00:00:00Z",
      repository,
      source: {
        accounts: async () => [
          {
            balance: "123.45",
            currencyCode: "BRL",
            id: "a",
            itemId: "c",
            name: "Synthetic",
            type: "BANK",
          },
        ],
        connection: async () => ({ connector: { id: 200 }, id: "c" }),
        transactions: async () => ({
          next: null,
          records: [
            {
              accountId: "a",
              amount: "-9007199254740993.01",
              currencyCode: "BRL",
              date: "2026-10-01",
              description: "Synthetic",
              id: "t",
              status: "POSTED",
              type: "DEBIT",
            },
          ],
        }),
      },
      steps: { do: (_name, fn) => fn() },
    },
    id,
  );
  const state = await createInstallationRepository(env.DB).state();
  assert.equal(state.connections[0]?.importStatus, "succeeded");
  assert.equal(state.connections[0]?.accounts.a?.balanceMinor, "12345");
});

test("a new installation registers only verified personal connections and keeps configuration across reads", async () => {
  const repository = createInstallationRepository(env.DB);
  const service = createInstallationService({
    repository,
    source: {
      configured: true,
      connection: async (id) => ({
        connector: { id: 200 },
        id,
      }),
      token: async () => ({ accessToken: "synthetic" }),
    },
  });
  await service.connect("connection-a");
  await service.connect("connection-a");
  const state = await service.state();
  assert.equal(state.connections.length, 1);
  assert.equal(state.connections[0]?.id, "connection-a");
  assert.equal(state.connections[0]?.importStatus, null);
});

test("only Meu Pluggy is accepted, identity is checked and more than ten connections remain idempotent", async () => {
  const repository = createInstallationRepository(env.DB);
  const service = createInstallationService({
    repository,
    source: {
      configured: true,
      connection: async (id) => ({
        connector: { id: id === "wrong" ? 201 : 200 },
        id,
      }),
      token: async () => ({ accessToken: "synthetic" }),
    },
  });
  await assert.rejects(service.connect("wrong"), {
    message: "MEU_PLUGGY_REQUIRED",
  });
  await Array.from({ length: 10 }, (_, i) => `c-${i}`).reduce(
    async (previous, id) => {
      await previous;
      await service.connect(id);
    },
    Promise.resolve(),
  );
  await service.connect("c-0");
  await service.connect("eleventh");
  assert.equal((await service.state()).connections.length, 11);
  const mismatch = createInstallationService({
    repository,
    source: {
      configured: true,
      connection: async () => ({ connector: { id: 200 }, id: "different" }),
      token: async () => ({ accessToken: "synthetic" }),
    },
  });
  await assert.rejects(mismatch.connect("requested"), {
    message: "SOURCE_IDENTITY_MISMATCH",
  });
});

test("D1 registers concurrent connections beyond ten and keeps reconnection idempotent", async () => {
  const repository = createInstallationRepository(env.DB);
  await Promise.all(
    Array.from({ length: 12 }, (_, index) => repository.register(`c-${index}`)),
  );
  assert.equal((await repository.state()).connections.length, 12);
  const before = await repository.state();
  await repository.register("c-0");
  const state = await repository.state();
  assert.deepEqual(state, before);
});
