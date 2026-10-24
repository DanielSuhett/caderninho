import { z } from "zod/v4";

z.config({ jitless: true });
await import("./demo-view");
