import { PluggyCredentialsSchema } from "#domain/pluggy-credentials.ts";
import type { AccountSource } from "#worker/account/account.types.ts";
import { PersonalPluggyClient } from "#worker/pluggy/client.adapter.ts";
import {
  connectToken,
  financialSource,
  readAccount,
  readItem,
} from "#worker/pluggy/source.ts";

// Request/operation scoped. Configuration is parsed once; every upstream use
// still checks the installation's application binding before creating a client.
export function createPluggyAccess(input: {
  clientId: string | undefined;
  clientSecret: string | undefined;
  authorizeApplication(clientId: string): Promise<unknown>;
}) {
  const configured = PluggyCredentialsSchema.safeParse({
    clientId: input.clientId,
    clientSecret: input.clientSecret,
  });
  async function credentials() {
    if (!configured.success) {
      throw new Error("PLUGGY_ACCOUNT_NOT_CONFIGURED");
    }
    await input.authorizeApplication(configured.data.clientId);
    return configured.data;
  }
  const account: AccountSource = {
    configured: configured.success,
    async application() {
      const authenticated = await credentials();
      return {
        clientId: authenticated.clientId,
        readItem: (itemId) => readItem(authenticated, itemId),
        token: (itemId) => connectToken(authenticated, itemId),
      };
    },
  };
  return {
    account,
    async financialSource() {
      return financialSource(new PersonalPluggyClient(await credentials()));
    },
    async readAccount(accountId: string) {
      return readAccount(
        new PersonalPluggyClient(await credentials()),
        accountId,
      );
    },
  };
}
