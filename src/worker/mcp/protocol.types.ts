import type { OperationStatus } from "@/contracts/operation.types";
import type { JsonValue } from "@/shared/json.types";

interface TaskState {
  taskId: string;
  createdAt: string;
  lastUpdatedAt: string;
  ttlMs: number | null;
  pollIntervalMs?: number;
  statusMessage?: string;
}

export type Task = TaskState &
  (
    | { status: typeof OperationStatus.working }
    | { status: typeof OperationStatus.cancelled }
    | {
        status: typeof OperationStatus.completed;
        result: Record<string, JsonValue>;
      }
    | {
        status: typeof OperationStatus.failed;
        error: Record<string, JsonValue>;
      }
  );

export interface Envelope {
  jsonrpc: "2.0";
  id?: string | number | undefined;
  method: string;
  params?: Record<string, JsonValue> | undefined;
}
