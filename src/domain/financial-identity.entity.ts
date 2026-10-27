import { PERSONAL_CONNECTOR_ID } from "./connection.entity";

export interface Institution {
  id: string;
  logoUrl: string | null;
  name: string;
}

export interface FinancialIdentity {
  cardBrand: string | null;
  institution: Institution | null;
}

// A transport connector is not necessarily a financial institution. In particular,
// Meu Pluggy authenticates a proxy; its id must never group unrelated banks.
export function financialIdentity(input: {
  identity?: FinancialIdentity | null | undefined;
  institution?: Institution | null | undefined;
}): FinancialIdentity {
  const institution = input.institution ?? input.identity?.institution ?? null;
  return {
    cardBrand: input.identity?.cardBrand ?? null,
    institution:
      institution?.id === String(PERSONAL_CONNECTOR_ID) ? null : institution,
  };
}

export function connectorInstitution(connector?: {
  id: number | string;
  name?: string | null | undefined;
  imageUrl?: string | null | undefined;
}): Institution | null {
  if (!connector || String(connector.id) === String(PERSONAL_CONNECTOR_ID)) {
    return null;
  }
  return {
    id: String(connector.id),
    logoUrl: institutionLogoUrl(connector.imageUrl),
    name: connector.name ?? "Instituição",
  };
}

const nonWord = /[^a-z0-9]+/;
const diacritics = /\p{M}/gu;
const digits = /^\d+$/;
function nameTokens(value: string) {
  return new Set(
    value
      .normalize("NFD")
      .replace(diacritics, "")
      .toLowerCase()
      .split(nonWord)
      .filter((token) => token.length > 1 && !digits.test(token)),
  );
}

// Meu Pluggy hides the bank behind its own connector, but account names and
// investment institutions still name it. Match those names against the official
// connector catalog using only tokens rare in the catalog, so generic words such
// as "banco" or "conta" never decide. Evidence pointing to different banks, or to
// none, leaves the institution unknown.
export function detectInstitution(input: {
  catalog: Institution[];
  evidence: string[];
}): Institution | null {
  const entries = input.catalog.map((institution) => ({
    institution,
    tokens: nameTokens(institution.name),
  }));
  const frequency = new Map<string, number>();
  for (const entry of entries) {
    for (const token of entry.tokens) {
      frequency.set(token, (frequency.get(token) ?? 0) + 1);
    }
  }
  const common = Math.max(2, Math.ceil(entries.length * 0.05));
  const distinctive = (token: string) => (frequency.get(token) ?? 0) <= common;
  const support = new Map<(typeof entries)[number], number>();
  const matched = new Map<(typeof entries)[number], Set<string>>();
  for (const text of input.evidence) {
    const tokens = nameTokens(text);
    for (const entry of entries) {
      const shared = [...entry.tokens].filter(
        (token) => distinctive(token) && tokens.has(token),
      );
      if (!shared.length) {
        continue;
      }
      support.set(entry, (support.get(entry) ?? 0) + 1);
      const known = matched.get(entry) ?? new Set<string>();
      for (const token of shared) {
        known.add(token);
      }
      matched.set(entry, known);
    }
  }
  const best = Math.max(0, ...support.values());
  if (!best) {
    return null;
  }
  const leaders = [...support]
    .filter(([, count]) => count === best)
    .map(([entry]) => entry);
  const [first] = leaders;
  const family = [...(first ? (matched.get(first) ?? []) : [])].filter(
    (token) => leaders.every((entry) => matched.get(entry)?.has(token)),
  );
  if (!family.length) {
    return null;
  }
  const coverage = (entry: (typeof entries)[number]) =>
    (matched.get(entry)?.size ?? 0) / entry.tokens.size;
  const [winner] = leaders.sort(
    (left, right) =>
      coverage(right) - coverage(left) ||
      left.tokens.size - right.tokens.size ||
      left.institution.id.localeCompare(right.institution.id),
  );
  return winner?.institution ?? null;
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

// Bank logos are served by the deploy itself, one SVG per COMPE.
const bundledLogo = /^\/bancos\/\d{3}\.svg$/;

export function institutionLogoUrl(value: string | null | undefined) {
  if (!value) {
    return null;
  }
  if (bundledLogo.test(value)) {
    return value;
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
