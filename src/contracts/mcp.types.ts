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
  setup_status: "caderninho_setup_status",
  sync: "caderninho_sync",
  reconcile: "caderninho_reconcile",
  reapply: "caderninho_reapply",
  status: "caderninho_status",
  query: "caderninho_query",
  aggregate: "caderninho_aggregate",
  rules: "caderninho_rules",
  preview: "caderninho_preview",
  override: "caderninho_override",
  explain: "caderninho_explain",
  get_subscriptions: "caderninho_get_subscriptions",
  live_balance: "caderninho_live_balance",
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
