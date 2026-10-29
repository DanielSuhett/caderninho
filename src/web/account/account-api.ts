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
import { fetchJson, tryCatchSync } from "../../shared";
import { AccountRequestError } from "./account-feedback";
import { clearViews, createReadCache, type ReadCache } from "./read-cache";

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

export type PrefetchedQuery = {
  [Tool in PortalQuery["tool"]]: {
    tool: Tool;
    key: string;
    data: PortalQueryResults[Tool];
  };
}[PortalQuery["tool"]];

// The installation state, plus the current page's first answers when the
// Worker had them in time. Keys match what the page will ask for.
export interface AccountBoot extends PortalResponse {
  page?: {
    catalog?: { spaceId: string; data: WorkspaceCatalog };
    results: PrefetchedQuery[];
  };
}

// The Worker inlines the installation state into the page it serves, so the
// panel renders without waiting one more round trip for its first read.
export function readBoot(): AccountBoot | undefined {
  const text = document.getElementById("account-boot")?.textContent;
  if (!text) {
    return;
  }
  const { data, error } = tryCatchSync(() => JSON.parse(text));
  return error ? undefined : data;
}

export function createAccountApi(
  origin: string,
  fetcher: typeof fetch = fetch,
  boot?: AccountBoot,
) {
  let initial: PortalResponse | undefined = boot;
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
    get_emergency_reserve: createReadCache(),
    get_investments: createReadCache(),
    get_overview: createReadCache(),
    get_portal_cards: createReadCache(),
    get_portal_transactions: createReadCache(),
    get_transactions: createReadCache(),
    preview_rule_import: createReadCache(),
  };
  const primeQuery = <Tool extends PortalQuery["tool"]>(
    tool: Tool,
    key: string,
    data: PortalQueryResults[Tool],
  ) => queries[tool].prime(key, Promise.resolve(data));
  for (const result of boot?.page?.results ?? []) {
    primeQuery(result.tool, result.key, result.data);
  }
  const bootCatalog = boot?.page?.catalog;
  if (bootCatalog) {
    caches.catalog.prime(
      `catalog:${bootCatalog.spaceId}`,
      Promise.resolve(bootCatalog.data),
    );
  }
  const clearCaches = () => {
    for (const cache of [...Object.values(caches), ...Object.values(queries)]) {
      cache.clear();
    }
    clearViews();
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
    // The entry starts these before the page mounts; see page-requests.ts.
    prefetch: <Tool extends PortalQuery["tool"]>(
      query: PortalQuery & { tool: Tool },
      csrf: string,
    ) =>
      queries[query.tool].prime(
        JSON.stringify(query),
        request<PortalQueryResults[Tool]>(
          "/query",
          new AbortController().signal,
          {
            csrf,
            query,
          },
        ),
      ),
    prefetchCatalog: (spaceId: string) =>
      caches.catalog.prime(
        `catalog:${spaceId}`,
        request<WorkspaceCatalog>(
          `/catalog?${new URLSearchParams({ spaceId })}`,
          new AbortController().signal,
        ),
      ),
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
    read: (signal: AbortSignal) => {
      const state = initial;
      initial = undefined;
      return state
        ? Promise.resolve(state)
        : request<PortalResponse>("", signal);
    },
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
