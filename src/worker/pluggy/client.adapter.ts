import ky from "ky";
import { PluggyClient } from "pluggy-sdk";
import { z } from "zod/v4";

import { exactJSON } from "#domain/exact.ts";
import { tryCatch } from "#shared/result.ts";

type QueryParameters = Record<
  string,
  number | number[] | string | string[] | boolean
>;

function transportError(code: string, response?: Response) {
  return Object.assign(new Error(code), {
    code,
    ...(response
      ? {
          response: {
            statusCode: response.status,
            headers: {
              "retry-after": response.headers.get("Retry-After") ?? "",
            },
          },
        }
      : {}),
  });
}

// Keep the official SDK endpoint methods; adapt its protected transport to Fetch.
// Upstream bodies and credentials never enter errors or logs.
export class PersonalPluggyClient extends PluggyClient {
  private cachedKey = "";
  private readonly maximum: number;
  private readonly timeoutMs: number;

  constructor(
    credentials: { clientId: string; clientSecret: string },
    maximum = 4000000,
    timeoutMs = 15000,
  ) {
    super(credentials);
    this.maximum = maximum;
    this.timeoutMs = timeoutMs;
  }

  protected override async getApiKey() {
    if (this.cachedKey && !this.isJwtExpired(this.cachedKey))
      return this.cachedKey;
    const authenticated = z.object({ apiKey: z.string().min(1) }).parse(
      await this.request<unknown>("POST", "auth", {
        clientId: this.clientId,
        clientSecret: this.clientSecret,
        nonExpiring: false,
      }),
    );
    this.cachedKey = authenticated.apiKey;
    return this.cachedKey;
  }

  protected override async createGetRequest<T>(
    endpoint: string,
    params?: QueryParameters,
  ): Promise<T> {
    const apiKey = await this.getApiKey();
    return this.request<T>(
      "GET",
      endpoint + this.mapToQueryString(params ?? {}),
      undefined,
      apiKey,
    );
  }

  protected override async createMutationRequest<T>(
    method: string,
    endpoint: string,
    params?: QueryParameters,
    body?: Record<string, unknown>,
  ): Promise<T> {
    const apiKey = await this.getApiKey();
    return this.request<T>(
      method.toUpperCase(),
      endpoint + this.mapToQueryString(params ?? {}),
      body,
      apiKey,
    );
  }

  private async request<T>(
    method: string,
    endpoint: string,
    body?: Record<string, unknown>,
    apiKey?: string,
  ): Promise<T> {
    const deadline = AbortSignal.timeout(this.timeoutMs);
    const result = await tryCatch(
      ky("https://api.pluggy.ai/" + endpoint, {
        method,
        ...(body === undefined ? {} : { json: body }),
        headers: apiKey ? { "X-API-KEY": apiKey } : {},
        signal: deadline,
        timeout: false,
        retry: 0,
        redirect: "manual",
        throwHttpErrors: false,
        parseJson: exactJSON,
        fetch: async (input, init) => {
          const response = await fetch(input, init);
          if (response.status === 401) this.cachedKey = "";
          if (!response.ok) {
            void tryCatch(response.body?.cancel() ?? Promise.resolve());
            throw transportError(
              response.status >= 300 && response.status < 400
                ? "UPSTREAM_REDIRECT"
                : "UPSTREAM_HTTP_ERROR",
              response,
            );
          }
          if (Number(response.headers.get("Content-Length")) > this.maximum) {
            void tryCatch(response.body?.cancel() ?? Promise.resolve());
            throw transportError("UPSTREAM_TOO_LARGE");
          }
          const reader = response.body?.getReader();
          const chunks: Uint8Array[] = [];
          let size = 0;
          if (reader) {
            const abort = () => {
              void tryCatch(reader.cancel());
            };
            deadline.addEventListener("abort", abort, { once: true });
            if (deadline.aborted) abort();
            try {
              for (;;) {
                const chunk = await reader.read();
                if (chunk.done) break;
                size += chunk.value.byteLength;
                if (size > this.maximum) {
                  void tryCatch(reader.cancel());
                  throw transportError("UPSTREAM_TOO_LARGE");
                }
                chunks.push(chunk.value);
              }
            } finally {
              deadline.removeEventListener("abort", abort);
              reader.releaseLock();
            }
          }
          const bytes = new Uint8Array(size);
          let offset = 0;
          for (const chunk of chunks) {
            bytes.set(chunk, offset);
            offset += chunk.byteLength;
          }
          const headers = new Headers(response.headers);
          headers.delete("Content-Encoding");
          headers.delete("Content-Length");
          return new Response(bytes, { status: response.status, headers });
        },
      }).json<T>(),
    );
    if (result.error) {
      if (deadline.aborted) throw transportError("ETIMEDOUT");
      if (result.error instanceof SyntaxError)
        throw transportError("ERR_BODY_PARSE_FAILURE");
      throw result.error;
    }
    return result.data;
  }
}
