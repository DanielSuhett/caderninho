import { ToolCallSchema } from "#contracts/mcp-contract.ts";
import type { FinancialQueries } from "#worker/finance/service.ts";

export async function invoke(
  queries: FinancialQueries,
  name: string,
  input: unknown,
): Promise<unknown> {
  const call = ToolCallSchema.parse({ name, input });
  switch (call.name) {
    case "caderninho_setup_status":
      return queries.setupStatus();
    case "caderninho_query":
      return queries.query(call.input);
    case "caderninho_aggregate":
      return queries.aggregate(call.input);
    case "caderninho_status":
      return queries.readStatus();
    case "caderninho_rules":
      return queries.manageRules(call.input);
    case "caderninho_override":
      return queries.correctRecord(call.input);
    case "caderninho_explain":
      return queries.explainRecord(call.input);
    case "caderninho_preview":
      return queries.previewRules(call.input);
    case "caderninho_get_subscriptions":
      return queries.readSubscriptions(call.input);
    case "caderninho_live_balance": {
      await queries.authorizeAccount(call.input);
      const raw = await queries.readAccount(call.input.accountId);
      return {
        balance: raw.balance,
        currency: raw.currencyCode,
        sourceUpdatedAt: raw.updatedAt ?? null,
        readAt: queries.now(),
        bankRealtime: false,
      };
    }
    case "caderninho_sync":
    case "caderninho_reconcile":
    case "caderninho_reapply":
      throw new Error("DURABLE_TASK_REQUIRED");
  }
}
