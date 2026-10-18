import { z } from "zod/v4";

import { Resource, Availability, Classification, ProvenanceOrigin } from "#domain/enums.ts";

export const ResourceSchema = z.enum(Resource);
export const AvailabilitySchema = z.enum(Availability);
export const ClassificationSchema = z.enum(Classification);
export const ProvenanceOriginSchema = z.enum(ProvenanceOrigin);
