import { z } from "zod/v4";

import { FaultCode, PluggyCredentialsSchema, Resource } from "../../domain";
import { tryCatch } from "../../shared";
import type { AccountSource } from "../account";
import { markFailure, observeSpan, Phase, SpanName } from "../observability";
import type { FinancialSource } from "../sync";
import { PersonalPluggyClient } from "./client.adapter";
import { connectToken, financialSource, readAccount, readItem } from "./source";

// Configuration is parsed once per request/operation; client creation stays lazy.
export function createPluggyAdapter(input: {
  clientId: string | undefined;
  clientSecret: string | undefined;
}) {
  const configured = PluggyCredentialsSchema.safeParse({
    clientId: input.clientId,
    clientSecret: input.clientSecret,
  });
  function credentials() {
    if (!configured.success) {
      throw new Error("PLUGGY_ACCOUNT_NOT_CONFIGURED");
    }
    return configured.data;
  }
  const account: AccountSource = {
    application() {
      return Promise.resolve().then(() => {
        const authenticated = credentials();
        return {
          readItem: (itemId: string) =>
            observeSpan(
              SpanName.source,
              () => providerResult(() => readItem(authenticated, itemId)),
              { phase: Phase.collect, resource: Resource.connections },
            ),
          token: (itemId?: string) =>
            observeSpan(
              SpanName.source,
              () => providerResult(() => connectToken(authenticated, itemId)),
              { action: "connect", phase: Phase.collect },
            ),
        };
      });
    },
    configured: configured.success,
  };
  return {
    account,
    financialSource() {
      return Promise.resolve().then(() => {
        const source = financialSource(new PersonalPluggyClient(credentials()));
        const observed: FinancialSource = {
          ids: (accountId, ids) =>
            providerResult(() => source.ids(accountId, ids)),
          page: (selection) => providerResult(() => source.page(selection)),
        };
        return observed;
      });
    },
    async readAccount(accountId: string) {
      return await observeSpan(
        SpanName.source,
        () =>
          providerResult(() =>
            readAccount(new PersonalPluggyClient(credentials()), accountId),
          ),
        { phase: Phase.collect, resource: Resource.accounts },
      );
    },
  };
}

async function providerResult<T>(callback: () => Promise<T>): Promise<T> {
  const { data, error } = await tryCatch(callback);
  if (error) {
    if (
      error instanceof z.ZodError ||
      ["SOURCE_IDENTITY_MISMATCH", "SOURCE_SELECTION_MISMATCH"].includes(
        error.message,
      )
    ) {
      markFailure(error, {
        failure: FaultCode.INVALID_RESPONSE,
        phase: SpanName.providerRead,
      });
    }
    throw error;
  }
  return data;
}
