import { z } from "zod/v4";

import {
  WizardIssue,
  type WizardState,
  WizardSyncState,
} from "#contracts/wizard.types.ts";

export const WizardIssueSchema = z.enum(WizardIssue);
export const WizardStateSchema = z.object({
  credentials: z.boolean(),
  connected: z.boolean(),
  sync: z.enum(WizardSyncState),
  coverage: z.object({ total: z.number(), complete: z.number() }),
  paused: z.boolean(),
}) satisfies z.ZodType<WizardState>;
