import { z } from "zod/v4";

import {
  CredentialsSchema,
  type Credentials,
} from "#contracts/wizard-contract.ts";
import { parseJson } from "#shared/json.ts";
import { tryCatch } from "#shared/result.ts";
import type { Bindings } from "#worker/bindings.ts";
import { statement } from "#worker/database.ts";
import { pluggyClient } from "#worker/pluggy/source.ts";

const EnvelopeSchema = z
  .object({ v: z.literal(1), iv: z.string(), data: z.string() })
  .strict();
function encode(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes));
}
function decode(value: string) {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}
async function key(secret: string | undefined) {
  if (!secret) throw new Error("CREDENTIAL_KEY_REQUIRED");
  const bytes = decode(secret);
  if (bytes.length !== 32) throw new Error("CREDENTIAL_KEY_INVALID");
  return crypto.subtle.importKey("raw", bytes, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}
export async function sealCredentials(
  secret: string | undefined,
  principal: string,
  credentials: Credentials,
) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
      additionalData: new TextEncoder().encode(principal),
    },
    await key(secret),
    new TextEncoder().encode(
      JSON.stringify(CredentialsSchema.parse(credentials)),
    ),
  );
  return JSON.stringify({
    v: 1,
    iv: encode(iv),
    data: encode(new Uint8Array(encrypted)),
  });
}
export async function openCredentials(
  secret: string | undefined,
  principal: string,
  envelope: string,
) {
  const stored = EnvelopeSchema.parse(parseJson(envelope));
  const clear = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: decode(stored.iv),
      additionalData: new TextEncoder().encode(principal),
    },
    await key(secret),
    decode(stored.data),
  );
  return CredentialsSchema.parse(parseJson(new TextDecoder().decode(clear)));
}
export async function credentialsFor(
  env: Bindings,
  principal: string,
  requireEnabled = true,
) {
  const envelope = await statement(
    env.DB,
    "SELECT envelope FROM pluggy_credentials WHERE principal=?" +
      (requireEnabled ? " AND enabled=1" : ""),
    principal,
  ).first("envelope");
  if (!envelope) throw new Error("PLUGGY_ACCOUNT_NOT_CONFIGURED");
  return openStoredCredentials(env, principal, z.string().parse(envelope));
}
export async function openStoredCredentials(
  env: Bindings,
  principal: string,
  envelope: string,
) {
  const current = await tryCatch(
    openCredentials(env.CREDENTIAL_KEY, principal, envelope),
  );
  if (!current.error) return current.data;
  if (!env.CREDENTIAL_PREVIOUS_KEY)
    throw new Error("CREDENTIAL_VAULT_UNAVAILABLE");
  const previous = await tryCatch(
    openCredentials(env.CREDENTIAL_PREVIOUS_KEY, principal, envelope),
  );
  if (previous.error) throw new Error("CREDENTIAL_VAULT_UNAVAILABLE");
  return previous.data;
}

// Called only by the authenticated owner's CSRF-protected account action.
// Keep old backups and the previous key until the operator verifies restoration.
export async function rotateCredentials(env: Bindings, principal: string) {
  if (
    !env.CREDENTIAL_PREVIOUS_KEY ||
    env.CREDENTIAL_PREVIOUS_KEY === env.CREDENTIAL_KEY
  )
    throw new Error("CREDENTIAL_ROTATION_NOT_CONFIGURED");
  const envelope = z
    .string()
    .parse(
      await statement(
        env.DB,
        "SELECT envelope FROM pluggy_credentials WHERE principal=?",
        principal,
      ).first("envelope"),
    );
  const current = await tryCatch(
    openCredentials(env.CREDENTIAL_KEY, principal, envelope),
  );
  if (!current.error) return;
  const credentials = await openStoredCredentials(env, principal, envelope);
  const replacement = await sealCredentials(
    env.CREDENTIAL_KEY,
    principal,
    credentials,
  );
  const written = await statement(
    env.DB,
    "UPDATE pluggy_credentials SET envelope=? WHERE principal=? AND envelope=?",
    replacement,
    principal,
    envelope,
  ).run();
  if (written.meta.changes !== 1) throw new Error("CREDENTIAL_ROTATION_RETRY");
}
export async function providerFor(env: Bindings, principal: string) {
  const credentials = await credentialsFor(env, principal);
  return pluggyClient(credentials);
}
