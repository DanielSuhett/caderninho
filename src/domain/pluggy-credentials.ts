import { z } from "zod/v4";

export const PluggyCredentialsSchema = z
  .object({
    clientId: z.string().trim().min(1).max(256),
    clientSecret: z.string().min(1).max(1024),
  })
  .strict();

export type Credentials = z.infer<typeof PluggyCredentialsSchema>;
