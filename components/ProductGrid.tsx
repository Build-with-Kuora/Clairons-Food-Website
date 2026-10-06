"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { DAY, money0, startOfDay, unitPlural, units } from "@/lib/format";
import { useSales, useStock } from "@/lib/hooks";
import { priceUnit, soldBySku } from "@/lib/logic";
import { useStore } from "@/lib/store";
import type { Category } from "@/lib/types";
import { Panel, Segmented, cx } from "./ui";

const PERIODS = [
  { id: "day", label: "Sold today", days: 1, sold: "sold today" },
  { id: "week", label: "Sold in 7 days", days: 7, sold: "sold, 7 days" },
  { id: "month", label: "Sold in 30 days", days: 30, sold: "sold, 30 days" },
] as const;
type PeriodId = (typeof PERIODS)[number]["id"];

/** Cards shown before "Show all" when no search or category is picked. 12 fills whole rows of 2, 3 or 4. */
const TOP = 12;

/**
 * Dashboard product cards from the client's sketch: price in the upper-left box,
 * units sold as the big number, stock left in the lower-right box.
 */
export function ProductGrid({ now }: { now: number }) {
  const allProducts = useStore((s) => s.products);
  const products = useMemo(() => allProducts.filter((x) => x.active), [allProducts]);
  const sales = useSales();
  const { rows } = useStock();
  const [period, setPeriod] = useState<PeriodId>("day");
  const [cat, setCat] = useState<Category | "All">("All");
  const [q, setQ] = useState("");
  const [showAll, setShowAll] = useState(false);

  const p = PERIODS.find((x) => x.id === period)!;
  const since = startOfDay(now) - (p.days - 1) * DAY;

  const sold = useMemo(() => soldBySku(sales, since), [sales, since]);

  const cats = useMemo(() => ["All" as const, ...new Set(products.map((x) => x.category))], [products]);
  const needle = q.trim().toLowerCase();
  const filtering = needle !== "" || cat !== "All";
  const list = products
    .filter((x) => (cat === "All" || x.category === cat) && (!needle || x.name.toLowerCase().includes(needle) || x.sku.toLowerCase().includes(needle)))
    .sort((a, b) => (sold.get(b.sku) ?? 0) - (sold.get(a.sku) ?? 0) || a.name.localeCompare(b.name));
  const shown = filtering || showAll ? list : list.slice(0, TOP);

  return (
    <Panel
      title="Products"
      actions={<Segmented label="Sold over" options={PERIODS.map((x) => ({ id: x.id, label: x.label }))} value={period} onChange={setPeriod} />}
    >
      <div className="relative mb-3 max-w-[420px]">
        <Search size={20} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-3" aria-hidden />
        <input className="input pl-11" placeholder="Search by product name" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search products" />
      </div>
      <div className="mb-5 flex flex-wrap gap-2" role="group" aria-label="Category">
        {cats.map((c) => (
          <button key={c} onClick={() => setCat(c)} aria-pressed={cat === c} className="chip">
            {c}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {shown.map((x) => {
          const n = sold.get(x.sku) ?? 0;
          const left = rows.get(x.sku)?.available ?? 0;
          const out = left <= 0;
          const low = !out && left < x.reorderPoint;
          return (
            <Link
              key={x.sku}
              href={`/inventory?sku=${x.sku}`}
              className="flex min-w-0 flex-col rounded-2xl border border-line-2 bg-panel p-4 transition-colors hover:border-ink-3 hover:bg-sunk/40"
              aria-label={`${x.name}: ${money0(x.price.C)} per ${priceUnit(x)}, ${units(n, x.unit)} ${p.sold}, ${units(left, x.unit)} left`}
            >
              <span className="self-start rounded-full bg-sunk px-3 py-1 text-body leading-tight font-bold text-ink">
                {money0(x.price.C)}
                <span className="text-small font-semibold">/{priceUnit(x)}</span>
              </span>
              <span className="mt-3 line-clamp-2 min-h-[2.7em] text-lead leading-snug font-semibold">{x.name}</span>
              <span className="mt-3 flex items-end justify-between gap-2">
                <span className="min-w-0">
                  <span className={cx("display block text-figure leading-none font-semibold", n === 0 && "text-ink-3")}>{n}</span>
                  <span className="mt-1 block text-small text-ink-2">
                    {n === 1 ? x.unit : unitPlural(x.unit)} {p.sold}
                  </span>
                </span>
                <span
                  className={cx(
                    "shrink-0 rounded-full border px-3 py-1 text-small font-semibold whitespace-nowrap",
                    out ? "border-bad/25 bg-bad-bg text-bad" : low ? "border-warn/25 bg-warn-bg text-warn" : "border-line bg-sunk text-ink-2",
                  )}
                >
                  {out ? "Out" : `${left} left`}
                </span>
              </span>
            </Link>
          );
        })}
      </div>

      {shown.length === 0 && <p className="py-8 text-center text-body text-ink-2">No products match. Clear the search or pick another category.</p>}
      {!filtering && list.length > TOP && (
        <button className="btn btn-ghost mt-4 w-full" onClick={() => setShowAll((v) => !v)}>
          {showAll ? "Show top sellers only" : `Show all ${list.length} products`}
        </button>
      )}
      <p className="mt-3 hint">Prices are the list price per case (per kg for items sold by weight). &ldquo;Left&rdquo; is what can still be sold after stock set aside for orders.</p>
    </Panel>
  );
}
