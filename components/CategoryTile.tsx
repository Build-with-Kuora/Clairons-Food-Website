import { Beef, CakeSlice, CookingPot, Croissant, Drumstick, Fish, Ham, IceCreamCone, Milk, Popcorn, UtensilsCrossed } from "lucide-react";
import type { Category } from "@/lib/types";
import { cx } from "./ui";

/** One icon per product category. There are no product photos yet, so this stands in for one. */
export const CATEGORY_ICON: Record<Category, typeof Beef> = {
  Dimsum: CookingPot,
  Streetfood: UtensilsCrossed,
  "Tocino & longganisa": Ham,
  Pork: Beef,
  Poultry: Drumstick,
  Seafood: Fish,
  Desserts: IceCreamCone,
  Bakery: Croissant,
  Fries: Popcorn,
  Chiller: Milk,
};

/** Soft red tile (or translucent white on a dark card) with the category icon, sized for table rows (sm), lists (md) or product cards (lg). */
export function CategoryTile({ category, size = "md", onDark = false, className }: { category: Category; size?: "sm" | "md" | "lg"; onDark?: boolean; className?: string }) {
  const Icon = CATEGORY_ICON[category] ?? CakeSlice;
  const box = size === "sm" ? "h-8 w-8 rounded-lg" : size === "md" ? "h-10 w-10 rounded-xl" : "h-24 w-full rounded-xl";
  const icon = size === "sm" ? 16 : size === "md" ? 19 : 38;
  return (
    <span className={cx("grid shrink-0 place-items-center", onDark ? "bg-white/10 text-white" : "bg-brand-bg text-brand", box, className)} aria-hidden>
      <Icon size={icon} strokeWidth={1.8} />
    </span>
  );
}
