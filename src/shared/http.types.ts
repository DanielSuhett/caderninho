import type {
  Input,
  KyInstance,
  Options,
  ResponsePromise,
  StandardSchemaV1,
} from "ky";

export const HttpFailureKind = {
  forbidden: "forbidden",
  invalidRequest: "invalid_request",
  invalidResponse: "invalid_response",
  network: "network",
  notFound: "not_found",
  rateLimit: "rate_limit",
  redirect: "redirect",
  server: "server",
  timeout: "timeout",
  tooLarge: "too_large",
  unauthorized: "unauthorized",
} as const;
export type HttpFailureKind =
  (typeof HttpFailureKind)[keyof typeof HttpFailureKind];

export interface HttpFailure {
  kind: HttpFailureKind;
  retryAfter?: string;
  retryAfterSeconds?: number;
  status?: number;
}

export interface HttpResponseMetadata {
  retryAfter?: string | null;
  status: number;
  type?: ResponseType;
}

export interface HttpFailureContext {
  failure: HttpFailure;
  request: ResponsePromise;
}

export interface JsonRequest<T> {
  client: KyInstance;
  input: Input;
  onHttpFailure?: (context: HttpFailureContext) => Error | Promise<Error>;
  options?: Options;
  schema?: StandardSchemaV1<unknown, T>;
}

export interface RetryDelayInput {
  attempt: number;
  retryAfterSeconds?: number;
}
