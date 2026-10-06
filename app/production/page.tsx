"use client";

import { Factory } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Empty, Field, LotBadge, PageHead, Panel, cx } from "@/components/ui";
import { DAY, capitalize, clock, dateTime, plural, startOfDay, unitPlural, units } from "@/lib/format";
import { queryParam, useStock, useToday } from "@/lib/hooks";
import { BLAST_HOURS, commonUnit, producedBySku, toMake } from "@/lib/logic";
import { useStore, useUi } from "@/lib/store";

const BY = "Production line";

export default function Production() {
  const { now } = useToday();
  const products = useStore((s) => s.products);
  const batches = useStore((s) => s.batches);
  const lots = useStore((s) => s.lots);
  const produce = useStore((s) => s.produce);
  const toast = useUi((s) => s.toast);
  const { rows } = useStock();

  const [sku, setSku] = useState(() => queryParam("sku") ?? "");
  const [qty, setQty] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

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
      <PageHead title="Production" sub={`${plural(madeToday.length, "batch", "batches")} today, ${units(casesToday, commonUnit(madeToday.map((b) => product.get(b.sku))))} made. Finished batches go into the blast freezer and can be sold once frozen, ${BLAST_HOURS} hours later.`} />

      <div className="mb-5 grid items-start gap-5 xl:grid-cols-[380px_1fr]">
        <Panel title="Record a batch">
          <form onSubmit={submit} className="flex flex-col gap-3">
            <Field label="Product">
              <select className="input" value={sku} onChange={(e) => setSku(e.target.value)} required>
                <option value="">Choose a product…</option>
                {products.filter((p) => p.active || p.sku === sku).map((p) => (
                  <option key={p.sku} value={p.sku}>
                    {p.sku} {p.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label={sku ? `${capitalize(unitPlural(product.get(sku)?.unit ?? "unit"))} made` : "Quantity made"}
              hint={sku ? `${product.get(sku)?.pack} per ${product.get(sku)?.unit}. ${units(rows.get(sku)?.available ?? 0, product.get(sku)?.unit ?? "unit")} free to sell now.` : undefined}
            >
              <input id="batch-qty" className="input" type="number" inputMode="numeric" min={1} step={1} value={qty} onChange={(e) => setQty(e.target.value)} required />
            </Field>
            <Field label="Note (optional)">
              <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Shift, line, or anything QA should know" />
            </Field>
            {error && <p className="text-[13.5px] font-semibold text-bad">{error}</p>}
            <button className="btn btn-primary btn-lg" type="submit">
              <Factory size={18} aria-hidden /> Record batch
            </button>
          </form>
        </Panel>

        <Panel title="To make" actions={<span className="text-[13px] text-ink-3">Under reorder point, topped up to par</span>} bodyClass="p-0">
          {suggestions.length === 0 ? (
            <Empty title="Nothing below reorder point">Every product has enough free stock.</Empty>
          ) : (
            <div className="max-h-[420px] overflow-auto scroll-thin">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th className="r">Free / reorder at</th>
                    <th className="r">Make</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {suggestions.map(({ row, qty: q }) => (
                    <tr key={row.product.sku}>
                      <td>
                        <div className="font-semibold">{row.product.name}</div>
                        <div className="code text-ink-3">{row.product.sku}</div>
                      </td>
                      <td className="r whitespace-nowrap">
                        <span className={cx("font-semibold", row.available <= 0 ? "text-bad" : "text-warn")}>{row.available}</span>
                        <span className="text-ink-3"> / {row.product.reorderPoint}</span>
                      </td>
                      <td className="r display text-[18px] font-semibold whitespace-nowrap">{units(q, row.product.unit)}</td>
                      <td className="r">
                        <button className="btn btn-ghost btn-sm" onClick={() => prefill(row.product.sku, q)}>
                          Use
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

      <div className="grid items-start gap-5 xl:grid-cols-[1.4fr_1fr]">
        <Panel title="Batches" bodyClass="p-0">
          {batches.length === 0 ? (
            <Empty title="No batches yet">Record the first batch from the line and it shows up here and in Inventory.</Empty>
          ) : (
            <div className="max-h-[480px] overflow-auto scroll-thin">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Made</th>
                    <th>Batch</th>
                    <th>Product</th>
                    <th className="r">Qty</th>
                    <th>Lot</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {batches.map((b) => {
                    const lot = lotById.get(b.lotId);
                    return (
                      <tr key={b.id}>
                        <td className="whitespace-nowrap">{b.madeAt >= dayStart ? clock(b.madeAt) : dateTime(b.madeAt)}</td>
                        <td className="code">{b.number}</td>
                        <td>
                          <Link href={`/inventory?sku=${b.sku}`} className="font-semibold hover:underline">
                            {product.get(b.sku)?.name}
                          </Link>
                          {b.note && <div className="text-[12.5px] text-ink-3">{b.note}</div>}
                        </td>
                        <td className="r font-semibold whitespace-nowrap">
                          {b.qty} <span className="text-[12.5px] font-normal text-ink-3">{product.get(b.sku)?.unit}</span>
                        </td>
                        <td className="code text-ink-2">{lot?.code}</td>
                        <td>{lot && <LotBadge lot={lot} now={now} sellable="In stock" />}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel title="Produced by product" actions={<span className="text-[13px] text-ink-3">In each product&rsquo;s unit</span>} bodyClass="p-0">
          {summary.length === 0 ? (
            <Empty title="Nothing made in the last 7 days" />
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Product</th>
                  <th className="r">Today</th>
                  <th className="r">7 days</th>
                </tr>
              </thead>
              <tbody>
                {summary.map((p) => (
                  <tr key={p.sku}>
                    <td className="font-semibold">{p.name}</td>
                    <td className="r">{today.get(p.sku) ?? "–"}</td>
                    <td className="r font-semibold">{week.get(p.sku)}</td>
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
