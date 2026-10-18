import { AsyncLocalStorage } from "node:async_hooks";

import type { Logger } from "pino";
import { z } from "zod/v4";

import type { ToolName } from "../../contracts";
import {
  Fault,
  FaultCode,
  type OperationKind,
  type Resource,
} from "../../domain";
import { type Result, tryCatch } from "../../shared";
import { logger } from "../../shared/logger";
import { tracing } from "cloudflare:workers";

export const SpanName = {
  accountAction: "account.action",
  admission: "sync.admission",
  authentication: "auth.request",
  batchPublish: "finance.publish",
  dispatch: "sync.dispatch",
  financeAction: "finance.action",
  httpRequest: "http.request",
  maintenance: "sync.maintenance",
  mcpCall: "mcp.call",
  mcpStream: "mcp.stream",
  operation: "sync.operation",
  operationPhase: "sync.phase",
  phase: "sync.phase",
  providerRead: "pluggy.read",
  publication: "finance.publish",
  reapplication: "finance.reapply",
  reapply: "finance.reapply",
  recovery: "sync.recovery",
  scheduled: "sync.scheduled",
  source: "pluggy.read",
} as const;
export type SpanName = (typeof SpanName)[keyof typeof SpanName];

export const Outcome = {
  cancelled: "cancelled",
  completed: "completed",
  deferred: "deferred",
  failed: "failed",
  noop: "noop",
  partial: "partial",
  rejected: "rejected",
  replayed: "replayed",
  success: "success",
} as const;
export type Outcome = (typeof Outcome)[keyof typeof Outcome];
export const Phase = {
  acquire: "acquire",
  collect: "collect",
  complete: "complete",
  mature: "mature",
  process: "process",
  publish: "publish",
  select: "select",
} as const;
export type Phase = (typeof Phase)[keyof typeof Phase];
export const Recovery = {
  none: "none",
  resume: "resume",
  retry: "retry",
  scheduled: "scheduled",
} as const;
export type Recovery = (typeof Recovery)[keyof typeof Recovery];
export const DiagnosticEvent = {
  dispatch: "SYNC_DISPATCH",
  http: "HTTP_REQUEST",
  maintenance: "MAINTENANCE",
  mcp: "MCP_REQUEST",
  operation: "SYNC_OPERATION",
  recovery: "SYNC_RECOVERY",
  scheduled: "SYNC_SCHEDULED",
  stream: "MCP_STREAM",
} as const;
export type DiagnosticEvent =
  (typeof DiagnosticEvent)[keyof typeof DiagnosticEvent];

const localFailures = {
  DISPATCH_UNCERTAIN: "DISPATCH_UNCERTAIN",
  EXECUTOR_BUSY: "EXECUTOR_BUSY",
  INSTALLATION_INCOMPLETE: "INSTALLATION_INCOMPLETE",
  INVALID_REQUEST: "INVALID_REQUEST",
  SESSION_REQUIRED: "SESSION_REQUIRED",
  UPSTREAM_NETWORK: "UPSTREAM_NETWORK",
} as const;
export const FailureCode = { ...FaultCode, ...localFailures } as const;
export type FailureCode =
  | FaultCode
  | (typeof localFailures)[keyof typeof localFailures];

const failures = new Map<string, FailureCode>(
  Object.values(FaultCode).map((code) => [code, code]),
);
for (const code of Object.values(localFailures)) {
  failures.set(code, code);
}
for (const code of [
  "EMPTY_FORM",
  "FORM_TOO_LARGE",
  "DUPLICATE_FORM_FIELD",
  "UNKNOWN_ACTION",
  "HTTPS_REQUIRED",
  "BODY_REQUIRED",
  "BODY_LIMIT",
  "MEU_PLUGGY_REQUIRED",
  "SOURCE_IDENTITY_MISMATCH",
  "ITEM_LIMIT",
  "IDEMPOTENCY_CONFLICT",
  "REAPPLICATION_CONFLICT_START_NEW_REQUEST",
  "REAPPLICATION_TOO_LARGE_USE_BATCHES",
  "REAPPLICATION_SELECTION_CONFLICT",
  "FINANCIAL_EXECUTOR_BUSY_RETRY_BATCH",
  "REAPPLICATION_CANCELLED",
  "RENORMALIZE_REQUIRES_RECONCILIATION",
  "SYNC_FILTER_NOT_SUPPORTED_USE_ITEM_SCOPE",
  "SUBSCRIPTION_LIMIT",
  "OPERATION_NOT_FOUND",
  "LOCAL_RECEIPT_NOT_FOUND",
  "NOT_FOUND",
  "UNKNOWN_CATEGORY",
  "RULES_REVISION_REQUIRED",
  "RESTART_REQUIRED",
  "CURSOR_SCOPE_MISMATCH",
  "ANALYSIS_LIMIT_NARROW_PERIOD",
  "EXACT_AGGREGATE_LIMIT",
]) {
  failures.set(code, localFailures.INVALID_REQUEST);
}
failures.set(
  "FINANCIAL_EXECUTOR_BUSY_RESUME_DISPATCH",
  localFailures.EXECUTOR_BUSY,
);
for (const code of ["PLUGGY_ACCOUNT_NOT_CONFIGURED", "SETTINGS_MISSING"]) {
  failures.set(code, localFailures.INSTALLATION_INCOMPLETE);
}
const expected = new Set<FailureCode>([
  localFailures.INVALID_REQUEST,
  localFailures.SESSION_REQUIRED,
  localFailures.INSTALLATION_INCOMPLETE,
  FaultCode.AUTH_NOT_CONFIGURED,
  FaultCode.STORAGE_NOT_CONFIGURED,
  FaultCode.NOT_INITIALIZED,
  FaultCode.ACCOUNT_NOT_IN_SNAPSHOT,
  FaultCode.BANK_ACCOUNT_REQUIRED,
  FaultCode.FIELD_NOT_ALLOWED,
  FaultCode.FILTER_NOT_SUPPORTED,
  FaultCode.GROUP_NOT_ALLOWED,
  FaultCode.INVALID_ACCOUNT,
  FaultCode.INVALID_ARGUMENT,
  FaultCode.INVALID_CURRENCY,
  FaultCode.INVALID_CURSOR,
  FaultCode.INVALID_DATE,
  FaultCode.INVALID_DECIMAL,
  FaultCode.INVALID_FILTER,
  FaultCode.INVALID_ID,
  FaultCode.INVALID_ITEM_ID,
  FaultCode.INVALID_MODE,
  FaultCode.INVALID_MONEY,
  FaultCode.INVALID_PAGE,
  FaultCode.INVALID_SORT,
  FaultCode.INVALID_STATUS,
  FaultCode.INVALID_TRANSACTION,
  FaultCode.INVALID_TYPE,
  FaultCode.LIVE_BALANCE_ACCOUNT_REQUIRED,
  FaultCode.LIVE_DETAIL_UNSUPPORTED,
  FaultCode.METRIC_NOT_ALLOWED,
  FaultCode.PERIOD_REQUIRED,
  FaultCode.QUERY_CACHED_ONLY,
  FaultCode.QUERY_LIMIT,
  FaultCode.RESUME_NOT_FOUND,
  FaultCode.SNAPSHOT_NOT_FOUND,
  FaultCode.SNAPSHOT_REQUIRED,
  FaultCode.SORT_NOT_ALLOWED,
  FaultCode.UNKNOWN_TOOL,
]);

export function classifyFailure(error: Error): FailureCode {
  const context = observation.getStore();
  if (context?.primary.error === error && context.primary.failure) {
    return context.primary.failure;
  }
  if (error instanceof z.ZodError || error instanceof SyntaxError) {
    return localFailures.INVALID_REQUEST;
  }
  return (
    failures.get(error instanceof Fault ? error.code : error.message) ??
    FaultCode.INTERNAL_ERROR
  );
}
export function failureOutcome(failure: FailureCode): Outcome {
  return expected.has(failure) ? Outcome.rejected : Outcome.failed;
}

// Each attribute is selected explicitly; callers cannot serialize arbitrary inputs.
export interface SafeFields {
  action?:
    | (typeof ToolName)[keyof typeof ToolName]
    | "reconcile"
    | "compact_sync"
    | "compact_auth"
    | "readiness"
    | "status"
    | "subscriptions"
    | "live_balance"
    | "setup_status"
    | "preview"
    | "rules_read"
    | "rules_list"
    | "rules_save"
    | "rules_activate"
    | "tasks_get"
    | "tasks_cancel"
    | "tasks_update"
    | "subscriptions_listen"
    | "tools_list"
    | "read"
    | "write"
    | "login"
    | "logout"
    | "authorize"
    | "token"
    | "connect"
    | "pause"
    | "resume"
    | "sync"
    | "disconnect"
    | "query"
    | "aggregate"
    | "explain"
    | "rules"
    | "correct"
    | "reapply"
    | "initialize"
    | "get"
    | "list"
    | "cancel"
    | "subscribe"
    | "unknown";
  attempt?: number;
  batches?: number;
  deferred?: number;
  delayMs?: number;
  dispatchPending?: number;
  durationMs?: number;
  failed?: number;
  failure?: FailureCode;
  operationKind?: OperationKind;
  outcome?: Outcome;
  pages?: number;
  phase?: SpanName | Phase;
  processed?: number;
  recovery?: Recovery;
  resource?: Resource;
  retries?: number;
  schedulePending?: number;
  sourceUnauthorized?: number;
  sourceUnavailable?: number;
  status?: number;
  statusUnavailable?: number;
}
function safeFields(input: SafeFields): SafeFields {
  return {
    ...(input.action && { action: input.action }),
    ...(input.outcome && { outcome: input.outcome }),
    ...(input.failure && { failure: input.failure }),
    ...(input.recovery && { recovery: input.recovery }),
    ...(input.operationKind && { operationKind: input.operationKind }),
    ...(input.resource && { resource: input.resource }),
    ...(input.phase && { phase: input.phase }),
    ...safeMeasurements(input),
  };
}
function safeMeasurements(input: SafeFields): SafeFields {
  return {
    ...(input.processed !== undefined && { processed: input.processed }),
    ...(input.sourceUnauthorized !== undefined && {
      sourceUnauthorized: input.sourceUnauthorized,
    }),
    ...(input.sourceUnavailable !== undefined && {
      sourceUnavailable: input.sourceUnavailable,
    }),
    ...(input.failed !== undefined && { failed: input.failed }),
    ...(input.pages !== undefined && { pages: input.pages }),
    ...(input.batches !== undefined && { batches: input.batches }),
    ...(input.retries !== undefined && { retries: input.retries }),
    ...(input.deferred !== undefined && { deferred: input.deferred }),
    ...(input.attempt !== undefined && { attempt: input.attempt }),
    ...(input.delayMs !== undefined && { delayMs: input.delayMs }),
    ...(input.status !== undefined && { status: input.status }),
    ...(input.statusUnavailable !== undefined && {
      statusUnavailable: input.statusUnavailable,
    }),
    ...(input.dispatchPending !== undefined && {
      dispatchPending: input.dispatchPending,
    }),
    ...(input.schedulePending !== undefined && {
      schedulePending: input.schedulePending,
    }),
    ...(input.durationMs !== undefined && { durationMs: input.durationMs }),
  };
}
interface SpanObservation extends SafeFields {
  correlation?: string;
  name: SpanName;
  operationId?: string;
  parent?: SpanName;
  runId?: string;
}
interface ObservationInput {
  correlation?: string;
  independent?: true;
  onSpan?: (span: SpanObservation) => void;
  operationId?: string;
  output?: Pick<Logger, "debug" | "warn" | "error">;
  runId?: string;
}
interface Observation extends ObservationInput {
  activeSpan?: SpanName;
  primary: {
    error?: Error;
    reported: boolean;
    severity?: number;
    failure?: FailureCode;
    phase?: SpanName | Phase;
    recovery?: Recovery;
  };
}
const observation = new AsyncLocalStorage<Observation>();

export function withObservation<T>(
  input: ObservationInput,
  operation: () => T,
): T {
  const parent = observation.getStore();
  const { independent, ...fields } = input;
  return observation.run(
    {
      ...parent,
      ...fields,
      ...(independent &&
        !parent &&
        !input.correlation &&
        !input.runId && { runId: crypto.randomUUID() }),
      primary:
        independent || input.correlation || input.runId || !parent
          ? { reported: false }
          : parent.primary,
    },
    operation,
  );
}
export function captureObservation() {
  const context = observation.getStore();
  return <T>(operation: () => T): T =>
    context ? observation.run(context, operation) : operation();
}
export function markFailure(
  error: Error,
  fields: Pick<SafeFields, "failure" | "phase" | "recovery"> = {},
) {
  const context = observation.getStore();
  if (!context || (context.primary.failure && !fields.failure)) {
    return;
  }
  context.primary.failure = fields.failure ?? classifyFailure(error);
  context.primary.error = error;
  if (fields.phase) {
    context.primary.phase = fields.phase;
  }
  if (fields.recovery) {
    context.primary.recovery = fields.recovery;
  }
}
function correlationFields(context = observation.getStore()) {
  return {
    ...(context?.correlation && { correlation: context.correlation }),
    ...(context?.runId && { runId: context.runId }),
    ...(context?.operationId && { operationId: context.operationId }),
  };
}

function diagnosticOutcome(input: SafeFields, failure?: FailureCode): Outcome {
  if (input.outcome) {
    return input.outcome;
  }
  if (failure) {
    return failureOutcome(failure);
  }
  if (input.status && input.status >= 500) {
    return Outcome.failed;
  }
  return input.status && input.status >= 400
    ? Outcome.rejected
    : Outcome.success;
}
function spanOutcome(input: SafeFields): Outcome {
  if (
    input.failure &&
    (!input.outcome ||
      input.outcome === Outcome.success ||
      input.outcome === Outcome.completed ||
      input.outcome === Outcome.replayed ||
      input.outcome === Outcome.noop)
  ) {
    return failureOutcome(input.failure);
  }
  return diagnosticOutcome(input, input.failure);
}
function diagnosticSeverity(outcome: Outcome, recovery?: Recovery) {
  if (outcome === Outcome.partial || outcome === Outcome.deferred) {
    return 40;
  }
  if (outcome !== Outcome.failed) {
    return 20;
  }
  return recovery && recovery !== Recovery.none ? 40 : 50;
}

export function reportDiagnostic(
  input: SafeFields & { event: DiagnosticEvent; additional?: boolean },
) {
  const context = observation.getStore();
  const failure =
    input.failure ??
    context?.primary.failure ??
    (input.status && input.status >= 500
      ? FaultCode.INTERNAL_ERROR
      : undefined);
  const fields = {
    recovery: Recovery.none,
    ...safeFields(input),
    ...(failure && { failure }),
    ...(context?.primary.phase &&
      !input.phase && { phase: context.primary.phase }),
    ...(context?.primary.recovery &&
      !input.recovery && { recovery: context.primary.recovery }),
  };
  const outcome = diagnosticOutcome(input, failure);
  const diagnostic = {
    event: input.event,
    ...correlationFields(context),
    ...fields,
    outcome,
  };
  const severity = diagnosticSeverity(outcome, fields.recovery);
  if (
    context?.primary.reported &&
    (context.primary.severity ?? 0) >= severity &&
    !input.additional
  ) {
    return diagnostic;
  }
  const output = context?.output ?? logger;
  // Logging is best effort and must preserve the result of the observed operation.
  try {
    if (severity === 50) {
      output.error(diagnostic);
    } else if (severity === 40) {
      output.warn(diagnostic);
    } else {
      output.debug(diagnostic);
    }
  } catch {
    // A saturated or unavailable logger must not become an application failure.
  }
  if (context && !input.additional) {
    context.primary.reported = true;
    context.primary.severity = severity;
  }
  return diagnostic;
}

export interface ObservedSpan {
  annotate: (fields: SafeFields) => void;
  end: (fields?: SafeFields) => void;
}
function spanHandle(
  name: SpanName,
  native: Pick<Span, "setAttributes" | "end"> | undefined,
  initial: SafeFields,
): ObservedSpan {
  const context = observation.getStore();
  const started = performance.now();
  let ended = false;
  let fields = safeFields(initial);
  const annotate = (next: SafeFields) => {
    fields = { ...fields, ...safeFields(next) };
    // Native tracing is best effort, including when traces are disabled or unsampled.
    try {
      native?.setAttributes({ ...correlationFields(context), ...fields });
    } catch {
      // Tracing failures never alter application behavior.
    }
  };
  annotate(initial);
  return {
    annotate,
    end(next = {}) {
      if (ended) {
        return;
      }
      ended = true;
      const finalFields = { ...fields, ...next };
      annotate({
        ...finalFields,
        durationMs: Math.round(performance.now() - started),
        outcome: spanOutcome(finalFields),
      });
      try {
        native?.end();
        context?.onSpan?.({
          name,
          ...correlationFields(context),
          ...fields,
          ...(context.activeSpan && { parent: context.activeSpan }),
        });
      } catch {
        // Observers and native tracing cannot mask the original result.
      }
    },
  };
}
export function openSpan(
  name: SpanName,
  fields: SafeFields = {},
): ObservedSpan {
  try {
    return spanHandle(name, tracing.startSpan(name), fields);
  } catch {
    return spanHandle(name, undefined, fields);
  }
}
export async function observeSpan<T>(
  name: SpanName,
  operation: (span: ObservedSpan) => T | Promise<T>,
  fields: SafeFields = {},
): Promise<T> {
  const parent = observation.getStore();
  let entered = false;
  let operationResult: Result<T> | undefined;
  const run = async (native?: Span) => {
    entered = true;
    const span = spanHandle(name, native, fields);
    const invoke = () => operation(span);
    const { data, error } = await tryCatch(() =>
      parent
        ? observation.run({ ...parent, activeSpan: name }, invoke)
        : invoke(),
    );
    operationResult = error ? { data: null, error } : { data, error: null };
    if (error) {
      const failure = classifyFailure(error);
      span.end({ failure });
      throw error;
    }
    const failure = parent?.primary.failure;
    span.end(failure ? { failure } : {});
    return data;
  };
  const { data, error } = await tryCatch(() => tracing.enterSpan(name, run));
  if (error) {
    if (!entered) {
      return run();
    }
    if (operationResult) {
      if (operationResult.error) {
        throw operationResult.error;
      }
      return operationResult.data;
    }
    throw error;
  }
  return data;
}
