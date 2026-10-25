import assert from "node:assert/strict";

import { test } from "vitest";

import { createLogger } from "../../src/shared/logger";
import { streamMcpResponse } from "../../src/worker/mcp/controller/response";
import {
  DiagnosticEvent,
  markFailure,
  Outcome,
  observeSpan,
  reportDiagnostic,
  SpanName,
  withObservation,
} from "../../src/worker/observability";

test("concurrent observations isolate failures/correlation and omit arbitrary exception text", async () => {
  const lines: string[] = [];
  const output = createLogger({
    destination: { write: (line) => lines.push(line) },
    level: "debug",
    name: "synthetic",
  });
  await Promise.all(
    ["failed", "successful"].map((correlation) =>
      withObservation({ correlation, output }, () =>
        observeSpan(SpanName.httpRequest, async () => {
          await Promise.resolve();
          if (correlation === "failed") {
            markFailure(new Error("private-body-and-secret"));
          }
          return reportDiagnostic({ event: DiagnosticEvent.http, status: 200 });
        }),
      ),
    ),
  );
  assert.equal(lines.length, 2);
  const failure = lines.find((line) => line.includes('"correlation":"failed"'));
  const success = lines.find((line) =>
    line.includes('"correlation":"successful"'),
  );
  assert.ok(failure?.includes('"outcome":"failed"'));
  assert.ok(success?.includes('"outcome":"success"'));
  assert.equal(lines.join("").includes("private-body-and-secret"), false);
});

test("planning rejections use a safe request diagnosis rather than an internal failure", () => {
  const lines: string[] = [];
  const output = createLogger({
    destination: { write: (line) => lines.push(line) },
    level: "debug",
    name: "planning",
  });
  withObservation({ output }, () => {
    markFailure(new Error("INVALID_PERIOD"));
    reportDiagnostic({ event: DiagnosticEvent.http, status: 400 });
  });
  assert.equal(lines.length, 1);
  assert.ok(lines[0]?.includes('"failure":"INVALID_REQUEST"'));
  assert.ok(lines[0]?.includes('"outcome":"rejected"'));
});
test("stream errors after headers retain captured context, report once and close both resources", async () => {
  const lines: string[] = [];
  let closed = 0;
  const output = createLogger({
    destination: { write: (line) => lines.push(line) },
    level: "debug",
    name: "stream",
  });
  const original = new Error("private-stream-error");
  const response = withObservation({ correlation: "stream-id", output }, () =>
    streamMcpResponse({
      action: "read",
      close: () => {
        closed += 1;
        return Promise.resolve();
      },
      response: new Response(
        new ReadableStream<Uint8Array>({
          pull(controller) {
            controller.error(original);
          },
        }),
      ),
      signal: new AbortController().signal,
    }),
  );
  await assert.rejects(response.text(), (error) => error === original);
  assert.equal(closed, 1);
  assert.equal(lines.filter((line) => line.includes("MCP_STREAM")).length, 1);
  assert.ok(lines[0]?.includes("stream-id"));
  assert.equal(lines.join("").includes("private-stream-error"), false);
});
test("failing telemetry observers cannot repeat or replace application work", async () => {
  let calls = 0;
  const result = await withObservation(
    {
      onSpan: () => {
        throw new Error("Synthetic observer unavailable");
      },
      output: {
        debug() {
          throw new Error("Synthetic logger unavailable");
        },
        error() {
          throw new Error("Synthetic logger unavailable");
        },
        warn() {
          throw new Error("Synthetic logger unavailable");
        },
      },
    },
    () =>
      observeSpan(SpanName.financeAction, () => {
        calls += 1;
        reportDiagnostic({
          event: DiagnosticEvent.mcp,
          outcome: Outcome.success,
        });
        return "confirmed";
      }),
  );
  assert.equal(result, "confirmed");
  assert.equal(calls, 1);
});
