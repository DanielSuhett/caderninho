import { Tooltip } from "@cloudflare/kumo/components/tooltip";
import { BankIcon, CreditCardIcon } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";

import {
  type FinancialIdentity,
  institutionLogoUrl,
  type Person,
} from "../../domain";
import { PersonAvatar } from "./person-identity";

const brands: Record<string, string | undefined> = {
  AMERICANEXPRESS: new URL("../assets/card-brands/amex.svg", import.meta.url)
    .href,
  AMEX: new URL("../assets/card-brands/amex.svg", import.meta.url).href,
  DINERS: new URL("../assets/card-brands/diners.svg", import.meta.url).href,
  DINERSCLUB: new URL("../assets/card-brands/diners.svg", import.meta.url).href,
  DISCOVER: new URL("../assets/card-brands/discover.svg", import.meta.url).href,
  ELO: new URL("../assets/card-brands/elo.svg", import.meta.url).href,
  HIPER: new URL("../assets/card-brands/hiper.svg", import.meta.url).href,
  HIPERCARD: new URL("../assets/card-brands/hipercard.svg", import.meta.url)
    .href,
  JCB: new URL("../assets/card-brands/jcb.svg", import.meta.url).href,
  MAESTRO: new URL("../assets/card-brands/maestro.svg", import.meta.url).href,
  MASTERCARD: new URL("../assets/card-brands/mastercard.svg", import.meta.url)
    .href,
  UNIONPAY: new URL("../assets/card-brands/unionpay.svg", import.meta.url).href,
  VISA: new URL("../assets/card-brands/visa.svg", import.meta.url).href,
};
const brandSeparators = /[\s_-]/g;
export interface AccountAppearance {
  identity?: FinancialIdentity | null | undefined;
  name: string;
  type?: string | undefined;
}
export function accountLogo(account: AccountAppearance) {
  const brand = account.identity?.cardBrand;
  if (brand) {
    return brands[brand.toUpperCase().replace(brandSeparators, "")] ?? null;
  }
  if (account.type === "CREDIT") {
    return null;
  }
  return institutionLogoUrl(account.identity?.institution?.logoUrl);
}
export function AccountAvatar({
  account,
  person,
}: {
  account: AccountAppearance;
  person?: Person | undefined;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  const src = accountLogo(account);
  const image = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const element = image.current;
    if (!(element && src)) {
      return;
    }
    const failedImage = () => setFailed(src);
    element.addEventListener("error", failedImage);
    if (element.complete && element.naturalWidth === 0) {
      failedImage();
    }
    return () => element.removeEventListener("error", failedImage);
  }, [src]);
  const Fallback =
    account.type === "CREDIT" || account.identity?.cardBrand
      ? CreditCardIcon
      : BankIcon;
  const description =
    [
      person?.name,
      account.identity?.institution?.name,
      account.identity?.cardBrand,
    ]
      .filter(Boolean)
      .join(" · ") || account.name;
  return (
    <Tooltip
      content={description}
      render={
        <span
          aria-label={description}
          className="account-avatar-stack"
          role="img"
        >
          {!!person && (
            <span className="account-avatar-owner">
              <PersonAvatar
                person={person}
                size={32}
              />
            </span>
          )}
          <span
            aria-hidden="true"
            className="account-avatar"
          >
            {src && failed !== src ? (
              <img
                alt=""
                height={32}
                loading="lazy"
                ref={image}
                referrerPolicy="no-referrer"
                src={src}
                width={32}
              />
            ) : (
              <Fallback size={20} />
            )}
          </span>
        </span>
      }
    />
  );
}
export function AccountIdentity({
  account,
  person,
}: {
  account: AccountAppearance;
  person?: Person | undefined;
}) {
  return (
    <span className="account-identity">
      <AccountAvatar
        account={account}
        person={person}
      />
      <span>{account.name}</span>
    </span>
  );
}
