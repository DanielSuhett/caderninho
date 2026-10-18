import type { OAuthHelpers } from "@cloudflare/workers-oauth-provider";

export interface DurableInstance {
  id: string;
  status(): Promise<{ status: string }>;
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
  CF_VERSION_METADATA: Cloudflare.Env["CF_VERSION_METADATA"];
  ADMIN_PASSWORD?: string;
  PLUGGY_CLIENT_ID?: string;
  PLUGGY_CLIENT_SECRET?: string;
  WEBHOOK_SECRET?: string;
}
