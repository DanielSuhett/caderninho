import { z } from "zod/v4";

import {
  Availability,
  Classification,
  ProvenanceOrigin,
  Resource,
} from "./enums";

export const ResourceSchema = z.enum(Resource);
export const AvailabilitySchema = z.enum(Availability);
export const ClassificationSchema = z.enum(Classification);
export const ProvenanceOriginSchema = z.enum(ProvenanceOrigin);
