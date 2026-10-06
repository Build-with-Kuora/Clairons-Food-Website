"use client";

import { SortableGrid } from "@/components/SortableBlocks";
import { CalendarDays, Download, Package, Percent, Printer, ReceiptText, Wallet } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { PairedBars } from "@/components/trendCharts";
import { Delta, Empty, PageHead, Panel, Stat, cx } from "@/components/ui";
import { DAY, HOUR, count, dateKey, day, keyToTs, money, money0, pesoK, plural, startOfDay, unitPlural, capitalize } from "@/lib/format";
import { useMaps, useSales, useToday } from "@/lib/hooks";
import { buyerName, commonUnit, isWalkIn, previousRange, salesByCategory, salesByClient, salesByDay, salesCsv, salesSummary, vatSplit } from "@/lib/logic";

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

/** The everyday periods. Anything else (yesterday, last month) goes through "Choose dates". */
const PRESETS: { id: Preset; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "week", label: "Last 7 days" },
  { id: "month", label: "Last 30 days" },
  { id: "thisMonth", label: "This month" },
];

export default function Sales() {
  const { now } = useToday();
  const sales = useSales();
  const maps = useMaps();
  const [range, setRange] = useState(() => presetRange("week", now));
  const [picking, setPicking] = useState(false);

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

  /** Save the period on screen, by product, as a CSV file. */
  const downloadCsv = () => {
    const blob = new Blob([salesCsv(sum, maps.product, label)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = fromKey === toKey ? `clairons-sales-${fromKey}.csv` : `clairons-sales-${fromKey}-to-${toKey}.csv`;
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
  const vsLabel = fromKey === toKey ? "compared with the day before" : "compared with the period before";

  const byCategory = salesByCategory(sales, maps.product, from, to);
  const catTop = byCategory[0]?.amount ?? 0;
  const catTotal = byCategory.reduce((t, c) => t + c.amount, 0);
  const byDay = salesByDay(sales, maps.order, from, to);
  const byClient = salesByClient(sales, from, to).slice(0, 5);
  const topClient = byClient[0]?.amount ?? 0;

  return (
    <div className="mx-auto max-w-[1500px]">
      <PageHead
        sub={
          <>
            <span className="font-semibold text-ink">{label}.</span> A sale counts once it is delivered, or when paid at the counter. Refused cases are left out.
          </>
        }
        actions={
          <>
            <button className="btn btn-ghost" onClick={downloadCsv} disabled={!sum.count}>
              <Download size={20} aria-hidden /> Download this period
            </button>
            <button className="btn btn-ghost" onClick={() => window.print()} disabled={!sum.count}>
              <Printer size={20} aria-hidden /> Print
            </button>
          </>
        }
      />

      <div className="mb-6">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Period">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                setRange(presetRange(p.id, now));
                setPicking(false);
              }}
              aria-pressed={!picking && preset === p.id}
              className="chip"
            >
              {p.label}
            </button>
          ))}
          <button onClick={() => setPicking(true)} aria-pressed={picking || !preset} className="chip">
            <CalendarDays size={18} aria-hidden /> Choose dates
          </button>
        </div>
        {(picking || !preset) && (
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <label className="block">
              <span className="field-label">From</span>
              <input className="input" type="date" value={range.from} max={dateKey(now)} onChange={(e) => e.target.value && setRange((r) => ({ ...r, from: e.target.value }))} />
            </label>
            <label className="block">
              <span className="field-label">To</span>
              <input className="input" type="date" value={range.to} max={dateKey(now)} onChange={(e) => e.target.value && setRange((r) => ({ ...r, to: e.target.value }))} />
            </label>
          </div>
        )}
      </div>

      <SortableGrid
        storageKey="coldline-sales-cards"
        className="mb-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-4"
        items={[
          {
            id: "total",
            label: "Total sales",
            node: (
              <Stat
                className="h-full"
                dark
                icon={<Wallet size={22} />}
                label="Total sales"
                value={money0(sum.total)}
                foot={
                  <>
                    <Delta now={sum.total} prev={before.total} onDark /> {vsLabel}. {plural(sum.count, "sale")}, VAT included.
                  </>
                }
              />
            ),
          },
          {
            id: "vatable",
            label: "Sales before VAT",
            node: (
              <Stat
                className="h-full"
                icon={<ReceiptText size={22} />}
                label="Sales before VAT"
                value={money0(total.net)}
                foot={
                  <>
                    <Delta now={total.net} prev={beforeTotal.net} /> {vsLabel}
                  </>
                }
              />
            ),
          },
          {
            id: "vat",
            label: "VAT (12%)",
            node: (
              <Stat
                className="h-full"
                icon={<Percent size={22} />}
                label="VAT (12%)"
                value={money0(total.vat)}
                foot={
                  <>
                    The 12% VAT inside the total sales.
                  </>
                }
              />
            ),
          },
          {
            id: "units",
            label: "Units sold",
            node: (
              <Stat
                className="h-full"
                icon={<Package size={22} />}
                label={`${capitalize(unitPlural(unit))} sold`}
                value={count(sum.cases)}
                foot={
                  <>
                    <Delta now={sum.cases} prev={before.cases} /> {vsLabel}. {plural(sum.rows.length, "product")}.
                  </>
                }
              />
            ),
          },
        ]}
      />

      <Panel
        className="mb-6"
        title={byDay.step === 7 ? "Sales by week" : "Sales by day"}
        sub="Walk-in and delivery sales, fees included"
        actions={
          <div className="flex items-center gap-5 text-small font-semibold text-ink-2">
            <span className="flex items-center gap-2">
              <span className="h-3.5 w-3.5 rounded-[4px] bg-brand" aria-hidden /> Walk-in
            </span>
            <span className="flex items-center gap-2">
              <span className="h-3.5 w-3.5 rounded-[4px] bg-ink" aria-hidden /> Delivery
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

      <div className="mb-6 grid gap-5 lg:grid-cols-2">
        <Panel title="Sales by category" sub="Product sales only, delivery fees left out">
          {byCategory.length ? (
            <ul className="space-y-4">
              {byCategory.map((c) => (
                <li key={c.category}>
                  <div className="flex items-baseline justify-between gap-3 text-body">
                    <span className="min-w-0 truncate font-semibold">{c.category}</span>
                    <span className="whitespace-nowrap">
                      <span className="font-semibold">{money0(c.amount)}</span>
                      <span className="ml-2 inline-block w-11 text-right text-small text-ink-3">{catTotal ? Math.round((c.amount / catTotal) * 100) : 0}%</span>
                    </span>
                  </div>
                  <div className="mt-1.5 h-2.5 rounded-full bg-ink" style={{ width: `${catTop ? Math.max(2, (c.amount / catTop) * 100) : 0}%` }} aria-hidden />
                </li>
              ))}
            </ul>
          ) : (
            <Empty title="No sales in this period" />
          )}
        </Panel>

        <Panel title="Top customers" sub="By amount, for the same period">
          {byClient.length ? (
            <ul className="space-y-4">
              {byClient.map((c) => {
                const client = maps.client.get(c.clientId);
                return (
                  <li key={c.clientId}>
                    <div className="flex items-baseline justify-between gap-2">
                      {isWalkIn(client) ? (
                        <span className="truncate text-body font-semibold">Walk-in customers</span>
                      ) : (
                        <Link href={`/clients?id=${c.clientId}`} className="truncate text-body font-semibold hover:underline">
                          {buyerName({}, client)}
                        </Link>
                      )}
                      <span className="text-body font-semibold whitespace-nowrap">{money0(c.amount)}</span>
                    </div>
                    <div className={cx("mt-1.5 h-2.5 rounded-full", "bg-ink")} style={{ width: `${topClient ? Math.max(2, (c.amount / topClient) * 100) : 0}%` }} aria-hidden />
                    <div className="mt-1 hint">{plural(c.count, "sale")}</div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <Empty title="No sales in this period" />
          )}
        </Panel>
      </div>

      <Panel title={`Sales by product, ${label}`} bodyClass="">
        <div className="print-area overflow-x-auto bg-panel scroll-thin">
          <div className="hidden px-3 pt-3 print:block">
            <div className="display text-title font-semibold">Clairon&rsquo;s Food, sales by product</div>
            <div className="text-small text-ink-3">{label}. Amounts in pesos, prices include VAT.</div>
          </div>
          {sum.rows.length ? (
            <table className="tbl min-w-[720px]">
              <thead>
                <tr>
                  <th>Product</th>
                  <th className="r">Sold</th>
                  <th className="r">Before VAT</th>
                  <th className="r">VAT (12%)</th>
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
                        <div className="hint">In {plural(r.orders, "sale")}</div>
                      </td>
                      <td className="r whitespace-nowrap">
                        {count(r.qty)} <span className="text-small text-ink-3">{r.qty === 1 ? p?.unit : unitPlural(p?.unit ?? "unit")}</span>
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
                  <td className="text-ink-2">Delivery fees (small order and fuel)</td>
                  <td />
                  <td className="r text-ink-2">{money(fees.net)}</td>
                  <td className="r text-ink-2">{money(fees.vat)}</td>
                  <td className="r">{money(sum.fees)}</td>
                </tr>
                <tr className="border-t-2 border-ink text-body font-bold">
                  <td>Total</td>
                  <td className="r">{count(sum.cases)}</td>
                  <td className="r">{money(total.net)}</td>
                  <td className="r">{money(total.vat)}</td>
                  <td className="r">{money(sum.total)}</td>
                </tr>
              </tfoot>
            </table>
          ) : (
            <Empty title="No sales in this period">Pick another period. Deliveries count once they are delivered.</Empty>
          )}
        </div>
      </Panel>
    </div>
  );
}
