import type { OAuthHelpers } from "@cloudflare/workers-oauth-provider";

export interface DurableInstance {
  id: string;
  status: () => Promise<{ status: string }>;
}
export interface DurableWorkflow {
  create: (options: {
    id: string;
    params: { operationId: string };
  }) => Promise<DurableInstance>;
  get: (id: string) => Promise<DurableInstance>;
}
export interface Bindings {
  ADMIN_PASSWORD?: string;
  ASSETS?: Cloudflare.Env["ASSETS"];
  CF_VERSION_METADATA: Cloudflare.Env["CF_VERSION_METADATA"];
  DB: Cloudflare.Env["DB"];
  FINANCE: DurableWorkflow;
  OAUTH_KV: Cloudflare.Env["OAUTH_KV"];
  OAUTH_PROVIDER: OAuthHelpers;
  PLUGGY_CLIENT_ID?: string;
  PLUGGY_CLIENT_SECRET?: string;
  WEBHOOK_SECRET?: string;
}
