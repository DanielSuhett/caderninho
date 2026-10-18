import assert from "node:assert/strict";

import { test } from "vitest";
import { z } from "zod/v4";

import { createLogger } from "@/shared/logger";
import { requestDiagnostic } from "@/worker/http";

test("Worker logging filters polling and writes only safe structured HTTP metadata", () => {
  const lines: string[] = [];
  const logger = createLogger({
    destination: { write: (line) => lines.push(line) },
    level: "warn",
    name: "synthetic-worker",
  });
  const diagnostic = {
    body: { balance: "123.45", token: "synthetic-secret" },
    correlation: "synthetic-correlation",
    durationMs: 3,
    route: "api",
    url: "https://synthetic.example?token=synthetic-secret",
  };
  requestDiagnostic({ ...diagnostic, status: 200 }, logger);
  requestDiagnostic({ ...diagnostic, status: 503 }, logger);
  assert.equal(lines.length, 1);
  z.object({
    code: z.literal("REQUEST_FAILED"),
    correlation: z.literal("synthetic-correlation"),
    durationMs: z.literal(3),
    level: z.literal(50),
    name: z.literal("synthetic-worker"),
    route: z.literal("api"),
    status: z.literal(503),
    time: z.number(),
  })
    .strict()
    .parse(JSON.parse(lines.join("")));
});
