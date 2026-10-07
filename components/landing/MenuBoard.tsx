"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useState } from "react";
import { money, money0 } from "@/lib/format";
import { CATEGORIES, ONLINE_TIER, casePrice, unitPrice } from "@/lib/logic";
import type { Category, Product } from "@/lib/types";
import { EASE, FOOD } from "./motifs";

/** What the store calls each category on the public page. */
const LABEL: Partial<Record<Category, string>> = { "Tocino & longganisa": "Breakfast", Chiller: "Chilled" };

/** One line on what each kind of product is for, from the buyer's side. */
const FOR: Record<Category, string> = {
  Dimsum: "Steam and serve. Siopao, siomai and the rest of the dimsum counter.",
  Streetfood: "Fry, skewer and sell: fish balls, kikiam, isaw, barbecue and more.",
  "Tocino & longganisa": "The silog plate: cured, marinated and ready for the pan.",
  Pork: "Whole liempo and pata, priced by the kilo.",
  Poultry: "Chicken wings and leg quarters.",
  Seafood: "Bangus, shrimp and squid, frozen and portioned.",
  Desserts: "Ice cream by the tub, leche flan and buchi for after.",
  Bakery: "Pandesal dough, ensaymada and mantou.",
  Fries: "Frozen fries for the fryer.",
  Chiller: "Kept cold, not frozen: cheese, quail eggs and ube halaya.",
};

/** The drawing that stands in for each product until the client's photos arrive. */
function drawingFor(p: Product) {
  const n = p.name.toLowerCase();
  const rules: [RegExp, string][] = [
    [/siopao|kuapao|mantou|pandesal|ensaymada/, "Siopao"],
    [/siomai/, "Siomai"],
    [/hakaw|machang/, "Hakaw"],
    [/ball|isaw|barbecue/, "Fish balls"],
    [/kikiam|hotdog|embutido|lumpia/, "Kikiam"],
    [/longganisa/, "Longganisa"],
    [/tocino|tapa|liempo|pata|spareribs/, "Tocino"],
    [/turon/, "Turon"],
    [/chicken|wing/, "Drumstick"],
    [/bangus|tempura|shrimp|squid/, "Fish"],
    [/ice cream/, "Ice cream"],
    [/flan|halaya/, "Flan"],
    [/fries/, "Fries"],
    [/cheese|keso/, "Cheese"],
    [/buchi/, "Buchi"],
    [/egg/, "Egg"],
  ];
  return rules.find(([re]) => re.test(n))?.[1] ?? "Siomai";
}

const PER: Record<string, string> = { piece: "a piece", stick: "a stick", kg: "a kg", gallon: "a gallon" };

export function MenuBoard({ products }: { products: Product[] }) {
  const still = useReducedMotion() ?? false;
  const cats = CATEGORIES.filter((c) => products.some((p) => p.category === c));
  const [cat, setCat] = useState<Category>(cats[0]);
  const shown = products.filter((p) => p.category === cat);

  return (
    <div>
      <div className="lp-menu-tabs" role="tablist" aria-label="Kinds of product">
        {cats.map((c) => (
          <button key={c} type="button" role="tab" aria-selected={cat === c} className="lp-menu-tab" onClick={() => setCat(c)}>
            {LABEL[c] ?? c}
            <span className="lp-menu-count">{products.filter((p) => p.category === c).length}</span>
          </button>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap items-end justify-between gap-4" role="tabpanel" aria-label={LABEL[cat] ?? cat}>
        <p className="max-w-[48ch] text-[1.1rem] text-[var(--lp-ink-2)]">{FOR[cat]}</p>
        <Link href={`/shop?cat=${encodeURIComponent(cat)}`} className="lp-btn lp-btn-ink">
          Shop {(LABEL[cat] ?? cat).toLowerCase()} online
        </Link>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.ul
          key={cat}
          className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          initial={still ? false : "hidden"}
          animate="shown"
          exit={still ? undefined : { opacity: 0, transition: { duration: 0.12 } }}
          variants={{ shown: { transition: { staggerChildren: 0.05 } } }}
        >
          {shown.map((p, i) => {
            const each = unitPrice(p, ONLINE_TIER);
            return (
              <motion.li
                key={p.sku}
                className="lp-case lp-item"
                variants={still ? undefined : { hidden: { opacity: 0, y: 24 }, shown: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE } } }}
              >
                <div className={`lp-item-art ${i % 3 === 1 ? "lp-item-art-red" : i % 3 === 2 ? "lp-item-art-ink" : ""}`} aria-hidden>
                  <svg viewBox="0 0 120 120" className="lp-item-food">
                    {FOOD[drawingFor(p)]}
                  </svg>
                  <span className="lp-item-pack">{p.pack}</span>
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <h3 className="lp-display text-[1.2rem] leading-tight">{p.name}</h3>
                  <div className="mt-auto pt-4">
                    <div className="flex items-baseline gap-1.5">
                      <span className="lp-display text-[1.75rem] leading-none">{money0(casePrice(p, ONLINE_TIER))}</span>
                      <span className="text-[0.9rem] text-[var(--lp-ink-2)]">a {p.catchWeight ? "case, about" : p.unit}{p.catchWeight ? ` ${p.caseKg} kg` : ""}</span>
                    </div>
                    {each && (
                      <div className="mt-1 text-[0.95rem] font-semibold text-[#b3181e]">
                        {p.catchWeight ? "" : "About "}
                        {money(each.amount)} {PER[each.per]}
                      </div>
                    )}
                  </div>
                </div>
              </motion.li>
            );
          })}
        </motion.ul>
      </AnimatePresence>
    </div>
  );
}
