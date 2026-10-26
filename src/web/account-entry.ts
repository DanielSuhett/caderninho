import { z } from "zod/v4";

// Initialize CSP-safe validation before constructing any application schemas.
z.config({ jitless: true });
const { mountAccount } = await import("./mount-account");
mountAccount();
