import { z } from "zod/v4";

import type { PlaygroundState } from "#contracts/portal-contract.ts";
import {
  type Credentials,
  type Connection,
  WizardStateSchema,
  type WizardState,
} from "#contracts/wizard-contract.ts";
import {
  isPersonalConnector,
  MAX_PERSONAL_CONNECTIONS,
} from "#domain/connection-policy.ts";
import { tryCatch } from "#shared/result.ts";
import type { createAccountRepository } from "#worker/account/repository.ts";

export interface ConnectionStore {
  currentClientId(): Promise<string | null>;
  itemAccess(itemId: string): Promise<{ count: number; exists: boolean }>;
  saveCredentials(credentials: Credentials, now: string): Promise<void>;
  connect(connection: Connection, now: string): Promise<void>;
}
export interface ConnectionSource {
  validateCredentials(credentials: Credentials): Promise<void>;
  readItem(
    credentials: Credentials,
    itemId: string,
  ): Promise<{ id: string; connector?: { id: number | string } }>;
}

export async function saveWizardCredentials(
  store: ConnectionStore,
  source: ConnectionSource,
  credentials: Credentials,
  now: string,
) {
  const previous = await store.currentClientId();
  if (previous && previous !== credentials.clientId)
    throw new Error("APPLICATION_CHANGE_REQUIRES_MIGRATION");
  await source.validateCredentials(credentials);
  await store.saveCredentials(credentials, now);
}
export async function connectWizardItem(
  store: ConnectionStore,
  source: ConnectionSource,
  credentials: Credentials,
  itemId: string,
  now: string,
) {
  const previous = await store.currentClientId();
  if (previous && previous !== credentials.clientId)
    throw new Error("APPLICATION_CHANGE_REQUIRES_MIGRATION");
  const access = await store.itemAccess(itemId);
  if (access.count >= MAX_PERSONAL_CONNECTIONS && !access.exists)
    throw new Error("ITEM_LIMIT");
  const item = await source.readItem(credentials, itemId);
  if (!isPersonalConnector(item.connector?.id))
    throw new Error("MEU_PLUGGY_REQUIRED");
  if (item.id !== itemId) throw new Error("SOURCE_SCOPE_MISMATCH");
  await store.connect({ ...credentials, itemId }, now);
}
export interface WizardEvidence {
  status: { config: { enabled: number } | null; items: { id: string }[] };
  coverage: { total: number; complete: number | null };
  latest: { status: string; phase: string } | null;
}
function synchronizationState(
  latest: WizardEvidence["latest"],
): WizardState["sync"] {
  if (latest?.phase === "error" || latest?.status === "failed") return "error";
  if (latest?.status === "working") return "working";
  if (latest?.status === "completed") return "completed";
  if (latest?.status === "cancelled") return "cancelled";
  return "waiting";
}
export function wizardState({ status, coverage, latest }: WizardEvidence) {
  return WizardStateSchema.parse({
    credentials: Boolean(status.config),
    connected: status.items.length > 0,
    sync: synchronizationState(latest),
    coverage: { total: coverage.total, complete: coverage.complete ?? 0 },
    paused: status.config?.enabled === 0 && status.items.length > 0,
  });
}

export interface PlaygroundReads {
  wizard(): Promise<WizardState>;
  installation(): Promise<PlaygroundState["checks"]>;
  access(): Promise<{ clients: PlaygroundState["clients"]; cursor?: string }>;
  now(): string;
}
export async function playgroundState(
  reads: PlaygroundReads,
): Promise<PlaygroundState> {
  const [wizard, checks, access] = await Promise.all([
    reads.wizard(),
    reads.installation(),
    tryCatch(reads.access()),
  ]);
  const clients = access.error ? [] : access.data.clients;
  return {
    status: {
      wizard,
      installation:
        checks.owner &&
        checks.origin &&
        checks.access &&
        checks.vault &&
        checks.database &&
        checks.migrations &&
        checks.workflow &&
        checks.oauth,
      authorized: clients.length,
      received: clients.filter((client) => client.receivedAt).length,
      clientsAvailable: !access.error,
      checkedAt: reads.now(),
    },
    checks,
    clients,
    cursor: access.error ? undefined : access.data.cursor,
  };
}

interface AccountDependencies {
  repository: ReturnType<typeof createAccountRepository>;
  source: ConnectionSource;
  credentials(): Promise<Credentials>;
  connectToken(
    credentials: Credentials,
    itemId?: string,
  ): Promise<{ accessToken: string }>;
  installation(): Promise<PlaygroundState["checks"]>;
  access(
    cursor?: string,
  ): Promise<{ clients: PlaygroundState["clients"]; cursor?: string }>;
  rotate(): Promise<void>;
  now(): Date;
}

export function createAccountService(deps: AccountDependencies) {
  const state = async () => wizardState(await deps.repository.evidence());
  return {
    saveCredentials: (credentials: Credentials) =>
      saveWizardCredentials(
        deps.repository.connection,
        deps.source,
        credentials,
        deps.now().toISOString(),
      ),
    async connectItem(itemId: string) {
      return connectWizardItem(
        deps.repository.connection,
        deps.source,
        await deps.credentials(),
        z.uuid().parse(itemId),
        deps.now().toISOString(),
      );
    },
    wizardState: state,
    status: () => deps.repository.status(),
    playground: (cursor?: string) =>
      playgroundState({
        wizard: state,
        installation: () => deps.installation(),
        access: () => deps.access(cursor),
        now: () => deps.now().toISOString(),
      }),
    async token(itemId?: string) {
      if (itemId)
        await deps.repository.authorizeItems([z.uuid().parse(itemId)]);
      return deps.connectToken(await deps.credentials(), itemId);
    },
    pause: () => deps.repository.pause(),
    async resume() {
      await deps.credentials();
      await deps.repository.resume(deps.now().toISOString());
    },
    requestSync: () => deps.repository.requestSync(deps.now()),
    rotate: () => deps.rotate(),
  };
}
