import { z } from "zod/v4";

import { WizardIssue, type WizardState, WizardSyncState } from "../domain";

export const WizardIssueSchema = z.enum(WizardIssue);
export const WizardStateSchema = z.object({
  connected: z.boolean(),
  coverage: z.object({ complete: z.number(), total: z.number() }),
  credentials: z.boolean(),
  paused: z.boolean(),
  sync: z.enum(WizardSyncState),
}) satisfies z.ZodType<WizardState>;
