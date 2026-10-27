import { z } from "zod/v4";

import {
  Fault,
  FaultCode,
  type FinancialSource,
  ProviderAccountSchema,
  ProviderConnectionSchema,
  ProviderTransactionSchema,
} from "../../domain";
import { type HttpFailureKind, HttpRequestError, tryCatch } from "../../shared";
import type { PersonalPluggyClient } from "./client.adapter";

const httpFaults: Record<HttpFailureKind, FaultCode> = {
  forbidden: FaultCode.UPSTREAM_FORBIDDEN,
  invalid_request: FaultCode.UPSTREAM_INVALID_REQUEST,
  invalid_response: FaultCode.INVALID_RESPONSE,
  network: FaultCode.UPSTREAM_UNAVAILABLE,
  not_found: FaultCode.UPSTREAM_NOT_FOUND,
  rate_limit: FaultCode.UPSTREAM_RATE_LIMIT,
  redirect: FaultCode.UPSTREAM_REDIRECT,
  server: FaultCode.UPSTREAM_ERROR,
  timeout: FaultCode.UPSTREAM_TIMEOUT,
  too_large: FaultCode.UPSTREAM_TOO_LARGE,
  unauthorized: FaultCode.UPSTREAM_AUTH,
};

// Translate only transport metadata into public faults. Upstream bodies, URLs and credentials
// never become a Fault cause, message, detail or log.
export async function sdkResult<T>(operation: () => Promise<T>): Promise<T> {
  const { data, error } = await tryCatch(operation);
  if (!error) {
    return data;
  }
  const failure = error instanceof HttpRequestError ? error.failure : undefined;
  const fault = new Fault(
    failure ? httpFaults[failure.kind] : FaultCode.UPSTREAM_UNAVAILABLE,
  );
  if (failure?.retryAfterSeconds !== undefined) {
    fault.details = { retryAfterSeconds: failure.retryAfterSeconds };
  }
  throw fault;
}

export function financialSource(client: PersonalPluggyClient): FinancialSource {
  return {
    async accounts(id) {
      const page = z
        .object({
          page: z.coerce.number().int().positive(),
          results: z.array(ProviderAccountSchema).max(1000),
          total: z.coerce.number().int().nonnegative(),
          totalPages: z.coerce.number().int().nonnegative(),
        })
        .parse(await sdkResult(() => client.fetchAccounts(id)));
      if (
        page.page !== 1 ||
        page.totalPages > 1 ||
        page.total !== page.results.length
      ) {
        throw new Error("INCOMPLETE_PAGE");
      }
      return page.results;
    },
    async connection(id) {
      const value = ProviderConnectionSchema.parse(
        await sdkResult(() => client.fetchItem(id)),
      );
      if (value.id !== id) {
        throw new Error("SOURCE_IDENTITY_MISMATCH");
      }
      return value;
    },
    async transactions(accountId, cursor) {
      const page = z
        .object({
          next: z.string().max(4096).nullable(),
          results: z.array(ProviderTransactionSchema).max(1000),
          totalPages: z.coerce.number().int().nonnegative().optional(),
        })
        .parse(
          await sdkResult(() =>
            client.fetchTransactionsCursor(accountId, {
              ...(cursor && { after: cursor }),
            }),
          ),
        );
      const next = transactionCursor(page.next, accountId, cursor);
      if (next && !page.results.length) {
        throw new Error("REPEATED_CURSOR");
      }
      return { next, records: page.results };
    },
  };
}
export async function connectToken(
  client: PersonalPluggyClient,
  itemId?: string,
) {
  return z
    .object({ accessToken: z.string().min(1).max(12_000) })
    .parse(await sdkResult(() => client.createConnectToken(itemId)));
}

function transactionCursor(
  value: string | null,
  accountId: string,
  previous: string | null,
) {
  if (value === null) {
    return null;
  }
  if (!value.startsWith("?") || value.includes("#")) {
    throw new Error("INVALID_PAGINATION");
  }
  const query = new URLSearchParams(value);
  if (
    query.get("accountId") !== accountId ||
    [...query.keys()].some(
      (key) =>
        !["accountId", "after"].includes(key) || query.getAll(key).length !== 1,
    )
  ) {
    throw new Error("CURSOR_SCOPE_MISMATCH");
  }
  const cursor = query.get("after");
  if (!cursor || cursor === previous) {
    throw new Error("REPEATED_CURSOR");
  }
  return cursor;
}
