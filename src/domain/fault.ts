import type { FaultCode } from "#domain/enums.ts";
import type { ErrorDetails } from "#domain/fault.types.ts";

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
