export interface FinancialIdentity {
  cardBrand: string | null;
  institution: { id: string; logoUrl: string | null; name: string } | null;
}

export interface FinancialIdentityFilter {
  cardBrand?: string | undefined;
  institutionId?: string | undefined;
}

const brandSeparators = /[\s_-]/g;
export function cardBrandKey(value: string | null | undefined) {
  const key = value?.toUpperCase().replace(brandSeparators, "") ?? "";
  if (key === "AMEX") {
    return "AMERICANEXPRESS";
  }
  return key === "DINERSCLUB" ? "DINERS" : key;
}

export function matchesFinancialIdentity(
  identity: FinancialIdentity | null | undefined,
  filter: FinancialIdentityFilter,
) {
  const brand = cardBrandKey(filter.cardBrand);
  return (
    (!filter.institutionId ||
      identity?.institution?.id === filter.institutionId) &&
    (!filter.cardBrand ||
      (!!brand && cardBrandKey(identity?.cardBrand) === brand))
  );
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
