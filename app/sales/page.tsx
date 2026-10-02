"use client";

import { Printer } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Empty, PageHead, Panel, cx } from "@/components/ui";
import { DAY, HOUR, count, dateKey, day, keyToTs, money, plural, startOfDay, unitPlural, capitalize } from "@/lib/format";
import { useMaps, useSales, useToday } from "@/lib/hooks";
import { commonUnit, salesSummary, vatSplit } from "@/lib/logic";

type Preset = "today" | "yesterday" | "week" | "month" | "thisMonth";

/** Inclusive day range as yyyy-mm-dd keys. Noon offsets keep daylight-saving shifts from landing on the wrong day. */
function presetRange(p: Preset, now: number): { from: string; to: string } {
  const today = startOfDay(now);
  const back = (n: number) => dateKey(today - n * DAY + 12 * HOUR);
  switch (p) {
    case "today":
      return { from: back(0), to: back(0) };
    case "yesterday":
      return { from: back(1), to: back(1) };
    case "week":
      return { from: back(6), to: back(0) };
    case "month":
      return { from: back(29), to: back(0) };
    case "thisMonth": {
      const d = new Date(now);
      return { from: dateKey(new Date(d.getFullYear(), d.getMonth(), 1).getTime()), to: back(0) };
    }
  }
}

const PRESETS: { id: Preset; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "week", label: "7 days" },
  { id: "month", label: "30 days" },
  { id: "thisMonth", label: "This month" },
];

export default function Sales() {
  const { now } = useToday();
  const sales = useSales();
  const maps = useMaps();
  const [range, setRange] = useState(() => presetRange("week", now));

  // Either date can be typed past the other; read the pair in order.
  const [fromKey, toKey] = range.from <= range.to ? [range.from, range.to] : [range.to, range.from];
  const from = keyToTs(fromKey);
  const to = startOfDay(keyToTs(toKey) + DAY + 12 * HOUR);
  const sum = salesSummary(sales, from, to);
  const preset = PRESETS.find((p) => {
    const r = presetRange(p.id, now);
    return r.from === fromKey && r.to === toKey;
  })?.id;

  const label = fromKey === toKey ? day(from) : `${day(from)} to ${day(keyToTs(toKey))}`;
  const total = vatSplit(sum.total);
  const products = vatSplit(sum.products);
  const fees = vatSplit(sum.fees);
  const unit = commonUnit(sum.rows.map((r) => maps.product.get(r.sku)));

  const figures = [
    { label: "Total sales", value: money(sum.total), sub: `${plural(sum.count, "sale")}, VAT included` },
    { label: "VATable sales", value: money(total.net), sub: "Without VAT" },
    { label: "VAT 12%", value: money(total.vat), sub: "Output VAT in the total" },
    { label: `${capitalize(unitPlural(unit))} sold`, value: count(sum.cases), sub: plural(sum.rows.length, "product") },
  ];

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHead
        title="Sales"
        sub="Counted when delivered, or when paid at the counter. Refused cases are left out."
        actions={
          <button className="btn btn-ghost" onClick={() => window.print()} disabled={!sum.count}>
            <Printer size={16} /> Print
          </button>
        }
      />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Date range">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => setRange(presetRange(p.id, now))}
              aria-pressed={preset === p.id}
              className={cx(
                "h-8 cursor-pointer rounded-full border px-3 text-[13.5px] font-semibold",
                preset === p.id ? "border-ink bg-ink text-white" : "border-line bg-panel text-ink-2 hover:border-line-2",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex items-end gap-2">
          <label className="block">
            <span className="field-label">From</span>
            <input className="input" type="date" value={range.from} max={dateKey(now)} onChange={(e) => e.target.value && setRange((r) => ({ ...r, from: e.target.value }))} />
          </label>
          <label className="block">
            <span className="field-label">To</span>
            <input className="input" type="date" value={range.to} max={dateKey(now)} onChange={(e) => e.target.value && setRange((r) => ({ ...r, to: e.target.value }))} />
          </label>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-2 overflow-hidden rounded-[10px] border border-line bg-panel md:grid-cols-4">
        {figures.map((f, i) => (
          <div key={f.label} className={cx("min-w-0 px-4 py-3", i > 0 && "md:border-l", i % 2 === 1 && "border-l", i > 1 && "border-t md:border-t-0", "border-line")}>
            <div className="text-[13px] text-ink-3">{f.label}</div>
            <div className="display mt-0.5 truncate text-[26px] leading-none font-semibold md:text-[30px]">{f.value}</div>
            <div className="mt-1 text-[13px] text-ink-3">{f.sub}</div>
          </div>
        ))}
      </div>

      <Panel title={`Sales by product, ${label}`} bodyClass="">
        <div className="print-area overflow-x-auto bg-panel scroll-thin">
          <div className="hidden px-3 pt-3 print:block">
            <div className="display text-[22px] font-semibold">Clairon&rsquo;s Food, sales by product</div>
            <div className="text-[13px] text-ink-3">{label}. Amounts in pesos, VAT-inclusive prices.</div>
          </div>
          {sum.rows.length ? (
            <table className="tbl min-w-[720px]">
              <thead>
                <tr>
                  <th>Product</th>
                  <th className="r">Sold</th>
                  <th className="r">VATable sales</th>
                  <th className="r">VAT 12%</th>
                  <th className="r">Amount</th>
                </tr>
              </thead>
              <tbody>
                {sum.rows.map((r) => {
                  const p = maps.product.get(r.sku);
                  const v = vatSplit(r.amount);
                  return (
                    <tr key={r.sku}>
                      <td>
                        <Link href={`/inventory?sku=${r.sku}`} className="font-semibold hover:underline">
                          {p?.name ?? r.sku}
                        </Link>
                        <div className="text-[12.5px] text-ink-3">
                          <span className="code">{r.sku}</span>, in {plural(r.orders, "sale")}
                        </div>
                      </td>
                      <td className="r whitespace-nowrap">
                        {count(r.qty)} <span className="text-[12.5px] text-ink-3">{r.qty === 1 ? p?.unit : unitPlural(p?.unit ?? "unit")}</span>
                      </td>
                      <td className="r text-ink-2">{money(v.net)}</td>
                      <td className="r text-ink-2">{money(v.vat)}</td>
                      <td className="r font-semibold">{money(r.amount)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td className="text-ink-2">Products</td>
                  <td className="r">{count(sum.cases)}</td>
                  <td className="r text-ink-2">{money(products.net)}</td>
                  <td className="r text-ink-2">{money(products.vat)}</td>
                  <td className="r">{money(sum.products)}</td>
                </tr>
                <tr>
                  <td className="text-ink-2">Delivery fees (small drop, fuel)</td>
                  <td />
                  <td className="r text-ink-2">{money(fees.net)}</td>
                  <td className="r text-ink-2">{money(fees.vat)}</td>
                  <td className="r">{money(sum.fees)}</td>
                </tr>
                <tr className="border-t-2 border-ink text-[15px] font-bold">
                  <td>Total</td>
                  <td className="r">{count(sum.cases)}</td>
                  <td className="r">{money(total.net)}</td>
                  <td className="r">{money(total.vat)}</td>
                  <td className="r">{money(sum.total)}</td>
                </tr>
              </tfoot>
            </table>
          ) : (
            <Empty title="No sales in this range">Pick another range. Deliveries count once they are delivered.</Empty>
          )}
        </div>
      </Panel>
    </div>
  );
}
