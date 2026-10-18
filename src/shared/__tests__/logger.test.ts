import assert from "node:assert/strict";
import test from "node:test";

import { z } from "zod/v4";

import { createLogger } from "../logger";

test("logger filters by level and emits named JSON without process metadata", () => {
  const lines: string[] = [];
  const logger = createLogger({
    name: "synthetic",
    level: "info",
    destination: { write: (line) => lines.push(line) },
  });
  logger.debug({ code: "HIDDEN" });
  logger.info({ code: "VISIBLE" });
  assert.equal(lines.length, 1);
  const entry = z
    .object({
      level: z.literal(30),
      time: z.number(),
      name: z.literal("synthetic"),
      code: z.literal("VISIBLE"),
    })
    .strict()
    .parse(JSON.parse(lines.join("")));
  assert.ok(entry.time > 0);
});
