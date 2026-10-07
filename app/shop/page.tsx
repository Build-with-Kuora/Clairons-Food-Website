"use client";

import { Clock3, Search, ShoppingCart, Snowflake, Truck } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState, type ReactNode } from "react";
import { ShopFrame, Stepper } from "@/components/ShopFrame";
import { cx } from "@/components/ui";
import { CART_MAX, useCart } from "@/lib/cart";
import { money } from "@/lib/format";
import { useStock } from "@/lib/hooks";
import { CATEGORIES, DROP_FEE, DROP_MIN, FUEL_FEE, ONLINE_TIER, casePrice, priceUnit } from "@/lib/logic";
import { useStore, useUi } from "@/lib/store";
import type { Category } from "@/lib/types";

/** Below this many free to sell, the card warns the shopper. */
const FEW_LEFT = 5;

export default function Shop() {
  const products = useStore((s) => s.products);
  const lines = useCart((s) => s.lines);
  const add = useCart((s) => s.add);
  const setQty = useCart((s) => s.setQty);
  const toast = useUi((s) => s.toast);
  const { rows } = useStock();
  const [q, setQ] = useState("");
  // The landing page's menu links here with ?cat= to open on that category.
  const params = useSearchParams();
  const [cat, setCat] = useState<Category | "All">(() => {
    const c = params.get("cat");
    return CATEGORIES.includes(c as Category) ? (c as Category) : "All";
  });

  const active = products.filter((p) => p.active);
  const cats = CATEGORIES.filter((c) => active.some((p) => p.category === c));
  const needle = q.trim().toLowerCase();
  const shown = active
    .filter((p) => (cat === "All" || p.category === cat) && (!needle || p.name.toLowerCase().includes(needle) || p.category.toLowerCase().includes(needle)))
    // Category order puts dimsum and streetfood first, the way the menu reads.
    .sort((a, b) => CATEGORIES.indexOf(a.category) - CATEGORIES.indexOf(b.category) || a.name.localeCompare(b.name));

  return (
    <ShopFrame>
      <section className="mb-6 overflow-hidden rounded-xl border border-line bg-panel">
        <div className="grid gap-6 p-6 md:grid-cols-[1.3fr_1fr] md:p-8">
          <div>
            <h1 className="display text-hero leading-[1.02] font-semibold md:text-hero">
              Frozen favorites, <span className="text-brand">delivered cold.</span>
            </h1>
            <p className="mt-3 max-w-[520px] text-body text-ink-2">
              Siopao, siomai, fish balls, tocino and more, made by Clairon&rsquo;s in Iloilo City and sold by the case. Order today, and our refrigerated vans and riders bring it to your door.
            </p>
          </div>
          <ul className="grid content-center gap-3 text-small">
            <Perk icon={<Truck size={18} />} title="Delivered Monday to Saturday" sub={`${money(FUEL_FEE)} delivery fee. Orders under ${money(DROP_MIN)} add ${money(DROP_FEE)}.`} />
            <Perk icon={<Snowflake size={18} />} title="Kept frozen all the way" sub="Ref vans hold −15°C or colder, and every drop is logged." />
            <Perk icon={<Clock3 size={18} />} title="Pay your way" sub="GCash, card, or cash on delivery." />
          </ul>
        </div>
      </section>

      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative md:w-72">
          <Search size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-3" />
          <input className="input pl-10" placeholder="Search siomai, tocino…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search products" />
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1 scroll-thin md:pb-0">
          {(["All", ...cats] as const).map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              aria-pressed={cat === c}
              className={cx(
                "h-8 shrink-0 cursor-pointer rounded-full border px-3 text-caption font-semibold",
                cat === c ? "border-ink bg-ink text-white" : "border-line bg-panel text-ink-2 hover:border-line-2",
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="rounded-xl border border-line bg-panel px-4 py-10 text-center text-body text-ink-3">No products match. Try another word or category.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {shown.map((p) => {
            const left = rows.get(p.sku)?.available ?? 0;
            const inCart = lines.find((l) => l.sku === p.sku)?.qty ?? 0;
            const price = p.price[ONLINE_TIER];
            return (
              <article key={p.sku} className="flex flex-col rounded-xl border border-line bg-panel p-4">
                <div className="text-caption font-semibold tracking-[0.06em] text-ink-3 uppercase">{p.category}</div>
                <h2 className="mt-1 text-lead leading-snug font-semibold">{p.name}</h2>
                <p className="mt-0.5 text-small text-ink-3">
                  Per {p.unit}: {p.pack}
                </p>
                <div className="mt-auto pt-4">
                  <div className="flex items-baseline gap-1">
                    <span className="display text-heading leading-none font-semibold">{money(price)}</span>
                    <span className="text-caption text-ink-3">/{priceUnit(p)}</span>
                  </div>
                  {p.catchWeight && <p className="text-caption text-ink-3">About {money(casePrice(p, ONLINE_TIER))} a {p.unit}, billed by weight</p>}
                  <p className={cx("mt-1 text-caption font-semibold", left === 0 ? "text-bad" : left <= FEW_LEFT ? "text-warn" : "text-good")}>
                    {left === 0 ? "Out of stock" : left <= FEW_LEFT ? `Only ${left} left` : "In stock"}
                  </p>
                  <div className="mt-3">
                    {inCart > 0 ? (
                      <div className="flex items-center justify-between gap-2">
                        <Stepper qty={inCart} max={Math.min(CART_MAX, left)} onChange={(n) => setQty(p.sku, n)} label={p.name} />
                        <span className="text-caption text-ink-3">in cart</span>
                      </div>
                    ) : (
                      <button
                        className="btn btn-primary w-full"
                        disabled={left === 0}
                        onClick={() => {
                          add(p.sku);
                          toast(`${p.name} added to cart`);
                        }}
                      >
                        <ShoppingCart size={15} aria-hidden /> Add to cart
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </ShopFrame>
  );
}

function Perk({ icon, title, sub }: { icon: ReactNode; title: string; sub: string }) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-bg text-brand">{icon}</span>
      <span>
        <span className="block font-semibold">{title}</span>
        <span className="block text-ink-3">{sub}</span>
      </span>
    </li>
  );
}
