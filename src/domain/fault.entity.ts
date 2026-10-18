import type { FaultCode } from "./enums";

export interface ErrorDetails {
  code?: FaultCode;
  exception?: string;
  operation?: string;
  previousSnapshotPreserved?: boolean;
  reason?: string;
  resumeToken?: string;
  retryAfterSeconds?: number;
  stage?: string;
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
