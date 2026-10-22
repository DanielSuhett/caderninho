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
import { createReadCache } from "./read-cache";

export function createAccountApi(
  origin: string,
  fetcher: typeof fetch = fetch,
) {
  const cache = createReadCache();
  const client = httpClient.extend({
    fetch: fetcher,
    redirect: "manual",
    retry: 0,
  });
  const request = async (
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
  ) => {
    const mutation = body && path !== "/query";
    if (mutation) {
      cache.clear();
    }
    try {
      return await requestJson({
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
    } finally {
      if (mutation) {
        cache.clear();
      }
    }
  };
  return {
    audit: async (query: URLSearchParams, signal: AbortSignal, fresh = false) =>
      AuditReportSchema.parse(
        await cache.read(
          `audit:${query}`,
          () => request(`/audit?${query}`, signal),
          fresh,
        ),
      ),
    catalog: async (spaceId: string, signal: AbortSignal, fresh = false) =>
      WorkspaceCatalogSchema.parse(
        await cache.read(
          `catalog:${spaceId}`,
          () => request(`/catalog?${new URLSearchParams({ spaceId })}`, signal),
          fresh,
        ),
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
    history: async (
      query: URLSearchParams,
      signal: AbortSignal,
      fresh = false,
    ) =>
      SyncHistoryResultSchema.parse(
        await cache.read(
          `history:${query}`,
          () => request(`/history?${query}`, signal),
          fresh,
        ),
      ),
    manage: async (input: HouseholdCommand, signal: AbortSignal) =>
      z.json().parse(await request("/manage", signal, input)),
    query: (
      query: PortalQuery,
      csrf: string,
      signal: AbortSignal,
      fresh = false,
    ) =>
      cache.read(
        `query:${JSON.stringify(query)}`,
        () => request("/query", signal, { csrf, query }),
        fresh,
      ),
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
