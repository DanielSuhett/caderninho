import { z } from "zod/v4";

import {
  AccountConnectTokenSchema,
  AccountResponseSchema,
  WizardIssue,
  WizardIssueSchema,
} from "../../contracts";
import {
  type HttpFailureContext,
  HttpFailureKind,
  httpClient,
  requestJson,
  tryCatch,
} from "../../shared";
import type { AccountApi, CommandContext } from "./account.types";

export class AccountRequestError extends Error {
  readonly issue: WizardIssue;
  constructor(issue: WizardIssue) {
    super("Account request failed");
    this.issue = issue;
  }
}

const AcceptedSchema = z.object({ ok: z.literal(true) });
const FailureSchema = z.object({ issue: WizardIssueSchema });

const sessionFailures = new Set<HttpFailureKind>([
  HttpFailureKind.unauthorized,
  HttpFailureKind.forbidden,
  HttpFailureKind.redirect,
]);

async function accountFailure({ failure, request }: HttpFailureContext) {
  if (sessionFailures.has(failure.kind)) {
    return new AccountRequestError(WizardIssue.session);
  }
  const { data, error } = await tryCatch(() => request.json(FailureSchema));
  if (error) {
    return new AccountRequestError(WizardIssue.unknown);
  }
  return new AccountRequestError(data.issue);
}

export function createAccountApi(
  origin = location.origin,
  fetcher: typeof fetch = fetch,
): AccountApi {
  const http = httpClient.extend({ fetch: fetcher });
  async function request<T>({
    path,
    signal,
    schema,
    command: mutation,
  }: {
    path: string;
    signal: AbortSignal;
    schema: z.ZodType<T>;
    command?: { csrf: string; itemId?: string };
  }): Promise<T> {
    return await requestJson({
      client: http,
      input: new URL(`/api/account${path}`, origin),
      onHttpFailure: accountFailure,
      options: {
        method: mutation ? "POST" : "GET",
        ...(mutation && { json: mutation }),
        signal,
        totalTimeout: mutation ? 45_000 : 15_000,
      },
      schema,
    });
  }
  const command = <T>({
    action,
    context,
    schema,
    itemId,
  }: {
    action: string;
    context: CommandContext;
    schema: z.ZodType<T>;
    itemId?: string;
  }) =>
    request({
      command: { csrf: context.csrf, ...(itemId !== undefined && { itemId }) },
      path: `/${action}`,
      schema,
      signal: context.signal,
    });
  const maintain = async (input: {
    action: string;
    context: CommandContext;
    itemId?: string;
  }) => {
    await command({ ...input, schema: AcceptedSchema });
  };
  return {
    connectItem: (context: CommandContext, itemId: string) =>
      maintain({ action: "items", context, itemId }),
    connectToken: (context: CommandContext, itemId?: string) =>
      command({
        action: "connect-token",
        context,
        schema: AccountConnectTokenSchema,
        ...(itemId && { itemId }),
      }),
    disconnectAssistants: (context: CommandContext) =>
      maintain({ action: "disconnect-assistants", context }),
    logout: (context: CommandContext) =>
      maintain({ action: "logout", context }),
    pauseSync: (context: CommandContext) =>
      maintain({ action: "pause", context }),
    read: (signal: AbortSignal) =>
      request({ path: "", schema: AccountResponseSchema, signal }),
    requestSync: (context: CommandContext) =>
      maintain({ action: "sync", context }),
    resumeSync: (context: CommandContext) =>
      maintain({ action: "resume", context }),
  };
}
