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
  await grants.reduce(
    (previous, grant) =>
      previous.then(() => provider.revokeGrant(grant, "owner")),
    Promise.resolve(),
  );
}

export async function assistantGrants(
  provider: Pick<OAuthHelpers, "listUserGrants" | "lookupClient">,
  cursor?: string,
) {
  const page = await provider.listUserGrants("owner", {
    limit: 20,
    ...(cursor && { cursor }),
  });
  const clientIds = [...new Set(page.items.map((g) => g.clientId))];
  const clients = await Promise.all(
    clientIds.map(async (id) => ({
      id,
      info: await provider.lookupClient(id),
    })),
  );
  return {
    grantCursor: page.cursor ?? null,
    grants: page.items.map((grant) => ({
      clientId: grant.clientId,
      clientName:
        clients.find((c) => c.id === grant.clientId)?.info?.clientName ??
        grant.clientId,
      createdAt: grant.createdAt,
      expiresAt: grant.expiresAt ?? null,
      id: grant.id,
      scope: grant.scope,
    })),
  };
}

export async function revokeAssistantGrant(
  provider: Pick<OAuthHelpers, "listUserGrants" | "revokeGrant">,
  id: string,
) {
  async function find(cursor?: string): Promise<boolean> {
    const page = await provider.listUserGrants("owner", {
      limit: 100,
      ...(cursor && { cursor }),
    });
    if (page.items.some((grant) => grant.id === id)) {
      return true;
    }
    return page.cursor ? find(page.cursor) : false;
  }
  if (!(await find())) {
    throw new Error("NOT_FOUND");
  }
  await provider.revokeGrant(id, "owner");
}
