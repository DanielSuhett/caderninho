import { z } from "zod/v4";

const id = z.string().min(1).max(160);
const name = z.string().trim().min(1).max(80);
export const HouseholdCommandSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("save_person"),
      csrf: z.string(),
      id: id.optional(),
      name,
    })
    .strict(),
  z
    .object({
      action: z.literal("assign_connection"),
      connectionId: id,
      csrf: z.string(),
      personId: id,
    })
    .strict(),
  z
    .object({
      action: z.literal("save_profile"),
      clientId: z.string().trim().min(1).max(200).optional(),
      clientSecret: z.string().trim().min(1).max(512).optional(),
      csrf: z.string(),
      enabled: z.boolean().default(true),
      id: id.optional(),
      name,
      personId: id,
    })
    .strict()
    .refine(
      (v) => !!v.clientId === !!v.clientSecret,
      "Both credentials are required",
    ),
]);
export type HouseholdCommand = z.infer<typeof HouseholdCommandSchema>;
export const HouseholdCatalogSchema = z.object({
  people: z.array(z.object({ id, name })),
  profiles: z.array(
    z.object({
      configured: z.boolean(),
      connectionCount: z.number().int().nonnegative(),
      enabled: z.boolean(),
      id,
      name,
      personId: id,
    }),
  ),
});
