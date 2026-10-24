import {
  ActivityIcon,
  ArrowsLeftRightIcon,
  BookOpenIcon,
  BriefcaseIcon,
  CarIcon,
  ForkKnifeIcon,
  GiftIcon,
  HeartIcon,
  HouseIcon,
  ShoppingBagIcon,
  StarIcon,
  WalletIcon,
} from "@phosphor-icons/react";
import type { ComponentType } from "react";

import type { WorkspaceCatalog } from "../../contracts";
import { CategoryIcon, type CategoryIcon as IconName } from "../../domain";

export type CategoryAppearance = Pick<
  WorkspaceCatalog["categories"][number],
  "id" | "name"
> &
  Partial<Pick<WorkspaceCatalog["categories"][number], "color" | "icon">>;

const icons: Record<
  IconName,
  ComponentType<{ size?: number; "aria-hidden"?: boolean }>
> = {
  activity: ActivityIcon,
  book: BookOpenIcon,
  briefcase: BriefcaseIcon,
  car: CarIcon,
  gift: GiftIcon,
  heart: HeartIcon,
  home: HouseIcon,
  money: WalletIcon,
  shopping: ShoppingBagIcon,
  star: StarIcon,
  transfer: ArrowsLeftRightIcon,
  utensils: ForkKnifeIcon,
};
const labels: Record<IconName, string> = {
  activity: "Atividade",
  book: "Livro",
  briefcase: "Trabalho",
  car: "Transporte",
  gift: "Presente",
  heart: "Coração",
  home: "Casa",
  money: "Finanças",
  shopping: "Compras",
  star: "Estrela",
  transfer: "Transferência",
  utensils: "Alimentação",
};
export const categoryIconOptions = Object.values(CategoryIcon).map((value) => ({
  label: labels[value],
  value,
}));
export function CategorySymbol({
  icon = "shopping",
  color = "#64748b",
  size = 20,
}: {
  icon?: IconName;
  color?: string;
  size?: number;
}) {
  const Icon = icons[icon];
  return (
    <span
      className="category-symbol"
      style={{ color }}
    >
      <Icon
        aria-hidden
        size={size}
      />
    </span>
  );
}

export function CategoryLabel({
  category,
  label,
}: {
  category?: CategoryAppearance | undefined;
  label?: string;
}) {
  return (
    <span className="category-reference">
      {!!category?.color && (
        <CategorySymbol
          color={category.color}
          icon={category.icon ?? "shopping"}
          size={16}
        />
      )}
      <span>{label ?? category?.name ?? "Categoria não identificada"}</span>
    </span>
  );
}
