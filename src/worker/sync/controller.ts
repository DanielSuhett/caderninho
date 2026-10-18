import { MigrationRequestSchema, WebhookSchema } from "@/contracts/operation";
import { secretsEqual } from "@/shared/crypto";

import type { Bindings } from "../bindings";
import { syncService } from "../composition";
import { boundedJson } from "../http";

export async function migrationHttp(request: Request, env: Bindings) {
  const input = MigrationRequestSchema.parse(await boundedJson(request));
  const result = await syncService(env).migrate(input);
  // A domain operation handle, not an unnegotiated MCP CreateTaskResult.
  return Response.json(result.body, { status: result.status });
}
export async function receiveWebhook(request: Request, env: Bindings) {
  const supplied = request.headers.get("X-Caderninho-Webhook-Secret");
  if (!(env.WEBHOOK_SECRET && supplied)) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (!(await secretsEqual({ expected: env.WEBHOOK_SECRET, supplied }))) {
    return new Response("Unauthorized", { status: 401 });
  }

  const event = WebhookSchema.parse(await boundedJson(request));
  const accepted = await syncService(env).acceptWebhook(event);
  return accepted
    ? new Response(null, { status: 204 })
    : new Response("Unknown item", { status: 404 });
}
