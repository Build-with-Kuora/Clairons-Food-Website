"use client";

import { Download, Package, Percent, Printer, ReceiptText, Wallet } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { PairedBars, Rings } from "@/components/trendCharts";
import { Delta, Empty, PageHead, Panel, Stat, cx } from "@/components/ui";
import { DAY, HOUR, count, dateKey, day, keyToTs, money, money0, pesoK, plural, startOfDay, unitPlural, capitalize } from "@/lib/format";
import { useMaps, useSales, useToday } from "@/lib/hooks";
import { buyerName, commonUnit, isWalkIn, previousRange, salesByCategory, salesByClient, salesByDay, salesCsv, salesSummary, vatSplit } from "@/lib/logic";

/** Ring colors for the top categories, strongest first: red, black, then their light tints. */
const RING_COLORS = ["var(--color-brand)", "var(--color-ink)", "var(--color-brand-soft)", "var(--color-line-2)"];

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

/** The periods the owner downloads most: today, the last 7 days and the last 30. */
const CSV_PRESETS: { id: Preset; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "week", label: "7 days" },
  { id: "month", label: "30 days" },
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

  /** Save one period's sales by product as a CSV file, whatever range is on screen. */
  const downloadCsv = (p: Preset) => {
    const r = presetRange(p, now);
    const s = salesSummary(sales, keyToTs(r.from), startOfDay(keyToTs(r.to) + DAY + 12 * HOUR));
    const period = r.from === r.to ? day(keyToTs(r.from)) : `${day(keyToTs(r.from))} to ${day(keyToTs(r.to))}`;
    const blob = new Blob([salesCsv(s, maps.product, period)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = r.from === r.to ? `clairons-sales-${r.from}.csv` : `clairons-sales-${r.from}-to-${r.to}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const total = vatSplit(sum.total);
  const products = vatSplit(sum.products);
  const fees = vatSplit(sum.fees);
  const unit = commonUnit(sum.rows.map((r) => maps.product.get(r.sku)));

  // The period of the same length just before, for the change on each figure.
  const prev = previousRange(from, to);
  const before = salesSummary(sales, prev.from, prev.to);
  const beforeTotal = vatSplit(before.total);
  const vsLabel = fromKey === toKey ? "vs the day before" : "vs the period before";

  const byCategory = salesByCategory(sales, maps.product, from, to);
  const topCats = byCategory.slice(0, 4);
  const catTotal = byCategory.reduce((t, c) => t + c.amount, 0);
  const byDay = salesByDay(sales, maps.order, from, to);
  const byClient = salesByClient(sales, from, to).slice(0, 5);
  const topClient = byClient[0]?.amount ?? 0;

  return (
    <div className="mx-auto max-w-[1500px]">
      <PageHead
        title="Sales report"
        sub={`${label}. Counted when delivered, or when paid at the counter. Refused cases are left out.`}
        actions={
          <>
            <div className="flex items-center gap-1.5" role="group" aria-label="Download CSV">
              <span className="flex items-center gap-1 text-[13.5px] font-semibold text-ink-2">
                <Download size={15} aria-hidden /> CSV
              </span>
              {CSV_PRESETS.map((p) => (
                <button key={p.id} className="btn btn-ghost btn-sm" onClick={() => downloadCsv(p.id)}>
                  {p.label}
                </button>
              ))}
            </div>
            <button className="btn btn-ghost" onClick={() => window.print()} disabled={!sum.count}>
              <Printer size={16} /> Print
            </button>
          </>
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

      <div className="mb-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="grid gap-4 sm:grid-cols-2">
          <Stat
            dark
            icon={<Wallet size={20} />}
            label="Total sales"
            value={money(sum.total)}
            foot={
              <>
                <Delta now={sum.total} prev={before.total} onDark /> {plural(sum.count, "sale")}, VAT included
              </>
            }
          />
          <Stat
            icon={<ReceiptText size={20} />}
            label="VATable sales"
            value={money(total.net)}
            foot={
              <>
                <Delta now={total.net} prev={beforeTotal.net} /> {vsLabel}
              </>
            }
          />
          <Stat
            icon={<Percent size={20} />}
            label="VAT 12%"
            value={money(total.vat)}
            foot={
              <>
                <Delta now={total.vat} prev={beforeTotal.vat} /> Output VAT in the total
              </>
            }
          />
          <Stat
            icon={<Package size={20} />}
            label={`${capitalize(unitPlural(unit))} sold`}
            value={count(sum.cases)}
            foot={
              <>
                <Delta now={sum.cases} prev={before.cases} /> {plural(sum.rows.length, "product")}
              </>
            }
          />
        </div>

        <Panel title="Sales by category" sub="Product sales, fees left out">
          {topCats.length ? (
            <div>
              <div className="flex items-center gap-5">
                <Rings items={topCats.map((c, i) => ({ label: c.category, value: c.amount, color: RING_COLORS[i] }))} size={150} label="Top categories by amount" />
                <div className="min-w-0">
                  <div className="display text-[30px] leading-none font-semibold">{pesoK(catTotal)}</div>
                  <div className="mt-1 text-[13px] text-ink-3">
                    Product sales across {plural(byCategory.length, "category", "categories")}
                  </div>
                </div>
              </div>
              <ul className="mt-5 space-y-2.5 text-[13.5px]">
                {topCats.map((c, i) => (
                  <li key={c.category} className="flex items-center gap-2">
                    <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: RING_COLORS[i] }} aria-hidden />
                    <span className="min-w-0 flex-1 truncate text-ink-2">{c.category}</span>
                    <span className="font-semibold">{pesoK(c.amount)}</span>
                    <span className="w-10 text-right text-[12.5px] text-ink-3">{catTotal ? Math.round((c.amount / catTotal) * 100) : 0}%</span>
                  </li>
                ))}
                {byCategory.length > topCats.length && (
                  <li className="text-[12.5px] text-ink-3">
                    {plural(byCategory.length - topCats.length, "more category", "more categories")}, {pesoK(catTotal - topCats.reduce((t, c) => t + c.amount, 0))}
                  </li>
                )}
              </ul>
            </div>
          ) : (
            <Empty title="No sales in this range" />
          )}
        </Panel>
      </div>

      <div className="mb-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
        <Panel
          title={byDay.step === 7 ? "Sales by week" : "Sales by day"}
          sub="Walk-in against delivery, fees included"
          actions={
            <div className="flex items-center gap-4 text-[13px] text-ink-2">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-brand" aria-hidden /> Walk-in
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-ink" aria-hidden /> Delivery
              </span>
            </div>
          }
        >
          <PairedBars
            names={["Walk-in", "Delivery"]}
            format={pesoK}
            data={byDay.buckets.map((b) => ({
              label: new Date(b.start).toLocaleDateString("en-US", byDay.buckets.length > 10 ? { month: "short", day: "numeric" } : { weekday: "short", day: "numeric" }),
              sub: byDay.step === 7 ? `Week of ${day(b.start)}` : new Date(b.start).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" }),
              a: b.walkIn,
              b: b.delivery,
            }))}
          />
        </Panel>

        <Panel title="Top customers" sub={`By amount, ${label}`}>
          {byClient.length ? (
            <ul className="space-y-3.5">
              {byClient.map((c) => {
                const client = maps.client.get(c.clientId);
                return (
                  <li key={c.clientId}>
                    <div className="flex items-baseline justify-between gap-2">
                      {isWalkIn(client) ? (
                        <span className="truncate text-[14px] font-semibold">Walk-in customers</span>
                      ) : (
                        <Link href={`/clients?id=${c.clientId}`} className="truncate text-[14px] font-semibold hover:underline">
                          {buyerName({}, client)}
                        </Link>
                      )}
                      <span className="text-[14px] font-semibold whitespace-nowrap">{money0(c.amount)}</span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-sunk" aria-hidden>
                      <div className={cx("h-full rounded-full", isWalkIn(client) ? "bg-brand" : "bg-ink")} style={{ width: `${topClient ? (c.amount / topClient) * 100 : 0}%` }} />
                    </div>
                    <div className="mt-0.5 text-[12.5px] text-ink-3">{plural(c.count, "sale")}</div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <Empty title="No sales in this range" />
          )}
        </Panel>
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
