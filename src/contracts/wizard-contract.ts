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
export const CredentialsSchema = z
  .object({
    clientId: z.string().trim().min(1).max(256),
    clientSecret: z.string().min(1).max(1024),
  })
  .strict();
export const ConnectionSchema = CredentialsSchema.extend({
  itemId: z.string().uuid(),
});
export type Credentials = z.infer<typeof CredentialsSchema>;
export type Connection = z.infer<typeof ConnectionSchema>;
