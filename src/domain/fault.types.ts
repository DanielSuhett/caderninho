import type { FaultCode } from "#domain/enums.ts";

export interface ErrorDetails {
  retryAfterSeconds?: number;
  stage?: string;
  exception?: string;
  reason?: string;
  code?: FaultCode;
  operation?: string;
  previousSnapshotPreserved?: boolean;
  resumeToken?: string;
}
