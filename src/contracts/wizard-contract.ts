import { z } from "zod/v4";

export const WizardIssueSchema = z.enum([
  "credentials",
  "application",
  "rate",
  "unavailable",
  "item",
  "connector",
  "session",
  "unknown",
]);
export type WizardIssue = z.infer<typeof WizardIssueSchema>;
export const WizardStateSchema = z.object({
  credentials: z.boolean(),
  connected: z.boolean(),
  sync: z.enum(["waiting", "working", "completed", "error", "cancelled"]),
  coverage: z.object({ total: z.number(), complete: z.number() }),
  paused: z.boolean(),
});
export type WizardState = z.infer<typeof WizardStateSchema>;
