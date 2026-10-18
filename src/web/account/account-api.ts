import ky from "ky";
import { z } from "zod/v4";

import { AccountResponseSchema } from "#contracts/portal-contract.ts";
import {
  type WizardIssue,
  WizardIssueSchema,
} from "#contracts/wizard-contract.ts";
import { tryCatch } from "#shared/result.ts";

export class AccountRequestError extends Error {
  readonly issue: WizardIssue;
  constructor(issue: WizardIssue) {
    super("Account request failed");
    this.issue = issue;
  }
}

interface CommandContext {
  csrf: string;
  signal: AbortSignal;
}

const TokenSchema = z.object({ accessToken: z.string().min(1) });
const AcceptedSchema = z.object({ ok: z.literal(true) });
const FailureSchema = z.object({ issue: WizardIssueSchema });

// No automatic mutation retry: a lost response does not prove a rejected command.
export function createAccountApi(
  origin = location.origin,
  fetcher: typeof fetch = fetch,
) {
  async function request(
    path: string,
    signal: AbortSignal,
    command?: { csrf: string; itemId?: string },
  ) {
    const response = await ky(new URL(`/api/account${path}`, origin), {
      method: command ? "POST" : "GET",
      headers: { Accept: "application/json" },
      ...(command ? { json: command } : {}),
      signal: AbortSignal.any([
        signal,
        AbortSignal.timeout(command ? 45000 : 15000),
      ]),
      timeout: false,
      retry: 0,
      redirect: "manual",
      throwHttpErrors: false,
      fetch: fetcher,
    });
    if (
      response.status === 401 ||
      response.status === 403 ||
      response.type === "opaqueredirect" ||
      (response.status >= 300 && response.status < 400)
    ) {
      throw new AccountRequestError("session");
    }
    if (!response.ok) {
      const body = await tryCatch(response.json<unknown>());
      const failure = FailureSchema.safeParse(body.data);
      throw new AccountRequestError(
        failure.success ? failure.data.issue : "unknown",
      );
    }
    return response.json<unknown>();
  }
  const command = (
    action: string,
    context: CommandContext,
    fields: { itemId?: string } = {},
  ) => request(`/${action}`, context.signal, { csrf: context.csrf, ...fields });
  const maintain = async (
    action: string,
    context: CommandContext,
    fields?: { itemId?: string },
  ) => {
    AcceptedSchema.parse(await command(action, context, fields));
  };
  return {
    async read(signal: AbortSignal) {
      return AccountResponseSchema.parse(await request("", signal));
    },
    async connectToken(context: CommandContext, itemId?: string) {
      return TokenSchema.parse(
        await command("connect-token", context, itemId ? { itemId } : {}),
      );
    },
    async connectItem(context: CommandContext, itemId: string) {
      AcceptedSchema.parse(await command("items", context, { itemId }));
    },
    pauseSync: (context: CommandContext) => maintain("pause", context),
    resumeSync: (context: CommandContext) => maintain("resume", context),
    requestSync: (context: CommandContext) => maintain("sync", context),
    disconnectAssistants: (context: CommandContext) =>
      maintain("disconnect-assistants", context),
    logout: (context: CommandContext) => maintain("logout", context),
  };
}
