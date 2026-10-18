import assert from "node:assert/strict";

import { test } from "vitest";
import { z } from "zod/v4";

import { createLogger } from "@/shared/logger";
import { requestDiagnostic } from "@/worker/http";

test("Worker logging filters polling and writes only safe structured HTTP metadata", () => {
  const lines: string[] = [];
  const logger = createLogger({
    name: "synthetic-worker",
    level: "warn",
    destination: { write: (line) => lines.push(line) },
  });
  const diagnostic = {
    correlation: "synthetic-correlation",
    route: "api",
    durationMs: 3,
    body: { token: "synthetic-secret", balance: "123.45" },
    url: "https://synthetic.example?token=synthetic-secret",
  };
  requestDiagnostic({ ...diagnostic, status: 200 }, logger);
  requestDiagnostic({ ...diagnostic, status: 503 }, logger);
  assert.equal(lines.length, 1);
  z.object({
    name: z.literal("synthetic-worker"),
    level: z.literal(50),
    time: z.number(),
    code: z.literal("REQUEST_FAILED"),
    status: z.literal(503),
    correlation: z.literal("synthetic-correlation"),
    route: z.literal("api"),
    durationMs: z.literal(3),
  })
    .strict()
    .parse(JSON.parse(lines.join("")));
});
