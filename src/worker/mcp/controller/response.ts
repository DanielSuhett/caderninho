import { tryCatch } from "../../../shared";
import {
  captureObservation,
  classifyFailure,
  DiagnosticEvent,
  Outcome,
  openSpan,
  Recovery,
  reportDiagnostic,
  type SafeFields,
  SpanName,
} from "../../observability";

export function streamMcpResponse(input: {
  response: Response;
  action: NonNullable<SafeFields["action"]>;
  signal: AbortSignal;
  close: () => Promise<void>;
  keepAlive?: (lifetime: Promise<void>) => void;
}) {
  const { response, signal } = input;
  if (!response.body) {
    return response;
  }
  const reader = response.body.getReader();
  const inStream = captureObservation();
  const span = openSpan(SpanName.mcpStream, { action: input.action });
  let closing: Promise<void> | undefined;
  let clientClosed = false;
  let failureReported = false;
  let streamController: ReadableStreamDefaultController<Uint8Array> | undefined;
  function fail(error: Error) {
    if (failureReported) {
      return;
    }
    failureReported = true;
    inStream(() => {
      const failure = classifyFailure(error);
      span.end({ failure, outcome: Outcome.failed });
      reportDiagnostic({
        action: input.action,
        additional: true,
        event: DiagnosticEvent.stream,
        failure,
        outcome: Outcome.failed,
        phase: SpanName.mcpStream,
        recovery: Recovery.none,
      });
    });
  }
  function dispose(outcome: Outcome) {
    if (closing !== undefined) {
      return closing;
    }
    closing = inStream(async () => {
      signal.removeEventListener("abort", abort);
      // Teardown is best effort: cancellation must release both resources, and
      // cleanup failures must never replace an earlier body failure.
      const { data: _cancelled, error: cancelError } = await tryCatch(() =>
        reader.cancel(),
      );
      const { data: _closed, error: closeError } = await tryCatch(input.close);
      try {
        reader.releaseLock();
      } catch {
        // A concurrent pending read may already have released the reader.
      }
      const error = cancelError ?? closeError;
      if (error && outcome !== Outcome.cancelled) {
        fail(error);
        return;
      }
      span.end({ outcome });
    });
    return closing;
  }
  function abort() {
    clientClosed = true;
    span.end({ outcome: Outcome.cancelled });
    try {
      streamController?.close();
    } catch {
      // Aborting an already closed body is a normal disconnect.
    }
    // dispose catches each asynchronous teardown failure above.
    const cleanup = dispose(Outcome.cancelled);
    input.keepAlive?.(cleanup);
  }
  const stream = new ReadableStream<Uint8Array>({
    async cancel() {
      clientClosed = true;
      await dispose(Outcome.cancelled);
    },
    async pull(controller) {
      const { data: chunk, error } = await tryCatch(() => reader.read());
      if (clientClosed) {
        return;
      }
      if (error) {
        fail(error);
        await dispose(Outcome.failed);
        controller.error(error);
        return;
      }
      if (chunk.done) {
        await dispose(Outcome.success);
        if (!clientClosed) {
          controller.close();
        }
        return;
      }
      controller.enqueue(chunk.value);
    },
    start(controller) {
      streamController = controller;
    },
  });
  signal.addEventListener("abort", abort, { once: true });
  if (signal.aborted) {
    abort();
  }
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "no-store");
  return new Response(stream, { headers, status: response.status });
}
