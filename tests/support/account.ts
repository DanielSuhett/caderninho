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
      selectedConnectorId: 200,
      includeSandbox: false,
    },
  };
}

export function accountSnapshot(): AccountResponse {
  const status: WizardState = {
    credentials: true,
    connected: true,
    sync: "working",
    paused: false,
    coverage: { total: 2, complete: 1 },
  };
  return {
    origin: "https://caderninho.test",
    csrf: "synthetic-csrf",
    checkedAt: "2026-10-17T12:00:00Z",
    checks: { database: true, workflow: true, oauth: true, migrations: true },
    items: [],
    latest: null,
    panel: {
      initialStep: 2,
      sync: "preparing",
      polling: { intervalMs: 5000, retryIntervalMs: 30000 },
      support: { diagnostic: { ...status, issue: null }, connectorId: 200 },
    },
    status,
  };
}
