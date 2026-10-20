import { z } from "zod/v4";

import type {
  FinancialSource,
  ProviderAccount,
  ProviderTransaction,
} from "../../src/domain";
import { createInstallationRepository } from "../../src/worker/installation/repository";
import { runImport } from "../../src/worker/sync";
import { createSyncRepository } from "../../src/worker/sync/repository";
import { required } from "../support";
import { applyD1Migrations, reset } from "cloudflare:test";
import { env } from "cloudflare:workers";

const migrations = z
  .object({
    TEST_MIGRATIONS: z.array(
      z.object({ name: z.string(), queries: z.array(z.string()) }),
    ),
  })
  .parse(env).TEST_MIGRATIONS;
export async function setup() {
  await reset();
  await applyD1Migrations(env.DB, migrations);
}
export const account = (
  input: Partial<ProviderAccount> = {},
): ProviderAccount => ({
  balance: "123.45",
  currencyCode: "BRL",
  id: "a",
  itemId: "c",
  name: "Synthetic",
  type: "BANK",
  ...input,
});
export const transaction = (
  input: Partial<ProviderTransaction> = {},
): ProviderTransaction => ({
  accountId: "a",
  amount: "-10.00",
  currencyCode: "BRL",
  date: "2026-10-01",
  description: "Synthetic",
  id: "t",
  status: "POSTED",
  type: "DEBIT",
  ...input,
});
export function source(
  rows: ProviderTransaction[],
  accounts: ProviderAccount[] = [account()],
): FinancialSource {
  return {
    accounts: async (id) => accounts.filter((row) => row.itemId === id),
    connection: async (id) => ({ connector: { id: 200 }, id }),
    transactions: async (id) => ({
      next: null,
      records: rows.filter((row) => row.accountId === id),
    }),
  };
}
export async function admit(
  now = "2026-10-01T00:00:00.000Z",
  connectionId = "c",
) {
  await createInstallationRepository(env.DB).register(connectionId);
  const [admission] = await createSyncRepository(env.DB).admit(
    [connectionId],
    now,
  );
  return required(admission?.importId);
}
export async function collect(
  financialSource: FinancialSource,
  now = "2026-10-01T00:00:00.000Z",
  connectionId = "c",
) {
  const id = await admit(now, connectionId);
  await runImport(
    {
      now: () => now,
      repository: createSyncRepository(env.DB),
      source: financialSource,
      steps: { do: (_name, fn) => fn() },
    },
    id,
  );
  return id;
}
