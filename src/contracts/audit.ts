import { z } from "zod/v4";

export const AuditSelectionSchema = z
  .object({
    days: z.coerce
      .number()
      .pipe(z.union([z.literal(1), z.literal(7), z.literal(30)]))
      .default(7),
    grantCursor: z.string().max(4096).optional(),
  })
  .strict();
export const RevokeGrantSchema = z
  .object({ csrf: z.string(), grantId: z.string().min(1).max(1024) })
  .strict();
export const AuditOutcome = {
  cancelled: "cancelled",
  failed: "failed",
  success: "success",
} as const;
export const AuditModelSchema = z
  .string()
  .max(100)
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9._:/-]*$/);
const count = z.number().int().nonnegative();
const counters = z.object({
  cancelled: count,
  durationMs: count,
  errors: count,
  inputBytes: count,
  outputBytes: count,
  requests: count,
  toolCalls: count,
});
export const AuditReportSchema = z.object({
  clients: z.array(
    counters.extend({ clientId: z.string().nullable(), lastSeen: z.string() }),
  ),
  daily: z.array(counters.extend({ day: z.string() })),
  days: count,
  grantCursor: z.string().nullable(),
  grants: z.array(
    z.object({
      clientId: z.string(),
      clientName: z.string(),
      createdAt: count,
      expiresAt: count.nullable(),
      id: z.string(),
      scope: z.array(z.string()),
    }),
  ),
  models: z.array(counters.extend({ model: z.string().nullable() })),
  recent: z.array(
    z.object({
      clientId: z.string().nullable(),
      durationMs: count,
      id: z.string(),
      inputBytes: count,
      model: z.string().nullable(),
      outcome: z.enum(AuditOutcome),
      outputBytes: count,
      startedAt: z.string(),
      status: count,
      tool: z.string().nullable(),
    }),
  ),
  since: z.string(),
  totals: counters,
});
export type AuditReport = z.infer<typeof AuditReportSchema>;
