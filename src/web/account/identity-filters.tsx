import { LinkButton } from "@cloudflare/kumo/components/button";
import { XIcon } from "@phosphor-icons/react";
import { createContext, useContext } from "react";

import { cardBrandKey, type FinancialIdentity } from "../../domain";

export const AvatarFilterRoute = createContext<string | null>(null);
type FilterKey = "person" | "institutionId" | "cardBrand";
const financialPaths = new Set([
  "/account",
  "/account/transactions",
  "/account/cards",
  "/account/investments",
  "/demo",
  "/demo/transactions",
  "/demo/cards",
  "/demo/investments",
]);

const trailingSlash = /\/$/;

export function avatarFilterHref(route: string, key: FilterKey, value: string) {
  const [pathname = "", search = ""] = route.split("?");
  const path = pathname.replace(trailingSlash, "");
  if (!(value && financialPaths.has(path))) {
    return null;
  }
  const params = new URLSearchParams(search);
  const normalized = key === "cardBrand" ? cardBrandKey(value) : value;
  if (!normalized) {
    return null;
  }
  const current =
    key === "cardBrand" ? cardBrandKey(params.get(key)) : params.get(key);
  const selected = current === normalized;
  if (selected) {
    params.delete(key);
  } else {
    params.set(key, normalized);
  }
  params.delete("cursor");
  params.delete("accountId");
  return { href: `${path}${params.size ? `?${params}` : ""}`, selected };
}

export function useAvatarFilter(
  key: FilterKey,
  value: string | null | undefined,
  label: string,
  enabled: boolean,
) {
  const route = useContext(AvatarFilterRoute);
  const target =
    enabled && route && value ? avatarFilterHref(route, key, value) : null;
  return target
    ? {
        ...target,
        label: `${target.selected ? "Remover filtro de" : "Filtrar por"} ${label}`,
      }
    : {};
}

export function cardBrandLabel(value: string) {
  const labels: Record<string, string | undefined> = {
    AMERICANEXPRESS: "American Express",
    DINERS: "Diners Club",
    DISCOVER: "Discover",
    ELO: "Elo",
    HIPER: "Hiper",
    HIPERCARD: "Hipercard",
    JCB: "JCB",
    MAESTRO: "Maestro",
    MASTERCARD: "Mastercard",
    UNIONPAY: "UnionPay",
    VISA: "Visa",
  };
  return labels[cardBrandKey(value)] ?? value;
}

export function IdentityFilterChips({
  params,
  identities,
}: {
  params: URLSearchParams;
  identities: Array<{ identity?: FinancialIdentity | null | undefined }>;
}) {
  const route = useContext(AvatarFilterRoute);
  if (!route) {
    return null;
  }
  const institutionId = params.get("institutionId");
  const brand = params.get("cardBrand");
  const labels = [
    ...(institutionId
      ? [
          {
            key: "institutionId",
            label:
              identities.find(
                (item) => item.identity?.institution?.id === institutionId,
              )?.identity?.institution?.name ?? "Instituição selecionada",
          },
        ]
      : []),
    ...(brand ? [{ key: "cardBrand", label: cardBrandLabel(brand) }] : []),
  ];
  return labels.map((item) => {
    const target = new URLSearchParams(params);
    target.delete(item.key);
    target.delete("cursor");
    const path = route.split("?")[0] ?? "";
    return (
      <LinkButton
        aria-label={`Remover filtro de ${item.label}`}
        className="identity-filter-chip"
        href={`${path}${target.size ? `?${target}` : ""}`}
        key={item.key}
        variant="secondary"
      >
        {item.label}
        <XIcon
          aria-hidden
          size={16}
        />
      </LinkButton>
    );
  });
}
