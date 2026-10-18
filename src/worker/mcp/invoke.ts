import { ToolCallSchema, ToolName } from "../../contracts";
import type { FinancialQueries } from "../finance";

export async function invoke(
  queries: FinancialQueries,
  name: string,
  input: unknown,
): Promise<unknown> {
  const call = ToolCallSchema.parse({ input, name });
  switch (call.name) {
    case ToolName.setup_status:
      return queries.setupStatus();
    case ToolName.query:
      return queries.query(call.input);
    case ToolName.aggregate:
      return queries.aggregate(call.input);
    case ToolName.status:
      return queries.readStatus();
    case ToolName.rules:
      return queries.manageRules(call.input);
    case ToolName.override:
      return queries.correctRecord(call.input);
    case ToolName.explain:
      return queries.explainRecord(call.input);
    case ToolName.preview:
      return queries.previewRules(call.input);
    case ToolName.get_subscriptions:
      return queries.readSubscriptions(call.input);
    case ToolName.live_balance: {
      const raw = await queries.readAccount(call.input.accountId);
      return {
        balance: raw.balance,
        bankRealtime: false,
        currency: raw.currencyCode,
        readAt: queries.now(),
        sourceUpdatedAt: raw.updatedAt ?? null,
      };
    }
    case ToolName.sync:
    case ToolName.reconcile:
    case ToolName.reapply:
      throw new Error("DURABLE_TASK_REQUIRED");
    default: {
      const unexpected: never = call;
      throw new Error(`UNSUPPORTED_TOOL: ${unexpected}`);
    }
  }
}
