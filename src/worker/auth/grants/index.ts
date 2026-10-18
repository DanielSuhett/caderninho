import type { OAuthHelpers } from "@cloudflare/workers-oauth-provider";

export async function revokeAssistantGrants(
  provider: Pick<OAuthHelpers, "listUserGrants" | "revokeGrant">,
) {
  const grants: string[] = [];
  // Read all pages before deleting: revocation may change the provider's cursor.
  async function readPage(cursor?: string): Promise<void> {
    const page = await provider.listUserGrants("owner", {
      limit: 20,
      ...(cursor && { cursor }),
    });
    grants.push(...page.items.map((grant) => grant.id));
    if (page.cursor) {
      await readPage(page.cursor);
    }
  }
  await readPage();
  await grants.reduce(async (previous, grant) => {
    await previous;
    await provider.revokeGrant(grant, "owner");
  }, Promise.resolve());
}
