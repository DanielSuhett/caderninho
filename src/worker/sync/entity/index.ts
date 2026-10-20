import type {
  AccountProjection,
  Checkpoint,
  CommitResult,
  FinancialSource,
  RunStatus,
  TransactionProjection,
} from "../../../domain";
import { Fault, FaultCode } from "../../../domain";
export interface SyncRun {
  admittedAt: string;
  checkpoint: Checkpoint;
  connectionId: string;
  id: string;
  sequence: number;
  status: RunStatus;
}
export interface Admission {
  connectionId: string;
  importId: string | null;
  nextEligibleAt: string | null;
  status: "started" | "working" | "cooldown";
}
export interface Publication {
  accounts?: AccountProjection[];
  completeAccountId?: string;
  done: boolean;
  next: Checkpoint;
  now: string;
  run: SyncRun;
  transactions?: TransactionProjection[];
}
export interface SyncRepository {
  account: (connectionId: string, id: string) => Promise<AccountProjection>;
  active: () => Promise<SyncRun[]>;
  admit: (ids: string[] | undefined, now: string) => Promise<Admission[]>;
  fail: (id: string, code: string) => Promise<void>;
  nextAccount: (run: SyncRun, after: string) => Promise<string | null>;
  publish: (input: Publication) => Promise<CommitResult>;
  read: (id: string) => Promise<SyncRun>;
  start: (id: string) => Promise<void>;
}
export interface Steps {
  do: (name: string, fn: () => Promise<CommitResult>) => Promise<CommitResult>;
}
export interface ImportDependencies {
  now: () => string;
  repository: SyncRepository;
  source: FinancialSource;
  steps: Steps;
}
export interface WorkflowPort {
  create: (id: string) => Promise<void>;
  status: (id: string) => Promise<string>;
}

const importErrors = new Set<string>([
  ...Object.values(FaultCode),
  "SOURCE_IDENTITY_MISMATCH",
  "DUPLICATE_CHANGED",
  "REPEATED_CURSOR",
  "STALE_COMMIT",
  "INVALID_CHECKPOINT",
  "NOT_CONFIGURED",
]);
export function importFailure(error: Error) {
  if (error instanceof Fault) {
    return error.code;
  }
  if (
    ["INCOMPLETE_PAGE", "INVALID_PAGINATION", "CURSOR_SCOPE_MISMATCH"].includes(
      error.message,
    )
  ) {
    return FaultCode.INVALID_RESPONSE;
  }
  return importErrors.has(error.message) ? error.message : "IMPORT_FAILED";
}
