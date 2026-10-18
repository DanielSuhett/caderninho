import type { OperationStatus } from "@/contracts/operation.types";
import type { JsonValue } from "@/shared/json.types";

interface TaskState {
  createdAt: string;
  lastUpdatedAt: string;
  pollIntervalMs?: number;
  statusMessage?: string;
  taskId: string;
  ttlMs: number | null;
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
  id?: string | number | undefined;
  jsonrpc: "2.0";
  method: string;
  params?: Record<string, JsonValue> | undefined;
}
