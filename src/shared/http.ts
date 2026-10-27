import ky, { isNetworkError, isResponseSizeError, isTimeoutError } from "ky";

import {
  type FetchJsonRequest,
  type HttpFailure,
  HttpFailureKind,
  type HttpResponseMetadata,
  type JsonRequest,
  type RetryDelayInput,
} from "./http.types";
import { tryCatch, tryCatchSync } from "./result";

const digitsPattern = /^\d+$/;

const maximumRetryAfterSeconds = 86_400;

export const rateLimitRetry = {
  delay({ attempt, retryAfterSeconds }: RetryDelayInput) {
    return Math.max(
      1,
      Math.min(
        maximumRetryAfterSeconds,
        retryAfterSeconds ?? 10 * 2 ** attempt,
      ),
    );
  },
};

export class HttpRequestError extends Error {
  readonly failure: HttpFailure;

  constructor(failure: HttpFailure) {
    super("HTTP request failed");
    this.failure = failure;
  }
}

const statusFailures = new Map<number, HttpFailureKind>([
  [401, HttpFailureKind.unauthorized],
  [403, HttpFailureKind.forbidden],
  [404, HttpFailureKind.notFound],
  [429, HttpFailureKind.rateLimit],
]);

export function httpResponseFailure({
  status,
  type,
  retryAfter,
}: HttpResponseMetadata): HttpFailure | undefined {
  let kind = statusFailures.get(status);
  if (type === "opaqueredirect" || (status >= 300 && status < 400)) {
    kind = HttpFailureKind.redirect;
  }
  if (status >= 200 && status < 300 && kind !== HttpFailureKind.redirect) {
    return undefined;
  }
  if (!kind) {
    kind = HttpFailureKind.network;
    if (status >= 500) {
      kind = HttpFailureKind.server;
    } else if (status >= 400) {
      kind = HttpFailureKind.invalidRequest;
    }
  }
  const retryAfterSeconds = parseRetryAfter(retryAfter);
  return {
    kind,
    status,
    ...(retryAfter !== null && retryAfter !== undefined && { retryAfter }),
    ...(retryAfterSeconds !== undefined && { retryAfterSeconds }),
  };
}

function parseRetryAfter(value: string | null | undefined) {
  if (!value) {
    return;
  }
  const seconds = digitsPattern.test(value)
    ? Number(value)
    : Math.ceil((Date.parse(value) - Date.now()) / 1000);
  if (!Number.isFinite(seconds)) {
    return;
  }
  return Math.max(0, Math.min(seconds, maximumRetryAfterSeconds));
}

// A lost response does not prove that a mutation was rejected.
// Pure: browser bundles that only use fetchJson must not keep ky.
export const httpClient = /* @__PURE__ */ ky.create({
  headers: { Accept: "application/json" },
  redirect: "manual",
  retry: 0,
  throwHttpErrors: false,
  timeout: false,
});

export async function requestJson<T>({
  client,
  input,
  options,
}: JsonRequest): Promise<T> {
  const { data, error } = await tryCatch(async () => {
    const pending = client(input, options);
    const response = await pending;
    const failure = httpResponseFailure({
      retryAfter: response.headers.get("Retry-After"),
      status: response.status,
      type: response.type,
    });
    if (failure) {
      cancelResponse(response);
      throw new HttpRequestError(failure);
    }
    const maximum = options?.maxResponseSize;
    if (
      maximum !== null &&
      maximum !== undefined &&
      Number(response.headers.get("Content-Length")) > maximum
    ) {
      cancelResponse(response);
      throw new HttpRequestError({ kind: HttpFailureKind.tooLarge });
    }
    return pending.json<T>();
  });
  if (error) {
    throw transportFailure(error);
  }
  return data;
}

// Browser reads of this installation's own API: plain fetch, same failure model.
// Streaming size limits and lossless parsing stay with ky on the Worker.
export async function fetchJson<T>({
  fetcher = fetch,
  input,
  init,
  inspect,
  maxResponseSize,
  timeoutMs,
}: FetchJsonRequest): Promise<T> {
  const timeout = AbortSignal.timeout(timeoutMs);
  const { body, signal, ...rest } = init;
  // Fetchers receive a Request, like ky's, so demo and test doubles read it whole.
  const { data: response, error } = await tryCatch(() =>
    fetcher(
      new Request(input, {
        ...rest,
        headers: {
          Accept: "application/json",
          ...(body !== undefined && { "Content-Type": "application/json" }),
        },
        redirect: "manual",
        signal: AbortSignal.any([signal, timeout]),
        ...(body !== undefined && { body: JSON.stringify(body) }),
      }),
    ),
  );
  if (error) {
    throw fetchFailure(error, timeout);
  }
  inspect?.(response);
  const failure = httpResponseFailure({
    retryAfter: response.headers.get("Retry-After"),
    status: response.status,
    type: response.type,
  });
  if (failure) {
    cancelResponse(response);
    throw new HttpRequestError(failure);
  }
  if (Number(response.headers.get("Content-Length")) > maxResponseSize) {
    cancelResponse(response);
    throw new HttpRequestError({ kind: HttpFailureKind.tooLarge });
  }
  const { data: text, error: readError } = await tryCatch(() =>
    response.text(),
  );
  if (readError) {
    throw fetchFailure(readError, timeout);
  }
  const { data, error: parseError } = tryCatchSync(() => JSON.parse(text));
  if (parseError) {
    throw fetchFailure(parseError, timeout);
  }
  return data;
}

function fetchFailure(error: Error, timeout: AbortSignal): Error {
  if (timeout.aborted) {
    return new HttpRequestError({ kind: HttpFailureKind.timeout });
  }
  if (error instanceof SyntaxError) {
    return new HttpRequestError({ kind: HttpFailureKind.invalidResponse });
  }
  if (error instanceof TypeError) {
    return new HttpRequestError({ kind: HttpFailureKind.network });
  }
  return error;
}

function transportFailure(error: Error): Error {
  if (isTimeoutError(error)) {
    return new HttpRequestError({ kind: HttpFailureKind.timeout });
  }
  if (isResponseSizeError(error)) {
    return new HttpRequestError({ kind: HttpFailureKind.tooLarge });
  }
  if (isNetworkError(error)) {
    return new HttpRequestError({ kind: HttpFailureKind.network });
  }
  if (error instanceof SyntaxError) {
    return new HttpRequestError({ kind: HttpFailureKind.invalidResponse });
  }
  return error;
}

// Discard unread bodies best effort without replacing the HTTP failure or waiting
// indefinitely for a remote stream to acknowledge cancellation.
function cancelResponse(response: Response) {
  tryCatch(() => response.body?.cancel()).then(
    ({ data, error }) => (error ? undefined : data),
    () => undefined,
  );
}
