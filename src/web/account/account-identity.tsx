import { BankIcon, CreditCardIcon } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";

import {
  cardBrandKey,
  type FinancialIdentity,
  institutionLogoUrl,
  type Person,
  type PositionBank,
} from "../../domain";
import { type AvatarPart, AvatarStack } from "./avatar-stack";
import { cardBrandLabel, useAvatarFilter } from "./identity-filters";
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
export interface AccountAppearance {
  identity?: FinancialIdentity | null | undefined;
  name: string;
  type?: string | undefined;
}
function AccountLogo({ src, credit }: { src: string | null; credit: boolean }) {
  const [failed, setFailed] = useState<string | null>(null);
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
  const Fallback = credit ? CreditCardIcon : BankIcon;
  return (
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
  );
}
export function AccountAvatar({
  account,
  person,
  filterable = true,
}: {
  account: AccountAppearance;
  person?: Person | undefined;
  filterable?: boolean;
}) {
  const bank = institutionLogoUrl(account.identity?.institution?.logoUrl);
  const brand = account.identity?.cardBrand;
  const card = brand ? (brands[cardBrandKey(brand)] ?? null) : null;
  const credit = account.type === "CREDIT" || !!brand;
  const description =
    [
      person?.name,
      account.identity?.institution?.name,
      account.identity?.cardBrand,
    ]
      .filter(Boolean)
      .join(" · ") || account.name;
  const personFilter = useAvatarFilter(
    "person",
    person?.id,
    person?.name ?? "",
    filterable,
  );
  const bankFilter = useAvatarFilter(
    "institutionId",
    account.identity?.institution?.id,
    account.identity?.institution?.name ?? "",
    filterable,
  );
  const brandFilter = useAvatarFilter(
    "cardBrand",
    brand,
    brand ? cardBrandLabel(brand) : "",
    filterable,
  );
  const items: AvatarPart[] = [];
  if (person) {
    items.push({
      content: <PersonAvatar person={person} />,
      key: "person",
      label: person.name,
      ...personFilter,
    });
  }
  const institution = account.identity?.institution;
  if (institution || !brand) {
    items.push({
      content: (
        <AccountLogo
          credit={bank ? false : credit}
          src={bank}
        />
      ),
      key: "bank",
      label: institution?.name ?? account.name,
      ...bankFilter,
    });
  }
  if (brand) {
    items.push({
      content: (
        <AccountLogo
          credit
          src={card}
        />
      ),
      key: "brand",
      label: cardBrandLabel(brand),
      ...brandFilter,
    });
  }
  return (
    <AvatarStack
      className="account-avatar-stack"
      items={items}
      label={description}
    />
  );
}
const MAX_BANK_AVATARS = 3;
// Accumulated rows show the banks behind them the way the panel shows people:
// one symbol for one bank, overlapping symbols for several.
export function BankAvatar({ banks }: { banks: PositionBank[] }) {
  const items: AvatarPart[] = banks.slice(0, MAX_BANK_AVATARS).map((bank) => ({
    content: (
      <AccountLogo
        credit={false}
        src={institutionLogoUrl(bank.logoUrl)}
      />
    ),
    key: bank.id,
    label: bank.name,
  }));
  return (
    <AvatarStack
      className="account-avatar-stack"
      items={items}
      label={banks.map((bank) => bank.name).join(", ")}
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
        filterable={false}
        person={person}
      />
      <span>{account.name}</span>
    </span>
  );
}
