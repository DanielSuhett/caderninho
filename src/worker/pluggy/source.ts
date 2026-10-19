import type { PluggyClient } from "pluggy-sdk";
import { z } from "zod/v4";

import {
  assertSourceIdentity,
  assertSourceRecords,
  assertTransactionSelection,
  type Credentials,
  Fault,
  FaultCode,
  ProviderRecordSchema,
  Resource,
} from "../../domain";
import { HttpFailureKind, httpResponseFailure, tryCatch } from "../../shared";
import type { FinancialSource, Steps, StepValue } from "../sync";
import { PersonalPluggyClient } from "./client.adapter";

const transportFaults = new Map<string, FaultCode>([
  [FaultCode.UPSTREAM_REDIRECT, FaultCode.UPSTREAM_REDIRECT],
  [FaultCode.UPSTREAM_TOO_LARGE, FaultCode.UPSTREAM_TOO_LARGE],
  ["ETIMEDOUT", FaultCode.UPSTREAM_TIMEOUT],
  ["ERR_BODY_PARSE_FAILURE", FaultCode.INVALID_RESPONSE],
]);
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
          headers: z.object({
            "retry-after": z
              .union([z.string(), z.array(z.string())])
              .optional(),
          }),
          statusCode: z.number(),
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
  if (failure?.retryAfterSeconds !== undefined) {
    fault.details = { retryAfterSeconds: failure.retryAfterSeconds };
  }
  throw fault;
}

export async function connectToken(credentials: Credentials, itemId?: string) {
  const { data, error } = await tryCatch(() =>
    sdkResult(() =>
      new PersonalPluggyClient(credentials, 16_384).createConnectToken(itemId, {
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
  return z.object({ accessToken: z.string().min(1).max(12_000) }).parse(data);
}

export async function readItem(credentials: Credentials, itemId: string) {
  const item = z
    .object({
      connector: z.object({ id: z.union([z.number(), z.string()]) }).optional(),
      id: z.string(),
    })
    .parse(
      await sdkResult(() =>
        new PersonalPluggyClient(credentials).fetchItem(itemId),
      ),
    );
  assertSourceIdentity({ expected: itemId, id: item.id });
  return {
    id: item.id,
    ...(item.connector && { connector: item.connector }),
  };
}

export async function readAccount(client: PluggyClient, accountId: string) {
  const record = ProviderRecordSchema.parse(
    await sdkResult(() => client.fetchAccount(accountId)),
  );
  assertSourceIdentity({ expected: accountId, id: record.id });
  return record;
}

const PageSchema = z.object({
  next: z.unknown().optional(),
  page: z.coerce.number().int().positive().default(1),
  results: z.array(ProviderRecordSchema).max(1000),
  total: z.coerce.number().int().nonnegative().optional(),
  totalPages: z.coerce.number().int().nonnegative().optional(),
});
const TransactionPageSchema = PageSchema.extend({
  results: z
    .array(
      ProviderRecordSchema.extend({ createdAt: z.iso.datetime().nullish() }),
    )
    .max(1000),
});
const ConsentPageSchema = PageSchema.extend({
  results: z
    .array(ProviderRecordSchema.extend({ itemId: z.string().min(1) }))
    .max(1000),
});
const paged: Resource[] = [
  Resource.consents,
  Resource.resources,
  Resource.investments,
  Resource.investment_transactions,
  Resource.bills,
];

function parseSourcePage(resource: Resource, raw: unknown) {
  if (resource === Resource.transactions) {
    return TransactionPageSchema.parse(raw);
  }
  if (resource === Resource.consents) {
    return ConsentPageSchema.parse(raw);
  }
  return PageSchema.parse(raw);
}

export function financialSource(client: PluggyClient): FinancialSource {
  return {
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
      assertTransactionSelection({ account, ids, records: data.results });
      return data.results;
    },
    async page({ resource, item, parent, cursor, floor, connectorId }) {
      const options = { page: Number(cursor ?? 1), pageSize: 100 };
      const operations = {
        accounts: () => client.fetchAccounts(item),
        bills: () => client.fetchCreditCardBills(parent, options),
        categories: () => client.fetchCategories(),
        connections: () => client.fetchItem(item),
        connectors: () =>
          client.fetchConnector(
            z.coerce.number().int().positive().parse(connectorId),
          ),
        consents: () => client.fetchConsents(item, options),
        identity: () => client.fetchIdentityByItemId(item),
        investment_transactions: () =>
          client.fetchInvestmentTransactions(parent, options),
        investments: () => client.fetchInvestments(item, undefined, options),
        loans: () => client.fetchLoans(item),
        resources: () => client.fetchItemResources(item, options),
        statements: () => client.fetchAccountStatements(parent),
        transactions: () =>
          client.fetchTransactionsCursor(parent, {
            ...(floor && { createdAtFrom: floor }),
            ...(cursor && { after: cursor }),
          }),
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
          context: { connectorId, item, resource },
          records: [record],
        });
        return { next: null, records: [record] };
      }
      const data = parseSourcePage(resource, raw);
      const { results: records } = data;
      assertSourceRecords({
        context: {
          item,
          parent,
          resource,
          ...(connectorId && { connectorId }),
        },
        records,
      });
      if (resource === Resource.transactions) {
        return {
          next: validateCursor(data.next, parent, cursor, floor),
          records,
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
      if (page < totalPages && !(paged.includes(resource) && records.length)) {
        throw new Error("PAGINATION_UNDOCUMENTED_OR_INCOMPLETE");
      }
      return {
        next: page < totalPages ? String(page + 1) : null,
        records,
        total,
      };
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

// Persist cooldowns, timeouts and identity failures as successful step envelopes.
// Throw outside step.do so Workflow retry does not repeat those source requests.
export function providerRetries(steps: Steps): Steps {
  return {
    async do<T extends StepValue<T>>(
      name: string,
      callback: () => Promise<T>,
    ): Promise<T> {
      const outcome = await steps.do(`${name}-attempt-0`, async () => {
        const { data, error } = await tryCatch(callback);
        if (!error) {
          return { kind: "success" as const, value: data };
        }
        if (
          ["SOURCE_IDENTITY_MISMATCH", "SOURCE_SELECTION_MISMATCH"].includes(
            error.message,
          )
        ) {
          return { kind: "invalid" as const, message: error.message };
        }
        if (
          !(
            error instanceof Fault &&
            [FaultCode.UPSTREAM_RATE_LIMIT, FaultCode.UPSTREAM_TIMEOUT].some(
              (code) => code === error.code,
            )
          )
        ) {
          throw error;
        }
        return {
          code: error.code,
          kind: "stopped" as const,
          retryAfterSeconds: error.details?.retryAfterSeconds ?? 0,
        };
      });
      if (outcome.kind === "success") {
        return outcome.value;
      }
      if (outcome.kind === "invalid") {
        throw new Error(outcome.message);
      }
      const fault = new Fault(outcome.code);
      fault.details = { retryAfterSeconds: outcome.retryAfterSeconds };
      throw fault;
    },
    sleep: (name, duration) => steps.sleep(name, duration),
  };
}
