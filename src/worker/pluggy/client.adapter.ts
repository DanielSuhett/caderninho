import { PluggyClient } from "pluggy-sdk";
import { z } from "zod/v4";

import { exactJSON, FaultCode } from "../../domain";
import {
  type HttpFailure,
  HttpFailureKind,
  HttpRequestError,
  httpClient,
  requestJson,
  tryCatch,
} from "../../shared";

type QueryParameters = Record<
  string,
  number | number[] | string | string[] | boolean
>;

const transportCodes: Record<HttpFailureKind, string> = {
  forbidden: "UPSTREAM_HTTP_ERROR",
  invalid_request: "UPSTREAM_HTTP_ERROR",
  invalid_response: "ERR_BODY_PARSE_FAILURE",
  network: "UPSTREAM_HTTP_ERROR",
  not_found: "UPSTREAM_HTTP_ERROR",
  rate_limit: "UPSTREAM_HTTP_ERROR",
  redirect: FaultCode.UPSTREAM_REDIRECT,
  server: "UPSTREAM_HTTP_ERROR",
  timeout: "ETIMEDOUT",
  too_large: FaultCode.UPSTREAM_TOO_LARGE,
  unauthorized: "UPSTREAM_HTTP_ERROR",
};

function transportError(failure: HttpFailure) {
  const code = transportCodes[failure.kind];
  return Object.assign(new Error(code), {
    code,
    ...(failure.status !== null &&
      failure.status !== undefined && {
        response: {
          headers: {
            "retry-after": failure.retryAfter ?? "",
          },
          statusCode: failure.status,
        },
      }),
  });
}

// Keep the official SDK endpoint methods; adapt its protected transport to Fetch.
// Upstream bodies and credentials never enter errors or logs.
export class PersonalPluggyClient extends PluggyClient {
  private cachedKey: string | undefined;
  private readonly maximum: number;
  private readonly timeoutMs: number;
  private readonly http = httpClient.extend({
    parseJson: exactJSON,
  });

  constructor(
    credentials: { clientId: string; clientSecret: string },
    maximum = 4_000_000,
    timeoutMs = 15_000,
  ) {
    super(credentials);
    this.maximum = maximum;
    this.timeoutMs = timeoutMs;
  }

  protected override async getApiKey() {
    if (this.cachedKey && !this.isJwtExpired(this.cachedKey)) {
      return this.cachedKey;
    }
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
    const { data, error } = await tryCatch(() =>
      requestJson<T>({
        client: this.http,
        input: `https://api.pluggy.ai/${endpoint}`,
        options: {
          method,
          ...(body && { json: body }),
          headers: apiKey ? { "X-API-KEY": apiKey } : {},
          maxResponseSize: this.maximum,
          totalTimeout: this.timeoutMs,
        },
      }),
    );
    if (error) {
      if (error instanceof HttpRequestError) {
        if (error.failure.kind === HttpFailureKind.unauthorized) {
          this.cachedKey = "";
        }
        throw transportError(error.failure);
      }
      throw error;
    }
    return data;
  }
}
