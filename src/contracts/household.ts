import { z } from "zod/v4";

const id = z.string().min(1).max(160);
const name = z.string().trim().min(1).max(80);
// Only bounded raster data can be stored; no third-party image requests or SVG.
export const PersonPhotoSchema = z
  .string()
  .max(24_576)
  .regex(
    /^data:image\/(jpeg|png|webp);base64,(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/,
  )
  .pipe(
    z.string().refine((value) => {
      const bytes = atob(value.slice(value.indexOf(",") + 1));
      if (value.startsWith("data:image/jpeg;")) {
        return bytes.startsWith("\xff\xd8\xff");
      }
      if (value.startsWith("data:image/png;")) {
        return bytes.startsWith("\x89PNG\r\n\x1a\n");
      }
      return bytes.startsWith("RIFF") && bytes.slice(8, 12) === "WEBP";
    }, "Selecione uma foto JPEG, PNG ou WebP válida."),
  );
export const HouseholdCommandSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("create_profile"),
      clientId: z.string().trim().min(1).max(200),
      clientSecret: z.string().trim().min(1).max(512),
      csrf: z.string(),
      name,
      person: z.union([z.object({ id }).strict(), z.object({ name }).strict()]),
    })
    .strict(),
  z
    .object({
      action: z.literal("save_person"),
      csrf: z.string(),
      id: id.optional(),
      name,
      photo: PersonPhotoSchema.nullable().optional(),
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
export const HouseholdResultSchema = z.union([
  z.object({ id, personId: id.optional() }),
  z.object({ ok: z.literal(true) }),
]);
export const HouseholdCatalogSchema = z.object({
  people: z.array(z.object({ id, name, photo: z.string().nullish() })),
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
