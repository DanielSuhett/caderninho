import assert from "node:assert/strict";
import test from "node:test";

import { z } from "zod/v4";

import { createLogger } from "@/shared/logger";

import { requestDiagnostic } from "../http";

const entrySchema = z
  .object({
    code: z.string(),
    correlation: z.literal("synthetic-request"),
    durationMs: z.literal(12),
    level: z.number(),
    name: z.literal("synthetic-http"),
    route: z.literal("api"),
    status: z.number(),
    time: z.number(),
  })
  .strict();

test("HTTP diagnostics classify status and omit private fields even in debug", () => {
  const lines: string[] = [];
  const logger = createLogger({
    destination: { write: (line) => lines.push(line) },
    level: "debug",
    name: "synthetic-http",
  });
  for (const status of [200, 302, 401, 403, 404, 429, 500, 503]) {
    const input = {
      body: { balance: "123.45" },
      correlation: "synthetic-request",
      durationMs: 12,
      exception: "synthetic-secret",
      identity: "synthetic-user",
      route: "api",
      status,
      url: "https://synthetic.example/api?token=synthetic-secret",
    };
    requestDiagnostic(input, logger);
  }
  const entries = lines.map((line) => entrySchema.parse(JSON.parse(line)));
  assert.deepEqual(
    entries.map(({ status, level, code }) => ({ code, level, status })),
    [
      { code: "REQUEST_COMPLETED", level: 20, status: 200 },
      { code: "REQUEST_COMPLETED", level: 20, status: 302 },
      { code: "REQUEST_REJECTED", level: 40, status: 401 },
      { code: "REQUEST_REJECTED", level: 40, status: 403 },
      { code: "REQUEST_REJECTED", level: 40, status: 404 },
      { code: "REQUEST_REJECTED", level: 40, status: 429 },
      { code: "REQUEST_FAILED", level: 50, status: 500 },
      { code: "REQUEST_FAILED", level: 50, status: 503 },
    ],
  );
});

test("warn threshold suppresses successful HTTP polling diagnostics", () => {
  const lines: string[] = [];
  const logger = createLogger({
    destination: { write: (line) => lines.push(line) },
    level: "warn",
    name: "synthetic-http",
  });
  for (const status of [200, 204, 302, 401, 500]) {
    requestDiagnostic(
      {
        correlation: "synthetic-request",
        durationMs: 12,
        route: "api",
        status,
      },
      logger,
    );
  }
  assert.deepEqual(
    lines.map((line) => entrySchema.parse(JSON.parse(line)).status),
    [401, 500],
  );
});
