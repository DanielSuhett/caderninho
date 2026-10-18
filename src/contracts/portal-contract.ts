import { z } from "zod/v4";

import { WizardStateSchema } from "#contracts/wizard-contract.ts";

export const PlaygroundStatusSchema = z.object({
  wizard: WizardStateSchema,
  installation: z.boolean(),
  authorized: z.number(),
  received: z.number(),
  clientsAvailable: z.boolean(),
  checkedAt: z.string(),
});
export type PlaygroundStatus = z.infer<typeof PlaygroundStatusSchema>;
export const PortalStatusSchema = z.object({
  config: z
    .object({
      enabled: z.number(),
      next_sync_at: z.string(),
      updated_at: z.string(),
    })
    .nullable(),
  latest: z
    .object({ status: z.string(), phase: z.string(), updated_at: z.string() })
    .nullable(),
  items: z.array(z.object({ id: z.string() })),
});
export const ClientAccessSchema = z.object({
  id: z.string(),
  clientId: z.string(),
  name: z.string(),
  createdAt: z.number(),
  receivedAt: z.string().nullable(),
});
export const PlaygroundStateSchema = z.object({
  status: PlaygroundStatusSchema,
  checks: z.object({
    owner: z.boolean(),
    origin: z.boolean(),
    github: z.boolean(),
    access: z.boolean(),
    vault: z.boolean(),
    database: z.boolean(),
    workflow: z.boolean(),
    oauth: z.boolean(),
    migrations: z.boolean(),
  }),
  clients: z.array(ClientAccessSchema),
  cursor: z.string().optional(),
});
export type PlaygroundState = z.infer<typeof PlaygroundStateSchema>;
export const AccountResponseSchema = z.object({
  data: PlaygroundStateSchema,
  account: PortalStatusSchema,
  csrf: z.string(),
  origin: z.string(),
  rotate: z.boolean(),
});
export type AccountResponse = z.infer<typeof AccountResponseSchema>;
export const AccountActionSchema = z.object({
  csrf: z.string().min(1),
  fields: z.record(z.string(), z.string()).default({}),
});
