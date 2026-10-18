import type { PluggyClient } from "pluggy-sdk";
import { z } from "zod/v4";

import { FaultCode, Resource } from "@/domain/enums";
import { Fault } from "@/domain/fault.entity";
import {
  assertSourceIdentity,
  assertSourceRecords,
  assertTransactionSelection,
  type Credentials,
} from "@/domain/provider.entity";
import { ProviderRecordSchema } from "@/domain/provider.schema";
import { httpResponseFailure, rateLimitRetry } from "@/shared/http";
import { HttpFailureKind } from "@/shared/http.types";
import { tryCatch } from "@/shared/result";
import type { FinancialSource, Steps, StepValue } from "@/worker/sync";

import { PersonalPluggyClient } from "./client.adapter";

const transportFaults = new Map<string, FaultCode>([
  [FaultCode.UPSTREAM_REDIRECT, FaultCode.UPSTREAM_REDIRECT],
  [FaultCode.UPSTREAM_TOO_LARGE, FaultCode.UPSTREAM_TOO_LARGE],
  ["ETIMEDOUT", FaultCode.UPSTREAM_TIMEOUT],
  ["ERR_BODY_PARSE_FAILURE", FaultCode.INVALID_RESPONSE],
]);
const httpFaults: Record<HttpFailureKind, FaultCode> = {
  unauthorized: FaultCode.UPSTREAM_AUTH,
  forbidden: FaultCode.UPSTREAM_FORBIDDEN,
  not_found: FaultCode.UPSTREAM_NOT_FOUND,
  rate_limit: FaultCode.UPSTREAM_RATE_LIMIT,
  invalid_request: FaultCode.UPSTREAM_INVALID_REQUEST,
  server: FaultCode.UPSTREAM_ERROR,
  redirect: FaultCode.UPSTREAM_REDIRECT,
  timeout: FaultCode.UPSTREAM_TIMEOUT,
  too_large: FaultCode.UPSTREAM_TOO_LARGE,
  invalid_response: FaultCode.INVALID_RESPONSE,
  network: FaultCode.UPSTREAM_UNAVAILABLE,
};

// Translate only transport metadata into public faults. Upstream bodies, URLs and credentials
// stay inside the SDK error and never become a Fault cause, message, detail or log.
async function sdkResult<T>(operation: () => Promise<T>): Promise<T> {
  const { data, error } = await tryCatch(operation);
  if (!error) {
    return data;
  }
  const upstream = z
    .object({
      code: z.string().optional(),
      response: z
        .object({
          statusCode: z.number(),
          headers: z.object({
            "retry-after": z
              .union([z.string(), z.array(z.string())])
              .optional(),
          }),
        })
        .optional(),
    })
    .parse(error);
  const retry = upstream.response?.headers["retry-after"];
  const failure =
    upstream.response &&
    httpResponseFailure({
      status: upstream.response.statusCode,
      ...(typeof retry === "string" && { retryAfter: retry }),
    });
  const fault = new Fault(
    transportFaults.get(upstream.code ?? "") ??
      httpFaults[failure?.kind ?? HttpFailureKind.network],
  );
  if (failure?.retryAfterSeconds != null) {
    fault.details = { retryAfterSeconds: failure.retryAfterSeconds };
  }
  throw fault;
}

export async function connectToken(credentials: Credentials, itemId?: string) {
  const { data, error } = await tryCatch(() =>
    sdkResult(() =>
      new PersonalPluggyClient(credentials, 16384).createConnectToken(itemId, {
        avoidDuplicates: true,
      }),
    ),
  );
  if (error) {
    if (
      error instanceof Fault &&
      (error.code === FaultCode.UPSTREAM_AUTH ||
        error.code === FaultCode.UPSTREAM_FORBIDDEN)
    ) {
      throw error;
    }
    throw new Error(
      error instanceof Fault && error.code === FaultCode.UPSTREAM_RATE_LIMIT
        ? "CONNECT_RATE_LIMIT"
        : "CONNECT_TOKEN_FAILED",
    );
  }
  return z.object({ accessToken: z.string().min(1).max(12000) }).parse(data);
}

export async function readItem(credentials: Credentials, itemId: string) {
  const item = z
    .object({
      id: z.string(),
      connector: z.object({ id: z.union([z.number(), z.string()]) }).optional(),
    })
    .parse(
      await sdkResult(() =>
        new PersonalPluggyClient(credentials).fetchItem(itemId),
      ),
    );
  assertSourceIdentity({ id: item.id, expected: itemId });
  return {
    id: item.id,
    ...(item.connector && { connector: item.connector }),
  };
}

export async function readAccount(client: PluggyClient, accountId: string) {
  const record = ProviderRecordSchema.parse(
    await sdkResult(() => client.fetchAccount(accountId)),
  );
  assertSourceIdentity({ id: record.id, expected: accountId });
  return record;
}

const PageSchema = z.object({
  results: z.array(ProviderRecordSchema).max(1000),
  next: z.unknown().optional(),
  page: z.coerce.number().int().positive().default(1),
  totalPages: z.coerce.number().int().nonnegative().optional(),
  total: z.coerce.number().int().nonnegative().optional(),
});
const TransactionPageSchema = PageSchema.extend({
  results: z
    .array(
      ProviderRecordSchema.extend({ createdAt: z.iso.datetime().nullish() }),
    )
    .max(1000),
});
const paged: Resource[] = [
  Resource.resources,
  Resource.investments,
  Resource.investment_transactions,
  Resource.bills,
];

export function financialSource(client: PluggyClient): FinancialSource {
  return {
    async page({ resource, item, parent, cursor, floor, connectorId }) {
      const options = { page: Number(cursor ?? 1), pageSize: 100 };
      const operations = {
        connections: () => client.fetchItem(item),
        resources: () => client.fetchItemResources(item, options),
        connectors: () =>
          client.fetchConnector(
            z.coerce.number().int().positive().parse(connectorId),
          ),
        consents: () => client.fetchConsents(item),
        accounts: () => client.fetchAccounts(item),
        transactions: () =>
          client.fetchTransactionsCursor(parent, {
            ...(floor && { createdAtFrom: floor }),
            ...(cursor && { after: cursor }),
          }),
        investments: () => client.fetchInvestments(item, undefined, options),
        investment_transactions: () =>
          client.fetchInvestmentTransactions(parent, options),
        bills: () => client.fetchCreditCardBills(parent, options),
        loans: () => client.fetchLoans(item),
        identity: () => client.fetchIdentityByItemId(item),
        categories: () => client.fetchCategories(),
        statements: () => client.fetchAccountStatements(parent),
      };
      // SDK types describe its default date/number parser; our parser returns raw JSON.
      // Parse at this boundary instead of letting SDK models enter financial logic.
      const raw: unknown = await sdkResult<unknown>(operations[resource]);
      if (
        [Resource.connections, Resource.identity, Resource.connectors].some(
          (candidate) => candidate === resource,
        )
      ) {
        const record = ProviderRecordSchema.parse(raw);
        assertSourceRecords({
          records: [record],
          context: { resource, item, connectorId },
        });
        return { records: [record], next: null };
      }
      const data = (
        resource === Resource.transactions ? TransactionPageSchema : PageSchema
      ).parse(raw);
      const records = data.results;
      assertSourceRecords({ records, context: { resource, item, parent } });
      if (resource === Resource.transactions) {
        return {
          records,
          next: validateCursor(data.next, parent, cursor, floor),
        };
      }
      const { page, totalPages, total } = data;
      if (
        totalPages === undefined ||
        total === undefined ||
        page !== Number(cursor ?? 1) ||
        total < records.length ||
        (total > 0 && totalPages === 0)
      ) {
        throw new Error(FaultCode.INVALID_PAGE);
      }
      if (page < totalPages && (!paged.includes(resource) || !records.length)) {
        throw new Error("PAGINATION_UNDOCUMENTED_OR_INCOMPLETE");
      }
      return {
        records,
        next: page < totalPages ? String(page + 1) : null,
        total,
      };
    },
    async ids(account, ids) {
      if (!ids.length || ids.length > 500) {
        throw new Error("IDS_LIMIT");
      }
      const data = PageSchema.parse(
        await sdkResult(() => client.fetchTransactionsCursor(account, { ids })),
      );
      if (data.next !== null) {
        throw new Error("IDS_RESPONSE_INCOMPLETE");
      }
      assertTransactionSelection({ records: data.results, account, ids });
      return data.results;
    },
  };
}
function validateCursor(
  value: unknown,
  account: string,
  previous: string | null,
  floor: string | null = null,
) {
  if (value === null) {
    return null;
  }
  const text = z.string().max(4096).parse(value);
  if (!text.startsWith("?") || text.includes("#")) {
    throw new Error(FaultCode.INVALID_CURSOR);
  }
  const q = new URLSearchParams(text);
  if (
    q.get("accountId") !== account ||
    (q.has("createdAtFrom") && q.get("createdAtFrom") !== floor) ||
    [...q.keys()].some(
      (k) => !["accountId", "after", "createdAtFrom"].includes(k),
    ) ||
    [...q.keys()].some((k) => q.getAll(k).length !== 1)
  ) {
    throw new Error("CURSOR_SCOPE_MISMATCH");
  }
  const next = q.get("after");
  if (!next || next === previous) {
    throw new Error(FaultCode.CURSOR_LOOP);
  }
  return next;
}

// A 429 acknowledgement is a durable step result; wait outside the billed step.
export function providerRetries(steps: Steps): Steps {
  return {
    sleep: (name, duration) => steps.sleep(name, duration),
    async do<T extends StepValue<T>>(
      name: string,
      callback: () => Promise<T>,
    ): Promise<T> {
      for (let attempt = 0; attempt < rateLimitRetry.attempts; attempt++) {
        const outcome = await steps.do(
          `${name}-attempt-${attempt}`,
          async () => {
            const { data, error } = await tryCatch(callback);
            if (!error) {
              return { kind: "success" as const, value: data };
            }
            if (
              !(error instanceof Fault) ||
              error.code !== FaultCode.UPSTREAM_RATE_LIMIT
            ) {
              throw error;
            }
            return {
              kind: "retry" as const,
              seconds: rateLimitRetry.delay({
                attempt,
                ...(error.details?.retryAfterSeconds != null && {
                  retryAfterSeconds: error.details.retryAfterSeconds,
                }),
              }),
            };
          },
        );
        if (outcome.kind === "success") {
          return outcome.value;
        }
        await steps.sleep(
          `${name}-rate-limit-${attempt}`,
          `${Math.ceil(outcome.seconds)} seconds`,
        );
      }
      throw new Error("UPSTREAM_RATE_LIMIT_RETRIES_EXHAUSTED");
    },
  };
}
