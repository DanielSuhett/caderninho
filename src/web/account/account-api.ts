import { z } from "zod/v4";

import {
  AccountConnectTokenSchema,
  AccountFailureCodeSchema,
  AuditReportSchema,
  type HouseholdCommand,
  HouseholdResultSchema,
  type PortalMutation,
  type PortalQuery,
  type PortalQueryResults,
  PortalResponseSchema,
  parsePortalQueryResult,
  type RulePreviewInput,
  RulePreviewResultSchema,
  SyncHistoryResultSchema,
  WorkspaceCatalogSchema,
} from "../../contracts";
import { httpClient, requestJson } from "../../shared";
import { AccountRequestError } from "./account-feedback";
import { createReadCache } from "./read-cache";

export type OrganizationApi = Pick<
  ReturnType<typeof createAccountApi>,
  "catalog" | "query" | "planning" | "previewRule"
>;

export function createAccountApi(
  origin: string,
  fetcher: typeof fetch = fetch,
) {
  const cache = createReadCache();
  const client = httpClient.extend({
    fetch: fetcher,
    hooks: {
      afterResponse: [
        ({ response }) => {
          if (response.ok) {
            return;
          }
          const code = AccountFailureCodeSchema.safeParse(
            response.headers.get("X-Caderninho-Error"),
          );
          if (code.success) {
            throw new AccountRequestError(code.data);
          }
        },
      ],
    },
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
      | { csrf: string; command: PortalMutation }
      | RulePreviewInput
      | { csrf: string; query: PortalQuery }
      | { csrf: string; grantId: string },
  ) => {
    const mutation = body && path !== "/query" && path !== "/rule-preview";
    if (mutation) {
      cache.clear();
    }
    try {
      return await requestJson({
        client,
        input: `${origin}/api/account${path}`,
        options: {
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
      await request(`/${action}`, signal, { csrf, ...selection });
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
      HouseholdResultSchema.parse(await request("/manage", signal, input)),
    planning: async (
      command: PortalMutation,
      csrf: string,
      signal: AbortSignal,
    ) => request("/planning", signal, { command, csrf }),
    previewRule: async (input: RulePreviewInput, signal: AbortSignal) =>
      RulePreviewResultSchema.parse(
        await request("/rule-preview", signal, input),
      ),
    query: async <Tool extends PortalQuery["tool"]>(
      query: PortalQuery & { tool: Tool },
      csrf: string,
      signal: AbortSignal,
      fresh = false,
    ): Promise<PortalQueryResults[Tool]> =>
      parsePortalQueryResult(
        query.tool,
        await cache.read(
          `query:${JSON.stringify(query)}`,
          () => request("/query", signal, { csrf, query }),
          fresh,
        ),
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
