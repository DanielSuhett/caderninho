import type { FaultCode } from "./enums";

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

export class Fault extends Error {
  readonly code: FaultCode;
  details?: ErrorDetails;

  constructor(code: FaultCode) {
    super(code);
    this.code = code;
  }
}

export function fail(code: FaultCode): never {
  throw new Fault(code);
}
