import { z } from "zod/v4";

// Private portal filters; the public MCP command schemas remain unchanged.
export const identityFilterFields = {
  cardBrand: z.string().min(1).max(160).optional(),
  institutionId: z.string().min(1).max(160).optional(),
};
