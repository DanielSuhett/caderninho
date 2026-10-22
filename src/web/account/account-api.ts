import { z } from "zod/v4";

import {
  AccountConnectTokenSchema,
  AuditReportSchema,
  type HouseholdCommand,
  type PortalQuery,
  PortalResponseSchema,
  SyncHistoryResultSchema,
  WorkspaceCatalogSchema,
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
      | HouseholdCommand
      | { csrf: string; query: PortalQuery }
      | { csrf: string; grantId: string },
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
    audit: async (query: URLSearchParams, signal: AbortSignal) =>
      AuditReportSchema.parse(await request(`/audit?${query}`, signal)),
    catalog: async (spaceId: string, signal: AbortSignal) =>
      WorkspaceCatalogSchema.parse(
        await request(`/catalog?${new URLSearchParams({ spaceId })}`, signal),
      ),
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
    history: async (query: URLSearchParams, signal: AbortSignal) =>
      SyncHistoryResultSchema.parse(await request(`/history?${query}`, signal)),
    manage: async (input: HouseholdCommand, signal: AbortSignal) =>
      z.json().parse(await request("/manage", signal, input)),
    query: (query: PortalQuery, csrf: string, signal: AbortSignal) =>
      request("/query", signal, { csrf, query }),
    read: async (signal: AbortSignal) =>
      PortalResponseSchema.parse(await request("", signal)),
    revokeGrant: async (grantId: string, csrf: string, signal: AbortSignal) =>
      z
        .object({ ok: z.literal(true) })
        .parse(await request("/revoke-grant", signal, { csrf, grantId })),
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
