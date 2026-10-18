import type { OAuthHelpers } from "@cloudflare/workers-oauth-provider";

// Structural adapter to the documented native Workflow RPC API; no cast of an
// older binding into a newer SDK. Runtime availability is checked by integration tests.
export interface InstanceEvents {
  next(): Promise<{ done: boolean; value?: { type: string; eventId: number } }>;
  [Symbol.dispose](): void;
}
export interface DurableInstance {
  id: string;
  status(): Promise<{ status: string }>;
  subscribe(options?: {
    filter?: string[];
    cursor?: number;
  }): Promise<InstanceEvents>;
}
export interface DurableWorkflow {
  create(options: {
    id: string;
    params: { operationId: string };
  }): Promise<DurableInstance>;
  get(id: string): Promise<DurableInstance>;
}
export interface Bindings {
  DB: Cloudflare.Env["DB"];
  FINANCE: DurableWorkflow;
  OAUTH_KV: Cloudflare.Env["OAUTH_KV"];
  ASSETS?: Cloudflare.Env["ASSETS"];
  OAUTH_PROVIDER: OAuthHelpers;
  TASK_EVENT_SOURCE?: "d1" | "workflow";
  PUBLIC_ORIGIN: string;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  CREDENTIAL_KEY?: string;
  CREDENTIAL_PREVIOUS_KEY?: string;
  OWNER_GITHUB_ID?: string;
  OWNER_ID?: string;
  ADMIN_KEY_SHA256?: string;
  WEBHOOK_SECRET: string;
}
