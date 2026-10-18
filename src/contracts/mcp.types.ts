import type { CorrectionInput, RecordReference } from "@/domain/finance.entity";

import type {
  LiveBalanceInput,
  PreviewInput,
  RuleCommand,
  SubscriptionInput,
} from "./finance.types";
import type { OperationSelection } from "./operation.types";
import type { Aggregate, Query } from "./queries.types";

interface LongInput extends OperationSelection {
  requestKey: string;
}

export const ToolName = {
  aggregate: "caderninho_aggregate",
  explain: "caderninho_explain",
  get_subscriptions: "caderninho_get_subscriptions",
  live_balance: "caderninho_live_balance",
  override: "caderninho_override",
  preview: "caderninho_preview",
  query: "caderninho_query",
  reapply: "caderninho_reapply",
  reconcile: "caderninho_reconcile",
  rules: "caderninho_rules",
  setup_status: "caderninho_setup_status",
  status: "caderninho_status",
  sync: "caderninho_sync",
} as const;

interface ToolInputs {
  [ToolName.setup_status]: Record<string, never>;
  [ToolName.sync]: LongInput;
  [ToolName.reconcile]: LongInput;
  [ToolName.reapply]: LongInput;
  [ToolName.status]: Record<string, never>;
  [ToolName.query]: Query;
  [ToolName.aggregate]: Aggregate;
  [ToolName.rules]: RuleCommand;
  [ToolName.preview]: PreviewInput;
  [ToolName.override]: CorrectionInput;
  [ToolName.explain]: RecordReference;
  [ToolName.get_subscriptions]: SubscriptionInput;
  [ToolName.live_balance]: LiveBalanceInput;
}

export type ToolCall = {
  [Name in keyof ToolInputs]: { name: Name; input: ToolInputs[Name] };
}[keyof ToolInputs];
