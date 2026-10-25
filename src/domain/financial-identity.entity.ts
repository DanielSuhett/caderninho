export interface FinancialIdentity {
  cardBrand: string | null;
  institution: { id: string; logoUrl: string | null; name: string } | null;
}

export function institutionLogoUrl(value: string | null | undefined) {
  if (!value) {
    return null;
  }
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.hostname !== "cdn.pluggy.ai" ||
      url.username ||
      url.password ||
      url.port ||
      url.search ||
      url.hash ||
      !url.pathname.startsWith("/assets/connector-icons/") ||
      url.pathname.endsWith("/sandbox.svg")
    ) {
      return null;
    }
    return url.href;
  } catch {
    return null;
  }
}
