import ky, {
  isNetworkError,
  isResponseSizeError,
  isTimeoutError,
  SchemaValidationError,
} from "ky";

import {
  type HttpFailure,
  HttpFailureKind,
  type HttpResponseMetadata,
  type JsonRequest,
  type RetryDelayInput,
} from "./http.types";
import { tryCatch } from "./result";

const maximumRetryAfterSeconds = 86400;

export const rateLimitRetry = {
  attempts: 7,
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
    ...(retryAfter != null && { retryAfter }),
    ...(retryAfterSeconds !== undefined && { retryAfterSeconds }),
  };
}

function parseRetryAfter(value: string | null | undefined) {
  if (!value) {
    return undefined;
  }
  const seconds = /^\d+$/.test(value)
    ? Number(value)
    : Math.ceil((Date.parse(value) - Date.now()) / 1000);
  if (!Number.isFinite(seconds)) {
    return undefined;
  }
  return Math.max(0, Math.min(seconds, maximumRetryAfterSeconds));
}

// A lost response does not prove that a mutation was rejected.
export const httpClient = ky.create({
  headers: { Accept: "application/json" },
  retry: 0,
  redirect: "manual",
  throwHttpErrors: false,
  timeout: false,
});

export async function requestJson<T>({
  client,
  input,
  options,
  schema,
  onHttpFailure,
}: JsonRequest<T>): Promise<T> {
  const { data, error } = await tryCatch(async () => {
    const pending = client(input, options);
    const response = await pending;
    const failure = httpResponseFailure({
      status: response.status,
      type: response.type,
      retryAfter: response.headers.get("Retry-After"),
    });
    if (failure) {
      try {
        const translated = onHttpFailure
          ? await onHttpFailure({ failure, request: pending })
          : new HttpRequestError(failure);
        throw translated;
      } finally {
        void cancelResponse(response);
      }
    }
    if (
      options?.maxResponseSize != null &&
      Number(response.headers.get("Content-Length")) > options.maxResponseSize
    ) {
      void cancelResponse(response);
      throw new HttpRequestError({ kind: HttpFailureKind.tooLarge });
    }
    return schema ? pending.json(schema) : pending.json<T>();
  });
  if (error) {
    throw transportFailure(error);
  }
  return data;
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
  if (error instanceof SyntaxError || error instanceof SchemaValidationError) {
    return new HttpRequestError({ kind: HttpFailureKind.invalidResponse });
  }
  return error;
}

// Discard unread bodies best effort without replacing the HTTP failure or waiting
// indefinitely for a remote stream to acknowledge cancellation.
async function cancelResponse(response: Response) {
  const { data, error } = await tryCatch(() => response.body?.cancel());
  return error ? undefined : data;
}
