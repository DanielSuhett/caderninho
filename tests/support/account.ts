import type { AccountResponse } from "#contracts/portal.types.ts";

export function accountSnapshot(): AccountResponse {
  return {
    origin: "https://caderninho.test",
    csrf: "synthetic-csrf",
    checkedAt: "2026-10-17T12:00:00Z",
    checks: { database: true, workflow: true, oauth: true, migrations: true },
    items: [],
    latest: null,
    status: {
      credentials: true,
      connected: true,
      sync: "working",
      paused: false,
      coverage: { total: 2, complete: 1 },
    },
  };
}
