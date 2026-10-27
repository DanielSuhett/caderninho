import type { OAuthHelpers } from "@cloudflare/workers-oauth-provider";

export interface DurableInstance {
  id: string;
  status: () => Promise<{ status: string }>;
}
export interface DurableWorkflow {
  create: (options: {
    id: string;
    params: { runId: string };
  }) => Promise<DurableInstance>;
  get: (id: string) => Promise<DurableInstance>;
}
export interface RuleWorkflow {
  create: (options: {
    id: string;
    params: { jobId: string };
  }) => Promise<DurableInstance>;
}
export interface Bindings {
  ADMIN_ACCESS_HASH?: string;
  ADMIN_PASSWORD?: string;
  ASSETS?: Cloudflare.Env["ASSETS"];
  CF_VERSION_METADATA: Cloudflare.Env["CF_VERSION_METADATA"];
  DB: Cloudflare.Env["DB"];
  FINANCE: DurableWorkflow;
  LOGIN_LIMITER: {
    limit: (input: { key: string }) => Promise<{ success: boolean }>;
  };
  OAUTH_KV: Cloudflare.Env["OAUTH_KV"];
  OAUTH_PROVIDER: OAuthHelpers;
  PLUGGY_CLIENT_ID?: string;
  PLUGGY_CLIENT_SECRET?: string;
  RULES: RuleWorkflow;
}
