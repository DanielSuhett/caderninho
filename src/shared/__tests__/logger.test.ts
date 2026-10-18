import assert from "node:assert/strict";
import test from "node:test";

import { z } from "zod/v4";

import { createLogger } from "../logger";

test("logger filters by level and emits named JSON without process metadata", () => {
  const lines: string[] = [];
  const logger = createLogger({
    destination: { write: (line) => lines.push(line) },
    level: "info",
    name: "synthetic",
  });
  logger.debug({ code: "HIDDEN" });
  logger.info({ code: "VISIBLE" });
  assert.equal(lines.length, 1);
  const entry = z
    .object({
      code: z.literal("VISIBLE"),
      level: z.literal(30),
      name: z.literal("synthetic"),
      time: z.number(),
    })
    .strict()
    .parse(JSON.parse(lines.join("")));
  assert.ok(entry.time > 0);
});
