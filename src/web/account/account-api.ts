import { z } from "zod/v4";

import {
  AccountConnectTokenSchema,
  AccountResponseSchema,
} from "@/contracts/portal-contract";
import { WizardIssue } from "@/contracts/wizard.types";
import { WizardIssueSchema } from "@/contracts/wizard-contract";
import { httpClient, requestJson } from "@/shared/http";
import { type HttpFailureContext, HttpFailureKind } from "@/shared/http.types";
import { tryCatch } from "@/shared/result";

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
    command,
  }: {
    path: string;
    signal: AbortSignal;
    schema: z.ZodType<T>;
    command?: { csrf: string; itemId?: string };
  }): Promise<T> {
    return requestJson({
      client: http,
      input: new URL(`/api/account${path}`, origin),
      options: {
        method: command ? "POST" : "GET",
        ...(command && { json: command }),
        signal,
        totalTimeout: command ? 45000 : 15000,
      },
      schema,
      onHttpFailure: accountFailure,
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
      path: `/${action}`,
      signal: context.signal,
      schema,
      command: { csrf: context.csrf, ...(itemId !== undefined && { itemId }) },
    });
  const maintain = async (input: {
    action: string;
    context: CommandContext;
    itemId?: string;
  }) => {
    await command({ ...input, schema: AcceptedSchema });
  };
  return {
    read: (signal: AbortSignal) =>
      request({ path: "", signal, schema: AccountResponseSchema }),
    connectToken: (context: CommandContext, itemId?: string) =>
      command({
        action: "connect-token",
        context,
        schema: AccountConnectTokenSchema,
        ...(itemId && { itemId }),
      }),
    connectItem: (context: CommandContext, itemId: string) =>
      maintain({ action: "items", context, itemId }),
    pauseSync: (context: CommandContext) =>
      maintain({ action: "pause", context }),
    resumeSync: (context: CommandContext) =>
      maintain({ action: "resume", context }),
    requestSync: (context: CommandContext) =>
      maintain({ action: "sync", context }),
    disconnectAssistants: (context: CommandContext) =>
      maintain({ action: "disconnect-assistants", context }),
    logout: (context: CommandContext) =>
      maintain({ action: "logout", context }),
  };
}
