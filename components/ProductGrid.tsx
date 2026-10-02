"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { DAY, money0, startOfDay } from "@/lib/format";
import { useSales, useStock } from "@/lib/hooks";
import { soldBySku } from "@/lib/logic";
import { useStore } from "@/lib/store";
import type { Category } from "@/lib/types";
import { Panel, cx } from "./ui";

const PERIODS = [
  { id: "day", label: "Today", days: 1, sold: "sold today" },
  { id: "week", label: "7 days", days: 7, sold: "sold, 7 days" },
  { id: "month", label: "30 days", days: 30, sold: "sold, 30 days" },
] as const;
type PeriodId = (typeof PERIODS)[number]["id"];

/** Cards shown before "Show all" when no search or category is picked. */
const TOP = 8;

/**
 * Dashboard product cards from the client's sketch: price in the upper-left box,
 * cases sold as the big number, stock left in the lower-right box.
 */
export function ProductGrid({ now }: { now: number }) {
  const products = useStore((s) => s.products);
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
      className="mb-5"
      actions={
        <div className="flex rounded-md border border-line p-0.5" role="group" aria-label="Sold over">
          {PERIODS.map((x) => (
            <button
              key={x.id}
              onClick={() => setPeriod(x.id)}
              aria-pressed={period === x.id}
              className={cx("h-7 cursor-pointer rounded px-2.5 text-[13px] font-semibold", period === x.id ? "bg-ink text-white" : "text-ink-2 hover:bg-sunk")}
            >
              {x.label}
            </button>
          ))}
        </div>
      }
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1 md:max-w-[280px]">
          <Search size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-3" />
          <input className="input pl-8" placeholder="Search name or SKU" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search products" />
        </div>
        <div className="flex min-w-0 gap-1.5 overflow-x-auto pb-0.5 scroll-thin">
          {cats.map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              aria-pressed={cat === c}
              className={cx(
                "h-8 shrink-0 cursor-pointer rounded-full border px-3 text-[13px] font-semibold",
                cat === c ? "border-ink bg-ink text-white" : "border-line bg-panel text-ink-2 hover:border-line-2",
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
        {shown.map((x) => {
          const n = sold.get(x.sku) ?? 0;
          const left = rows.get(x.sku)?.available ?? 0;
          const out = left <= 0;
          const low = !out && left < x.reorderPoint;
          return (
            <Link
              key={x.sku}
              href={`/inventory?sku=${x.sku}`}
              className="flex min-w-0 flex-col rounded-md border border-line bg-panel p-2.5 transition-colors hover:border-ink-3"
              aria-label={`${x.name}: ${money0(x.price.C)} per ${x.catchWeight ? "kg" : "case"}, ${n} ${p.sold}, ${left} cases left`}
            >
              <span className="self-start rounded bg-ink px-1.5 py-0.5 text-[13px] leading-tight font-semibold text-white">
                {money0(x.price.C)}
                <span className="font-normal text-white/70">/{x.catchWeight ? "kg" : "cs"}</span>
              </span>
              <span className="mt-2 line-clamp-2 min-h-[2.7em] text-[14px] leading-snug font-semibold">{x.name}</span>
              <span className="code text-ink-3">{x.sku}</span>
              <span className="mt-2 flex items-end justify-between gap-2">
                <span className="min-w-0">
                  <span className={cx("display block text-[36px] leading-none font-semibold", n === 0 && "text-ink-3")}>{n}</span>
                  <span className="block text-[12px] text-ink-3">cs {p.sold}</span>
                </span>
                <span
                  className={cx(
                    "shrink-0 rounded border px-1.5 py-0.5 text-[13px] font-semibold whitespace-nowrap",
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

      {shown.length === 0 && <p className="py-8 text-center text-[14px] text-ink-3">No products match. Clear the search or pick another category.</p>}
      {!filtering && list.length > TOP && (
        <button className="btn btn-ghost mt-3 w-full" onClick={() => setShowAll((v) => !v)}>
          {showAll ? "Show top sellers only" : `Show all ${list.length} products`}
        </button>
      )}
      <p className="mt-2 text-[12.5px] text-ink-3">List price per case (per kg for catch weight). &ldquo;Left&rdquo; is free to sell: on hand minus stock already reserved for orders.</p>
    </Panel>
  );
}
