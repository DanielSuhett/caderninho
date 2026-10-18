import { MigrationRequestSchema, WebhookSchema } from "#contracts/operation.ts";
import type { Bindings } from "#worker/bindings.ts";
import { syncService } from "#worker/composition.ts";
import { boundedJson } from "#worker/http.ts";

export async function migrationHttp(request: Request, env: Bindings) {
  const input = MigrationRequestSchema.parse(await boundedJson(request));
  const result = await syncService(env).migrate(input);
  // A domain operation handle, not an unnegotiated MCP CreateTaskResult.
  return Response.json(result.body, { status: result.status });
}
export async function receiveWebhook(request: Request, env: Bindings) {
  const supplied = request.headers.get("X-Caderninho-Webhook-Secret");
  if (!env.WEBHOOK_SECRET || !supplied) {
    return new Response("Unauthorized", { status: 401 });
  }
  const digest = async (s: string) =>
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)),
    );
  const [a, b] = await Promise.all([
    digest(supplied),
    digest(env.WEBHOOK_SECRET),
  ]);
  let diff = 0;
  const expected = new DataView(b.buffer, b.byteOffset, b.byteLength);
  for (const [index, value] of a.entries()) {
    diff |= value ^ expected.getUint8(index);
  }
  if (diff) {
    return new Response("Unauthorized", { status: 401 });
  }

  const event = WebhookSchema.parse(await boundedJson(request));
  const accepted = await syncService(env).acceptWebhook(event);
  return accepted
    ? new Response(null, { status: 204 })
    : new Response("Unknown item", { status: 403 });
}
