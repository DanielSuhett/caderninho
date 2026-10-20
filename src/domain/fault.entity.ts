import type { FaultCode } from "./enums";

export class Fault extends Error {
  readonly code: FaultCode;
  details?: { retryAfterSeconds?: number };

  constructor(code: FaultCode) {
    super(code);
    this.code = code;
  }
}

export function fail(code: FaultCode): never {
  throw new Fault(code);
}
