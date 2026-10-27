import {
  type AccountConnectToken,
  AccountFailureCode,
  type AuditReport,
  type HouseholdCommand,
  type HouseholdResult,
  type InstitutionCatalog,
  type PortalMutation,
  type PortalQuery,
  type PortalQueryResults,
  type PortalResponse,
  type RuleJobCommand,
  type RuleJobResponse,
  type RulePreviewInput,
  type RulePreviewResult,
  type SyncHistoryResult,
  type WorkspaceCatalog,
} from "../../contracts";
import { fetchJson } from "../../shared";
import { AccountRequestError } from "./account-feedback";
import { createReadCache, type ReadCache } from "./read-cache";

const failureCodes = Object.values(AccountFailureCode);

export type OrganizationApi = Pick<
  ReturnType<typeof createAccountApi>,
  | "catalog"
  | "invalidate"
  | "query"
  | "planning"
  | "previewRule"
  | "ruleJob"
  | "ruleJobs"
>;

export function createAccountApi(
  origin: string,
  fetcher: typeof fetch = fetch,
) {
  // Responses come from this installation's typed API: only inputs are parsed.
  const caches = {
    audit: createReadCache<AuditReport>(),
    catalog: createReadCache<WorkspaceCatalog>(),
    history: createReadCache<SyncHistoryResult>(),
  };
  const queries: {
    [Tool in PortalQuery["tool"]]: ReadCache<PortalQueryResults[Tool]>;
  } = {
    generate_chart: createReadCache(),
    get_accounts: createReadCache(),
    get_card_commitments: createReadCache(),
    get_investments: createReadCache(),
    get_overview: createReadCache(),
    get_portal_cards: createReadCache(),
    get_portal_transactions: createReadCache(),
    get_transactions: createReadCache(),
    preview_rule_import: createReadCache(),
  };
  const clearCaches = () => {
    for (const cache of [...Object.values(caches), ...Object.values(queries)]) {
      cache.clear();
    }
  };
  // A rejected request may carry an allowlisted cause for the panel.
  const inspect = (response: Response) => {
    if (response.ok) {
      return;
    }
    const header = response.headers.get("X-Caderninho-Error");
    const code = failureCodes.find((value) => value === header);
    if (code) {
      throw new AccountRequestError(code);
    }
  };
  const request = async <T = unknown>(
    path: string,
    signal: AbortSignal,
    body?:
      | {
          csrf: string;
          itemId?: string;
          profileId?: string;
          connectionIds?: string[];
          deferImport?: boolean;
        }
      | HouseholdCommand
      | { csrf: string; command: PortalMutation }
      | RulePreviewInput
      | { csrf: string; query: PortalQuery }
      | { csrf: string; grantId: string }
      | RuleJobCommand,
  ) => {
    const mutation = body && path !== "/query" && path !== "/rule-preview";
    if (mutation) {
      clearCaches();
    }
    try {
      return await fetchJson<T>({
        fetcher,
        init: { signal, ...(body && { body, method: "POST" }) },
        input: `${origin}/api/account${path}`,
        inspect,
        maxResponseSize: 1_000_000,
        timeoutMs: 20_000,
      });
    } finally {
      if (mutation) {
        clearCaches();
      }
    }
  };
  return {
    audit: async (query: URLSearchParams, signal: AbortSignal, fresh = false) =>
      caches.audit.read(
        `audit:${query}`,
        () => request<AuditReport>(`/audit?${query}`, signal),
        fresh,
      ),
    catalog: async (spaceId: string, signal: AbortSignal, fresh = false) =>
      caches.catalog.read(
        `catalog:${spaceId}`,
        () =>
          request<WorkspaceCatalog>(
            `/catalog?${new URLSearchParams({ spaceId })}`,
            signal,
          ),
        fresh,
      ),
    command: async (
      action: string,
      csrf: string,
      signal: AbortSignal,
      selection: {
        itemId?: string;
        profileId?: string;
        connectionIds?: string[];
        deferImport?: boolean;
      } = {},
    ) => {
      await request(`/${action}`, signal, { csrf, ...selection });
    },
    history: async (
      query: URLSearchParams,
      signal: AbortSignal,
      fresh = false,
    ) =>
      caches.history.read(
        `history:${query}`,
        () => request<SyncHistoryResult>(`/history?${query}`, signal),
        fresh,
      ),
    institutions: async (profileId: string, signal: AbortSignal) =>
      request<InstitutionCatalog>(
        `/institutions?${new URLSearchParams({ profileId })}`,
        signal,
      ),
    invalidate: clearCaches,
    manage: async (input: HouseholdCommand, signal: AbortSignal) =>
      request<HouseholdResult>("/manage", signal, input),
    planning: async (
      command: PortalMutation,
      csrf: string,
      signal: AbortSignal,
    ) => request("/planning", signal, { command, csrf }),
    previewRule: async (input: RulePreviewInput, signal: AbortSignal) =>
      request<RulePreviewResult>("/rule-preview", signal, input),
    query: async <Tool extends PortalQuery["tool"]>(
      query: PortalQuery & { tool: Tool },
      csrf: string,
      signal: AbortSignal,
      fresh = false,
    ): Promise<PortalQueryResults[Tool]> =>
      queries[query.tool].read(
        JSON.stringify(query),
        () =>
          request<PortalQueryResults[Tool]>("/query", signal, { csrf, query }),
        fresh,
      ),
    read: async (signal: AbortSignal) => request<PortalResponse>("", signal),
    revokeGrant: async (grantId: string, csrf: string, signal: AbortSignal) =>
      request<{ ok: true }>("/revoke-grant", signal, { csrf, grantId }),
    ruleJob: async (
      selection: { id: string } | { spaceId: string },
      signal: AbortSignal,
    ) =>
      (
        await request<RuleJobResponse>(
          `/rule-jobs?${new URLSearchParams(selection)}`,
          signal,
        )
      ).job,
    ruleJobs: async (input: RuleJobCommand, signal: AbortSignal) => {
      const { job } = await request<RuleJobResponse>(
        "/rule-jobs",
        signal,
        input,
      );
      if (!job) {
        throw new Error("NOT_FOUND");
      }
      return job;
    },
    token: async (
      csrf: string,
      signal: AbortSignal,
      itemId?: string,
      profileId?: string,
    ) =>
      request<AccountConnectToken>("/connect-token", signal, {
        csrf,
        ...(itemId && { itemId }),
        ...(profileId && { profileId }),
      }),
  };
}
