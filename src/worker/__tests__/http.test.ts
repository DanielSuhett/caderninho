import assert from "node:assert/strict";
import test from "node:test";

import { z } from "zod/v4";

import { createLogger } from "@/shared/logger";

import { requestDiagnostic } from "../http";

const entrySchema = z
  .object({
    name: z.literal("synthetic-http"),
    level: z.number(),
    time: z.number(),
    code: z.string(),
    correlation: z.literal("synthetic-request"),
    route: z.literal("api"),
    status: z.number(),
    durationMs: z.literal(12),
  })
  .strict();

test("HTTP diagnostics classify status and omit private fields even in debug", () => {
  const lines: string[] = [];
  const logger = createLogger({
    name: "synthetic-http",
    level: "debug",
    destination: { write: (line) => lines.push(line) },
  });
  for (const status of [200, 302, 401, 403, 404, 429, 500, 503]) {
    const input = {
      correlation: "synthetic-request",
      route: "api",
      status,
      durationMs: 12,
      url: "https://synthetic.example/api?token=synthetic-secret",
      body: { balance: "123.45" },
      identity: "synthetic-user",
      exception: "synthetic-secret",
    };
    requestDiagnostic(input, logger);
  }
  const entries = lines.map((line) => entrySchema.parse(JSON.parse(line)));
  assert.deepEqual(
    entries.map(({ status, level, code }) => ({ status, level, code })),
    [
      { status: 200, level: 20, code: "REQUEST_COMPLETED" },
      { status: 302, level: 20, code: "REQUEST_COMPLETED" },
      { status: 401, level: 40, code: "REQUEST_REJECTED" },
      { status: 403, level: 40, code: "REQUEST_REJECTED" },
      { status: 404, level: 40, code: "REQUEST_REJECTED" },
      { status: 429, level: 40, code: "REQUEST_REJECTED" },
      { status: 500, level: 50, code: "REQUEST_FAILED" },
      { status: 503, level: 50, code: "REQUEST_FAILED" },
    ],
  );
});

test("warn threshold suppresses successful HTTP polling diagnostics", () => {
  const lines: string[] = [];
  const logger = createLogger({
    name: "synthetic-http",
    level: "warn",
    destination: { write: (line) => lines.push(line) },
  });
  for (const status of [200, 204, 302, 401, 500]) {
    requestDiagnostic(
      {
        correlation: "synthetic-request",
        route: "api",
        status,
        durationMs: 12,
      },
      logger,
    );
  }
  assert.deepEqual(
    lines.map((line) => entrySchema.parse(JSON.parse(line)).status),
    [401, 500],
  );
});
