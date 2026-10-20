import { PluggyCredentialsSchema } from "../../domain";
import { PersonalPluggyClient } from "./client.adapter";
import { connectToken, financialSource } from "./source";
export function createPluggyAdapter(input: {
  clientId: string | undefined;
  clientSecret: string | undefined;
}) {
  const parsed = PluggyCredentialsSchema.safeParse(input);
  let current: PersonalPluggyClient | undefined;
  function client() {
    if (!parsed.success) {
      throw new Error("NOT_CONFIGURED");
    }
    current ??= new PersonalPluggyClient(parsed.data);
    return current;
  }
  return {
    accounts: (id: string) => financialSource(client()).accounts(id),
    configured: parsed.success,
    connection: (id: string) => financialSource(client()).connection(id),
    token: (id?: string) => connectToken(client(), id),
    transactions: (id: string, cursor: string | null) =>
      financialSource(client()).transactions(id, cursor),
  };
}
