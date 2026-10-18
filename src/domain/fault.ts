import { z } from "zod/v4";

import {
  FaultCode,
  FaultCodeSchema,
  type FaultCode as FaultCodeType,
} from "#domain/enums.ts";

export const ErrorDetailsSchema = z.object({
  retryAfterSeconds: z.number().optional(),
  stage: z.string().optional(),
  exception: z.string().optional(),
  reason: z.string().optional(),
  code: FaultCodeSchema.optional(),
  operation: z.string().optional(),
  previousSnapshotPreserved: z.boolean().optional(),
  resumeToken: z.string().optional(),
});

export type ErrorDetails = z.infer<typeof ErrorDetailsSchema>;

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

export function parseDomain<T extends z.ZodType>(
  schema: T,
  value: unknown,
  code: FaultCodeType = FaultCode.INVALID_ARGUMENT,
): z.output<T> {
  const parsed = schema.safeParse(value);

  if (!parsed.success) {
    throw new Fault(code);
  }

  return parsed.data;
}
