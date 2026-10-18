import type { OAuthHelpers } from "@cloudflare/workers-oauth-provider";

export async function revokeAssistantGrants(
  provider: Pick<OAuthHelpers, "listUserGrants" | "revokeGrant">,
) {
  const grants: string[] = [];
  let cursor: string | undefined;
  // Read all pages before deleting: revocation may change the provider's cursor.
  do {
    const page = await provider.listUserGrants("owner", {
      limit: 20,
      ...(cursor && { cursor }),
    });
    grants.push(...page.items.map((grant) => grant.id));
    ({ cursor } = page);
  } while (cursor);
  for (const grant of grants) {
    await provider.revokeGrant(grant, "owner");
  }
}
