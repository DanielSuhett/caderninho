import type { Input, KyInstance, Options } from "ky";

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

export interface FetchJsonRequest {
  fetcher?: typeof fetch;
  init: Omit<RequestInit, "body" | "signal"> & {
    body?: unknown;
    signal: AbortSignal;
  };
  input: string;
  inspect?: (response: Response) => void;
  maxResponseSize: number;
  timeoutMs: number;
}

export interface JsonRequest {
  client: KyInstance;
  input: Input;
  options?: Options;
}

export interface RetryDelayInput {
  attempt: number;
  retryAfterSeconds?: number;
}
