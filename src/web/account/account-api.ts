import { z } from "zod/v4";

import {
  AccountConnectTokenSchema,
  PortalResponseSchema,
} from "../../contracts";
import { httpClient, requestJson } from "../../shared";
export function createAccountApi(
  origin: string,
  fetcher: typeof fetch = fetch,
) {
  const client = httpClient.extend({
    fetch: fetcher,
    redirect: "manual",
    retry: 0,
  });
  const request = (
    path: string,
    signal: AbortSignal,
    body?: { csrf: string; itemId?: string },
  ) =>
    requestJson({
      client,
      input: `${origin}/api/account${path}`,
      options: {
        headers: { Accept: "application/json" },
        signal,
        ...(body && { json: body, method: "POST" }),
        maxResponseSize: 1_000_000,
        totalTimeout: 20_000,
      },
    });
  return {
    command: async (
      action: string,
      csrf: string,
      signal: AbortSignal,
      itemId?: string,
    ) => {
      z.json().parse(
        await request(`/${action}`, signal, {
          csrf,
          ...(itemId && { itemId }),
        }),
      );
    },
    read: async (signal: AbortSignal) =>
      PortalResponseSchema.parse(await request("", signal)),
    token: async (csrf: string, signal: AbortSignal, itemId?: string) =>
      AccountConnectTokenSchema.parse(
        await request("/connect-token", signal, {
          csrf,
          ...(itemId && { itemId }),
        }),
      ),
  };
}
