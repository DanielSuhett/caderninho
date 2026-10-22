import { Fault, FaultCode, PluggyCredentialsSchema } from "../../domain";
import type { CredentialVault } from "./entity";
// Server-only KV; separate from public metadata and from the OAuth key namespace.
// Each immutable version is immediately addressable; a temporarily unavailable KV
// version fails closed instead of falling back to another person's credentials.
export function createCredentialVault(kv: KVNamespace): CredentialVault {
  return {
    async get(ref) {
      const stored = await kv.get(`pluggy-credentials:${ref}`, "json");
      if (stored === null) {
        throw new Fault(FaultCode.UPSTREAM_UNAVAILABLE);
      }
      return PluggyCredentialsSchema.parse(stored);
    },
    async put(credentials) {
      const ref = crypto.randomUUID();
      await kv.put(`pluggy-credentials:${ref}`, JSON.stringify(credentials));
      return ref;
    },
  };
}
