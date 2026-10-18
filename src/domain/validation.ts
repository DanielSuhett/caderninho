import type { z } from "zod/v4";

import { FaultCode, type FaultCode as FaultCodeType } from "#domain/enums.ts";
import { Fault } from "#domain/fault.ts";

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
