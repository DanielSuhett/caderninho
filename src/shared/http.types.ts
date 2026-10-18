import type {
  Input,
  KyInstance,
  Options,
  ResponsePromise,
  StandardSchemaV1,
} from "ky";

export const HttpFailureKind = {
  unauthorized: "unauthorized",
  forbidden: "forbidden",
  notFound: "not_found",
  rateLimit: "rate_limit",
  invalidRequest: "invalid_request",
  server: "server",
  redirect: "redirect",
  timeout: "timeout",
  tooLarge: "too_large",
  invalidResponse: "invalid_response",
  network: "network",
} as const;
export type HttpFailureKind =
  (typeof HttpFailureKind)[keyof typeof HttpFailureKind];

export interface HttpFailure {
  kind: HttpFailureKind;
  status?: number;
  retryAfter?: string;
  retryAfterSeconds?: number;
}

export interface HttpResponseMetadata {
  status: number;
  type?: ResponseType;
  retryAfter?: string | null;
}

export interface HttpFailureContext {
  failure: HttpFailure;
  request: ResponsePromise;
}

export interface JsonRequest<T> {
  client: KyInstance;
  input: Input;
  options?: Options;
  schema?: StandardSchemaV1<unknown, T>;
  onHttpFailure?(context: HttpFailureContext): Error | Promise<Error>;
}

export interface RetryDelayInput {
  attempt: number;
  retryAfterSeconds?: number;
}
