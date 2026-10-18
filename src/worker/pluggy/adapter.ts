import { PluggyCredentialsSchema } from "../../domain";
import type { AccountSource } from "../account";
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
          readItem: (itemId: string) => readItem(authenticated, itemId),
          token: (itemId?: string) => connectToken(authenticated, itemId),
        };
      });
    },
    configured: configured.success,
  };
  return {
    account,
    financialSource() {
      return Promise.resolve().then(() =>
        financialSource(new PersonalPluggyClient(credentials())),
      );
    },
    async readAccount(accountId: string) {
      return await readAccount(
        new PersonalPluggyClient(credentials()),
        accountId,
      );
    },
  };
}
