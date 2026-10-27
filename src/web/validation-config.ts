import { config } from "zod/v4/core";

// CSP forbids eval. The build keeps this module and Zod's config in a small
// chunk that loads before any chunk constructing schemas.
config({ jitless: true });
