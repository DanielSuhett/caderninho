import type {
  AccountConnectToken,
  AccountResponse,
} from "@/contracts/portal.types";
import type { WizardState } from "@/contracts/wizard.types";

export function accountConnectToken(): AccountConnectToken {
  return {
    accessToken: "synthetic-token",
    configuration: {
      connectorIds: [200],
      includeSandbox: false,
      selectedConnectorId: 200,
    },
  };
}

export function accountSnapshot(): AccountResponse {
  const status: WizardState = {
    connected: true,
    coverage: { complete: 1, total: 2 },
    credentials: true,
    paused: false,
    sync: "working",
  };
  return {
    checkedAt: "2026-10-17T12:00:00Z",
    checks: { database: true, migrations: true, oauth: true, workflow: true },
    csrf: "synthetic-csrf",
    items: [],
    latest: null,
    origin: "https://caderninho.test",
    panel: {
      initialStep: 2,
      polling: { intervalMs: 5000, retryIntervalMs: 30_000 },
      support: { connectorId: 200, diagnostic: { ...status, issue: null } },
      sync: "preparing",
    },
    status,
  };
}
