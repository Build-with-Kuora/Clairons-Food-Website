"use client";

import { Factory } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Empty, Field, LotBadge, PageHead, Panel, cx } from "@/components/ui";
import { DAY, capitalize, clock, dateTime, plural, startOfDay, unitPlural, units } from "@/lib/format";
import { useStock, useToday } from "@/lib/hooks";
import { BLAST_HOURS, commonUnit, producedBySku, toMake } from "@/lib/logic";
import { useStore, useUi } from "@/lib/store";

const BY = "Production line";

/** Batches listed before "Show all", so the page stays short. */
const BATCHES_SHOWN = 15;

export default function Production() {
  const { now } = useToday();
  const products = useStore((s) => s.products);
  const batches = useStore((s) => s.batches);
  const lots = useStore((s) => s.lots);
  const produce = useStore((s) => s.produce);
  const toast = useUi((s) => s.toast);
  const { rows } = useStock();
  const params = useSearchParams();

  const [sku, setSku] = useState(() => params.get("sku") ?? "");
  const [qty, setQty] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [allBatches, setAllBatches] = useState(false);

  const dayStart = startOfDay(now);
  const today = useMemo(() => producedBySku(batches, dayStart), [batches, dayStart]);
  const week = useMemo(() => producedBySku(batches, dayStart - 6 * DAY), [batches, dayStart]);
  const suggestions = useMemo(() => toMake(rows.values()), [rows]);
  const madeToday = batches.filter((b) => b.madeAt >= dayStart);
  const casesToday = madeToday.reduce((t, b) => t + b.qty, 0);
  const lotById = new Map(lots.map((l) => [l.id, l]));
  const product = new Map(products.map((p) => [p.sku, p]));
  const summary = products.filter((p) => week.has(p.sku)).sort((a, b) => (week.get(b.sku) ?? 0) - (week.get(a.sku) ?? 0));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const r = produce({ sku, qty: Number(qty), by: BY, note });
    if (!r.ok) return setError(r.error);
    const p = product.get(r.batch.sku);
    toast(`${r.batch.number}: ${units(r.batch.qty, p?.unit ?? "unit")} ${p?.name.toLowerCase()} into the blast freezer`);
    setQty("");
    setNote("");
    setError("");
  }

  function prefill(s: string, q: number) {
    setSku(s);
    setQty(String(q));
    setError("");
    document.getElementById("batch-qty")?.focus();
  }

  return (
    <div className="mx-auto max-w-[1500px]">
      <PageHead sub={`${plural(madeToday.length, "batch", "batches")} made today, ${units(casesToday, commonUnit(madeToday.map((b) => product.get(b.sku))))} in all.`} />

      <div className="mb-6 grid items-start gap-5 xl:grid-cols-[420px_1fr]">
        <Panel title="Record a batch" sub={`New batches go into the blast freezer and can be sold once frozen, ${BLAST_HOURS} hours later.`}>
          <form onSubmit={submit} className="flex flex-col gap-4">
            <Field label="Product">
              <select className="input" value={sku} onChange={(e) => setSku(e.target.value)} required>
                <option value="">Choose a product…</option>
                {/* Grouped by category, so a 48-product list is quicker to scan */}
                {[...new Set(products.map((p) => p.category))].map((cat) => (
                  <optgroup key={cat} label={cat}>
                    {products
                      .filter((p) => p.category === cat && (p.active || p.sku === sku))
                      .map((p) => (
                        <option key={p.sku} value={p.sku}>
                          {p.name}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </select>
            </Field>
            <Field
              label={sku ? `${capitalize(unitPlural(product.get(sku)?.unit ?? "unit"))} made` : "Quantity made"}
              hint={sku ? `${product.get(sku)?.pack} per ${product.get(sku)?.unit}. ${units(rows.get(sku)?.available ?? 0, product.get(sku)?.unit ?? "unit")} available now.` : undefined}
            >
              <input id="batch-qty" className="input" type="number" inputMode="numeric" min={1} step={1} value={qty} onChange={(e) => setQty(e.target.value)} required />
            </Field>
            <Field label="Note (optional)">
              <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Shift, line, or anything worth noting" />
            </Field>
            {error && <p className="text-small font-semibold text-bad">{error}</p>}
            <button className="btn btn-primary btn-lg" type="submit">
              <Factory size={20} aria-hidden /> Record batch
            </button>
          </form>
        </Panel>

        <Panel title="What to make" sub="Products running low, with how many to make to fill them back up" bodyClass="p-0">
          {suggestions.length === 0 ? (
            <Empty title="Nothing is running low">Every product has enough stock.</Empty>
          ) : (
            <div className="overflow-x-auto scroll-thin">
              <table className="tbl min-w-[560px]">
                <thead>
                  <tr>
                    <th className="pl-5 sm:pl-6">Product</th>
                    <th className="r">Available</th>
                    <th className="r">Make</th>
                    <th className="pr-5 sm:pr-6">
                      <span className="sr-only">Action</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {suggestions.map(({ row, qty: q }) => (
                    <tr key={row.product.sku}>
                      <td className="pl-5 font-semibold sm:pl-6">{row.product.name}</td>
                      <td className="r whitespace-nowrap">
                        <div className={cx("font-semibold", row.available <= 0 ? "text-bad" : "text-warn")}>{row.available}</div>
                        <div className="hint">make more under {row.product.reorderPoint}</div>
                      </td>
                      <td className="r display text-lead font-semibold whitespace-nowrap">{units(q, row.product.unit)}</td>
                      <td className="r pr-5 sm:pr-6">
                        <button className="btn btn-ghost btn-sm" onClick={() => prefill(row.product.sku, q)}>
                          Make this
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>

      <div className="grid items-start gap-5 2xl:grid-cols-[1.5fr_1fr]">
        <Panel title="Batches" sub="Newest first" bodyClass="p-0">
          {batches.length === 0 ? (
            <Empty title="No batches yet">Record the first batch from the line and it shows up here and in Inventory.</Empty>
          ) : (
            <>
              <div className="overflow-x-auto scroll-thin">
                <table className="tbl min-w-[720px]">
                  <thead>
                    <tr>
                      <th className="pl-5 sm:pl-6">Made</th>
                      <th>Product</th>
                      <th className="r">Quantity</th>
                      <th>Batch no.</th>
                      <th className="pr-5 sm:pr-6">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {batches.slice(0, allBatches ? undefined : BATCHES_SHOWN).map((b) => {
                      const lot = lotById.get(b.lotId);
                      return (
                        <tr key={b.id}>
                          <td className="pl-5 whitespace-nowrap sm:pl-6">{b.madeAt >= dayStart ? `Today ${clock(b.madeAt)}` : dateTime(b.madeAt)}</td>
                          <td>
                            <Link href={`/inventory?sku=${b.sku}`} className="font-semibold hover:underline">
                              {product.get(b.sku)?.name}
                            </Link>
                            {b.note && <div className="hint">{b.note}</div>}
                          </td>
                          <td className="r font-semibold whitespace-nowrap">
                            {b.qty} <span className="text-small font-normal text-ink-3">{product.get(b.sku)?.unit}</span>
                          </td>
                          <td className="code whitespace-nowrap text-ink-2">{lot?.code ?? b.number}</td>
                          <td className="pr-5 sm:pr-6">{lot && <LotBadge lot={lot} now={now} sellable="In stock" />}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {batches.length > BATCHES_SHOWN && (
                <div className="border-t border-line p-4 sm:px-6">
                  <button className="btn btn-ghost w-full" onClick={() => setAllBatches((v) => !v)}>
                    {allBatches ? "Show the latest only" : `Show all ${batches.length} batches`}
                  </button>
                </div>
              )}
            </>
          )}
        </Panel>

        <Panel title="Made per product" sub="Counted in each product&rsquo;s selling unit" bodyClass="p-0">
          {summary.length === 0 ? (
            <Empty title="Nothing made in the last 7 days" />
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th className="pl-5 sm:pl-6">Product</th>
                  <th className="r">Today</th>
                  <th className="r pr-5 sm:pr-6">Last 7 days</th>
                </tr>
              </thead>
              <tbody>
                {summary.map((p) => (
                  <tr key={p.sku}>
                    <td className="pl-5 font-semibold sm:pl-6">{p.name}</td>
                    <td className="r">{today.get(p.sku) ?? "–"}</td>
                    <td className="r pr-5 font-semibold sm:pr-6">{week.get(p.sku)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      </div>
    </div>
  );
}
