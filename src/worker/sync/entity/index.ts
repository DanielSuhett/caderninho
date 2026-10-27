import {
  type AccountMap,
  type AccountProjection,
  type Checkpoint,
  type CommitResult,
  Fault,
  FaultCode,
  type FinancialSource,
  type ProductPage,
  type RunStatus,
  type TransactionProjection,
} from "../../../domain";

export interface SyncRun {
  admittedAt: string;
  checkpoint: Checkpoint;
  connectionId: string;
  id: string;
  sequence: number;
  status: RunStatus;
}
export const AdmissionStatus = {
  cooldown: "cooldown",
  paused: "paused",
  started: "started",
  working: "working",
} as const;
export type AdmissionStatus =
  (typeof AdmissionStatus)[keyof typeof AdmissionStatus];
export interface Admission {
  connectionId: string;
  importId: string | null;
  nextEligibleAt: string | null;
  status: AdmissionStatus;
}
export interface Publication {
  accounts?: AccountProjection[];
  done: boolean;
  error?: string;
  next: Checkpoint;
  now: string;
  products?: ProductPage;
  run: SyncRun;
  transactions?: TransactionProjection[];
}
export interface SyncRepository {
  active: () => Promise<SyncRun[]>;
  admit: (
    ids: string[] | undefined,
    now: string,
    initialOnly?: boolean,
  ) => Promise<Admission[]>;
  connectionAccounts: (connectionId: string) => Promise<AccountMap>;
  fail: (id: string, code: string) => Promise<void>;
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
  "SOURCE_ACCOUNTS_CHANGED",
  "DUPLICATE_CHANGED",
  "REPEATED_CURSOR",
  "STALE_COMMIT",
  "INVALID_CHECKPOINT",
  "NOT_CONFIGURED",
  "PROFILE_DISABLED",
  "APPLICATION_CHANGE_REQUIRES_NEW_PROFILE",
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

export interface SyncServiceDependencies {
  assertConfigured: (connectionIds?: string[]) => Promise<void>;
  now?: () => Date;
  report?: (counts: {
    dispatchPending: number;
    statusUnavailable: number;
    failed: number;
  }) => void;
  repository: SyncRepository;
  workflow: WorkflowPort;
}
