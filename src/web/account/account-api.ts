import { z } from "zod/v4";

import {
  AccountConnectTokenSchema,
  type HouseholdCommand,
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
    body?:
      | {
          csrf: string;
          itemId?: string;
          profileId?: string;
          connectionIds?: string[];
        }
      | HouseholdCommand,
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
      selection: {
        itemId?: string;
        profileId?: string;
        connectionIds?: string[];
      } = {},
    ) => {
      z.json().parse(
        await request(`/${action}`, signal, {
          csrf,
          ...selection,
        }),
      );
    },
    manage: async (input: HouseholdCommand, signal: AbortSignal) =>
      z.json().parse(await request("/manage", signal, input)),
    read: async (signal: AbortSignal) =>
      PortalResponseSchema.parse(await request("", signal)),
    token: async (
      csrf: string,
      signal: AbortSignal,
      itemId?: string,
      profileId?: string,
    ) =>
      AccountConnectTokenSchema.parse(
        await request("/connect-token", signal, {
          csrf,
          ...(itemId && { itemId }),
          ...(profileId && { profileId }),
        }),
      ),
  };
}
