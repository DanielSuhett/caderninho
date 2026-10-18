import { z } from "zod/v4";

import type { Credentials } from "#domain/pluggy-credentials.types.ts";

export const PluggyCredentialsSchema = z
  .object({
    clientId: z.string().trim().min(1).max(256),
    clientSecret: z.string().min(1).max(1024),
  })
  .strict() satisfies z.ZodType<Credentials>;
