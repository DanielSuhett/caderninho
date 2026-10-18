import { AccountResponseSchema } from "#contracts/portal-contract.ts";

export function accountSnapshot() {
  return AccountResponseSchema.parse({
    origin: "https://caderninho.test",
    csrf: "synthetic-csrf",
    rotate: false,
    account: {
      config: { enabled: 1, next_sync_at: "tomorrow", updated_at: "today" },
      latest: null,
      items: [],
    },
    data: {
      checks: {
        owner: true,
        origin: true,
        github: true,
        access: true,
        vault: true,
        database: true,
        workflow: true,
        oauth: true,
        migrations: true,
      },
      status: {
        installation: true,
        authorized: 1,
        received: 1,
        clientsAvailable: true,
        checkedAt: "2026-10-17T12:00:00Z",
        wizard: {
          credentials: true,
          connected: true,
          sync: "working",
          paused: false,
          coverage: { total: 2, complete: 1 },
        },
      },
      clients: [
        {
          id: "synthetic-grant",
          clientId: "synthetic-client",
          name: "Assistente sintético",
          createdAt: 1,
          receivedAt: "2026-10-17T12:00:00Z",
        },
      ],
      cursor: "synthetic-cursor",
    },
  });
}
