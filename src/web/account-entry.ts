import { z } from "zod/v4";
// Initialize CSP-safe validation before constructing any application schemas.
z.config({ jitless: true });
void import("#web/account.tsx");
