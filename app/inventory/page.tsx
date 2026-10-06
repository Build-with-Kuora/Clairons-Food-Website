"use client";

import { Download, Factory, ListFilter, Pencil, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { CategoryTile } from "@/components/CategoryTile";
import { AdjustModal, HoldModal, MoveModal } from "@/components/InventoryModals";
import { ProductForm } from "@/components/ProductForm";
import { Badge, Drawer, Empty, LevelBar, LotBadge, PageHead, Pager, Panel, Tabs, ZoneTag, cx } from "@/components/ui";
import { capitalize, count, dateKey, dateTime, day, daysUntil, money, money0, plural, temp, unitPlural, units } from "@/lib/format";
import { useIsAdmin } from "@/lib/auth";
import { queryParam, useMaps, useNow, useStock } from "@/lib/hooks";
import { ZONES, ZONE_ORDER, caseCost, commonUnit, coreLimitC, isFreezing, priceUnit, zoneOfBin, type StockRow } from "@/lib/logic";
import { useStore, useUi } from "@/lib/store";
import type { Category, Lot, MoveType, Product, ZoneId } from "@/lib/types";

type Tab = "stock" | "lots" | "moves" | "products";

const MOVE_TONE: Record<MoveType, "good" | "neutral" | "warn" | "bad" | "accent"> = {
  PRODUCE: "good",
  SHIP: "neutral",
  PICKUP: "neutral",
  ADJUST: "warn",
  WASTE: "bad",
  TRANSFER: "accent",
  RETURN: "warn",
  HOLD: "bad",
  RELEASE: "good",
};

/** A stock change with its sign: "+12", "−5" (a real minus sign), or a dash for no change. */
const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "–");

const MOVE_LABEL: Record<MoveType, string> = {
  PRODUCE: "Produced",
  SHIP: "Shipped",
  PICKUP: "Walk-in",
  ADJUST: "Count corrected",
  WASTE: "Written off",
  TRANSFER: "Moved",
  RETURN: "Returned",
  HOLD: "Held",
  RELEASE: "Released",
};

/** A search from the header restarts the page on the Stock tab with that search; leaving the page forgets it. */
export default function Inventory() {
  const searchId = useUi((s) => s.searchId);
  useEffect(() => () => useUi.getState().clearInventorySearch(), []);
  return <InventoryPage key={searchId} />;
}

function InventoryPage() {
  const [tab, setTab] = useState<Tab>(() => (useUi.getState().inventorySearch ? "stock" : ((queryParam("tab") as Tab | null) ?? "stock")));
  const [openSku, setOpenSku] = useState<string | null>(() => queryParam("sku"));
  const { rows } = useStock();
  const lots = useStore((s) => s.lots);
  const products = useStore((s) => s.products);
  const now = useNow();
  const admin = useIsAdmin();
  const [adding, setAdding] = useState(false);

  const all = [...rows.values()];
  const totalCases = all.reduce((s, r) => s + r.onHand, 0);
  const value = all.reduce((s, r) => s + r.value, 0);
  const low = all.filter((r) => r.available < r.product.reorderPoint);
  const shortDated = lots.filter((l) => l.qty > 0 && daysUntil(l.bestBy, now) <= 30);
  const held = lots.filter((l) => l.qty > 0 && l.status === "HOLD");

  const active = all.filter((r) => r.product.active);
  const out = active.filter((r) => r.available <= 0);

  return (
    <div className="mx-auto max-w-[1500px]">
      <PageHead
        sub={`${plural(active.length, "product")}, ${units(totalCases, commonUnit(products))} in storage, worth ${money0(value)} at cost.`}
        actions={
          <>
            <Link href="/production" className="btn btn-ghost">
              <Factory size={20} aria-hidden /> What to make
              {low.length > 0 && <span className="rounded-full bg-warn-bg px-2 text-caption text-warn">{low.length}</span>}
            </Link>
            {admin && (
              <button className="btn btn-primary" onClick={() => setAdding(true)}>
                <Plus size={20} aria-hidden /> Add product
              </button>
            )}
          </>
        }
      />
      {adding && <ProductForm onClose={() => setAdding(false)} />}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 sm:gap-5">
        <SummaryCard title="Products in stock" tone="ink" value={count(active.length - out.length)} note={`of ${plural(active.length, "product")} on sale`} />
        <SummaryCard
          title="Running low"
          tone="bad"
          value={count(low.filter((r) => r.product.active).length)}
          note={out.length ? `${count(out.length)} out of stock` : "None out of stock"}
          href="/inventory?filter=low"
          onClick={() => setTab("stock")}
        />
      </div>

      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "stock", label: "Stock" },
          { id: "lots", label: "Batches and best-by dates", count: shortDated.length + held.length || undefined },
          { id: "moves", label: "Stock history" },
          { id: "products", label: "Products and prices" },
        ]}
      />
      <div className="mt-5">
        {tab === "stock" && <StockTab rows={all} onOpen={setOpenSku} />}
        {tab === "lots" && <LotsTab onOpen={setOpenSku} />}
        {tab === "moves" && <MovesTab />}
        {tab === "products" && <ProductsTab onOpen={setOpenSku} />}
      </div>

      {openSku && rows.get(openSku) && (
        <ProductDrawer row={rows.get(openSku)!} onClose={() => setOpenSku(null)} />
      )}
    </div>
  );
}

/** One of the two cards over the items table: a colored title, the count, and a note. */
function SummaryCard({ title, tone, value, note, href, onClick }: { title: string; tone: "ink" | "bad"; value: string; note: string; href?: string; onClick?: () => void }) {
  const body = (
    <>
      <div className={cx("text-lead font-semibold", tone === "bad" ? "text-bad" : "text-ink")}>{title}</div>
      <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="display text-figure leading-none font-semibold">{value}</span>
        <span className="text-body text-ink-2">{note}</span>
      </div>
      {href && <span className="mt-3 block text-small font-semibold text-brand">Show these products</span>}
    </>
  );
  const cls = "block rounded-2xl border border-line/70 bg-panel p-5 shadow-card sm:p-6";
  return href ? (
    <Link href={href} onClick={onClick} className={cx(cls, "transition-colors hover:border-line-2")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

type StockStatus = "in" | "low" | "out" | "hold" | "freezing";

/** What the status pill says. Low is below the reorder point; out with stock held or freezing says why. */
function stockStatus(r: StockRow): StockStatus {
  if (r.available <= 0) return r.held > 0 ? "hold" : r.freezing > 0 ? "freezing" : "out";
  return r.available < r.product.reorderPoint ? "low" : "in";
}

const STATUS_PILL: Record<StockStatus, { label: string; dot: string; text: string }> = {
  in: { label: "In stock", dot: "bg-good", text: "text-good" },
  low: { label: "Running low", dot: "bg-warn", text: "text-warn" },
  out: { label: "Out of stock", dot: "bg-bad", text: "text-bad" },
  hold: { label: "On hold", dot: "bg-bad", text: "text-bad" },
  freezing: { label: "Freezing", dot: "bg-accent", text: "text-accent" },
};

type StatusFilter = "" | "in" | "below" | "out" | "hold";

const PAGE = 10;

/** Stock history rows per page. */
const HISTORY_PAGE = 20;

function StockTab({ rows, onOpen }: { rows: StockRow[]; onOpen: (sku: string) => void }) {
  const admin = useIsAdmin();
  const [q, setQ] = useState(() => useUi.getState().inventorySearch || queryParam("q") || "");
  const [zone, setZone] = useState<ZoneId | "">("");
  const [cat, setCat] = useState<Category | "">("");
  // The dashboard's "Running low" card links here with ?filter=low.
  const [status, setStatus] = useState<StatusFilter>(() => (queryParam("filter") === "low" ? "below" : ""));
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<Product | null>(null);
  const now = useNow();
  const cats = [...new Set(rows.map((r) => r.product.category))];
  const list = rows.filter((r) => {
    const s = stockStatus(r);
    return (
      (!q || r.product.name.toLowerCase().includes(q.toLowerCase()) || r.product.sku.toLowerCase().includes(q.toLowerCase())) &&
      (!zone || r.product.zone === zone) &&
      (!cat || r.product.category === cat) &&
      (!status ||
        (status === "in" && s === "in") ||
        (status === "below" && r.available < r.product.reorderPoint) ||
        (status === "out" && r.available <= 0) ||
        (status === "hold" && r.held > 0))
    );
  });
  const pages = Math.max(1, Math.ceil(list.length / PAGE));
  const at = Math.min(page, pages - 1);
  const shown = list.slice(at * PAGE, at * PAGE + PAGE);
  // Any change to the search or filters goes back to the first page.
  const first = () => setPage(0);

  /** The filtered rows as a CSV file, in each product's selling unit. Value is at cost. */
  function exportCsv() {
    const cell = (v: string | number) => (typeof v === "number" ? String(v) : /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const lines = [
      ["SKU", "Product", "Category", "Unit", "On hand", "Reserved", "Held", "Freezing", "Free to sell", "Reorder point", "List price", "Stock value at cost", "Status"].join(","),
      ...list.map((r) =>
        [r.product.sku, r.product.name, r.product.category, r.product.unit, r.onHand, r.reserved, r.held, r.freezing, r.available, r.product.reorderPoint, r.product.price.C, Math.round(r.value * 100) / 100, STATUS_PILL[stockStatus(r)].label]
          .map(cell)
          .join(","),
      ),
    ];
    const blob = new Blob([lines.join("\r\n") + "\r\n"], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `clairons-inventory-${dateKey(now)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <Panel
      title="Stock"
      sub={`${plural(list.length, "product")}${list.length !== rows.length ? ` of ${rows.length}` : ""}`}
      bodyClass=""
      actions={
        <button className="btn btn-ghost btn-sm" onClick={exportCsv} disabled={!list.length}>
          <Download size={18} aria-hidden /> Download list
        </button>
      }
    >
      <div className="flex flex-wrap items-center gap-3 px-5 pb-5 sm:px-6">
        <div className="relative min-w-[240px] flex-1 md:max-w-[380px]">
          <Search size={20} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-3" aria-hidden />
          <input className="input pl-11" placeholder="Search by product name" value={q} onChange={(e) => {
              setQ(e.target.value);
              first();
            }} aria-label="Search inventory" />
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
          <ListFilter size={20} className="text-ink-3" aria-hidden />
          <select className="input w-auto" value={status} onChange={(e) => {
              setStatus(e.target.value as StatusFilter);
              first();
            }} aria-label="Status">
            <option value="">Any stock level</option>
            <option value="in">In stock</option>
            <option value="below">Running low</option>
            <option value="out">Out of stock</option>
            <option value="hold">On hold</option>
          </select>
          <select className="input w-auto" value={cat} onChange={(e) => {
              setCat(e.target.value as Category | "");
              first();
            }} aria-label="Category">
            <option value="">All categories</option>
            {cats.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <select className="input w-auto" value={zone} onChange={(e) => {
              setZone(e.target.value as ZoneId | "");
              first();
            }} aria-label="Storage area">
            <option value="">All storage areas</option>
            {ZONE_ORDER.map((z) => (
              <option key={z} value={z}>
                {ZONES[z].name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="overflow-x-auto border-t border-line scroll-thin">
        <table className="tbl min-w-[860px]">
          <thead>
            <tr>
              <th className="pl-5 sm:pl-6">Product</th>
              <th className="r">Available</th>
              <th className="r">In storage</th>
              <th className="r">Price</th>
              <th>Status</th>
              <th className="r pr-5 sm:pr-6">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => {
              const s = STATUS_PILL[stockStatus(r)];
              return (
                <tr key={r.product.sku} className="clickable" onClick={() => onOpen(r.product.sku)}>
                  <td className="pl-5 sm:pl-6">
                    <div className="flex items-center gap-3">
                      <CategoryTile category={r.product.category} size="md" />
                      <div className="min-w-0">
                        <div className="font-semibold">
                          {r.product.name} {!r.product.active && <Badge>Inactive</Badge>}
                        </div>
                        <div className="hint">
                          {r.product.category}, per {r.product.unit} ({r.product.pack})
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className={cx("r text-lead font-semibold", r.available < r.product.reorderPoint && "text-warn", r.available <= 0 && "text-bad")}>{r.available}</td>
                  <td className="r text-ink-2">{r.onHand}</td>
                  <td className="r whitespace-nowrap text-ink-2">
                    {money0(r.product.price.C)}
                    <span className="text-small">/{priceUnit(r.product)}</span>
                  </td>
                  <td>
                    <span className={cx("inline-flex items-center gap-2 text-small font-semibold whitespace-nowrap", s.text)}>
                      <span className={cx("h-2.5 w-2.5 rounded-full", s.dot)} aria-hidden />
                      {s.label}
                    </span>
                  </td>
                  <td className="r pr-5 whitespace-nowrap sm:pr-6" onClick={(e) => e.stopPropagation()}>
                    <span className="inline-flex gap-2">
                      <button className="btn btn-ghost btn-sm" onClick={() => onOpen(r.product.sku)}>
                        Open
                      </button>
                      {admin && (
                        <button className="btn btn-quiet btn-sm" onClick={() => setEditing(r.product)}>
                          <Pencil size={16} aria-hidden /> Edit
                        </button>
                      )}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {list.length === 0 && <Empty title="No products match these filters">Clear the search or set the filters back to all.</Empty>}
      </div>
      <Pager page={at} pages={pages} onChange={setPage} />
      <p className="border-t border-line px-5 py-3 hint sm:px-6">
        Counted in each product&rsquo;s selling unit. &ldquo;Available&rdquo; is what is in storage minus what is set aside for orders. Open a product to see its batches, best-by dates and to correct a count.
      </p>
      {editing && <ProductForm key={editing.sku} product={editing} onClose={() => setEditing(null)} />}
    </Panel>
  );
}

function ProductDrawer({ row, onClose }: { row: StockRow; onClose: () => void }) {
  const p = row.product;
  const movements = useStore((s) => s.movements);
  const { reserved } = useStock();
  const now = useNow();
  const [adjusting, setAdjusting] = useState<Lot | null>(null);
  const [moving, setMoving] = useState<Lot | null>(null);
  const [holding, setHolding] = useState<Lot | null>(null);
  const [editing, setEditing] = useState(false);
  const admin = useIsAdmin();
  const moves = movements.filter((m) => m.sku === p.sku).slice(0, 14);
  const unit = priceUnit(p);

  return (
    <Drawer
      open
      onClose={onClose}
      title={p.name}
      sub={
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span>
            Sold per {p.unit}, {p.pack}
          </span>
          <span className="text-ink-3">Code {p.sku}</span>
          <ZoneTag zone={p.zone} />
          {!p.active && <Badge>Inactive</Badge>}
        </span>
      }
      footer={
        <>
          {p.active && (
            <Link href={`/production?sku=${p.sku}`} className="btn btn-primary">
              <Factory size={20} aria-hidden /> Make a batch
            </Link>
          )}
          {admin && (
            <button className="btn btn-ghost" onClick={() => setEditing(true)}>
              <Pencil size={18} aria-hidden /> Edit product
            </button>
          )}
          <span className="ml-auto hint">Kept in bin {p.bin}, lasts {p.shelfDays} days</span>
        </>
      }
    >
      <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-line sm:grid-cols-3">
        {[
          ["Available", row.available],
          ["In storage", row.onHand],
          ["Set aside for orders", row.reserved],
          ["On hold", row.held],
          ["Still freezing", row.freezing],
        ].map(([l, v]) => (
          <div key={l} className="border-line px-4 py-3 not-last:border-b sm:border-r">
            <div className="text-small text-ink-2">{l}</div>
            <div className={cx("display mt-1 text-heading leading-none font-semibold", l === "On hold" && Number(v) > 0 && "text-bad")}>{v}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-small text-ink-2">
        <LevelBar value={row.available} reorder={p.reorderPoint} par={p.par} width={180} />
        In {unitPlural(p.unit)}. Make more under {p.reorderPoint}; aim for {p.par}.
      </div>

      <h3 className="display mt-7 mb-3 text-title font-semibold">Batches, oldest best-by first</h3>
      <div className="overflow-x-auto rounded-lg border border-line scroll-thin">
        <table className="tbl min-w-[600px]">
          <thead>
            <tr>
              <th>Batch</th>
              <th>Where</th>
              <th>Made</th>
              <th>Best-by</th>
              <th className="r">{capitalize(unitPlural(p.unit))}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {row.lots.map((l) => {
              const d = daysUntil(l.bestBy, now);
              return (
                <tr key={l.id} className={l.status === "HOLD" ? "bg-bad-bg/40" : undefined}>
                  <td>
                    <div className="code font-medium whitespace-nowrap">{l.code}</div>
                    {l.status === "HOLD" || isFreezing(l) ? <LotBadge lot={l} now={now} /> : reserved[l.id] ? <span className="hint">{reserved[l.id]} set aside</span> : null}
                  </td>
                  <td>
                    <div className="code">{l.bin}</div>
                    <div className="hint">{ZONES[zoneOfBin(l.bin)].name}</div>
                  </td>
                  <td>
                    <div>{day(l.madeAt)}</div>
                    <div className={cx("text-small", l.coreTempC > coreLimitC(p.zone) ? "font-semibold text-bad" : "text-ink-3")}>inside temp {temp(l.coreTempC)}</div>
                  </td>
                  <td className={cx(d <= 30 && "font-semibold text-warn")}>
                    {day(l.bestBy)}
                    <div className="text-small font-normal text-ink-3">{d < 0 ? "Expired" : `${d} days left`}</div>
                  </td>
                  <td className="r font-semibold">{l.qty}</td>
                  <td className="r whitespace-nowrap">
                    <span className="inline-flex gap-1">
                      <button className="btn btn-ghost btn-sm" onClick={() => setAdjusting(l)}>Correct count</button>
                      <button className="btn btn-quiet btn-sm" onClick={() => setMoving(l)}>Move</button>
                      <button className={cx("btn btn-sm", l.status === "HOLD" ? "btn-ghost" : "btn-quiet")} onClick={() => setHolding(l)}>{l.status === "HOLD" ? "Release" : "Hold"}</button>
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {row.lots.length === 0 && <Empty title="None in storage">Record a production batch to add stock.</Empty>}
      </div>
      {row.lots.filter((l) => l.holdReason).map((l) => (
        <p key={l.id} className="mt-2 rounded-xl border border-bad/25 bg-bad-bg p-3 text-small text-bad">
          <span className="font-semibold">Batch {l.code} on hold:</span> {l.holdReason}
        </p>
      ))}

      <h3 className="display mt-7 mb-3 text-title font-semibold">Prices</h3>
      <table className="tbl rounded-lg border border-line">
        <thead>
          <tr>
            <th>Price list</th>
            <th className="r">Price /{unit}</th>
            <th className="r">Price per {p.unit}</th>
            <th className="r">Margin</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="text-ink-3">Production cost</td>
            <td className="r text-ink-3">{money(p.cost)}</td>
            <td className="r text-ink-3">{money(caseCost(p))}</td>
            <td className="r text-ink-3">–</td>
          </tr>
          {(["A", "B", "C"] as const).map((t) => (
            <tr key={t}>
              <td>
                {t === "A" ? "Contract" : t === "B" ? "Standard" : "Walk-in and online"} <span className="hint">({t})</span>
              </td>
              <td className="r font-semibold">{money(p.price[t])}</td>
              <td className="r">{money(p.catchWeight ? p.price[t] * p.caseKg : p.price[t])}</td>
              <td className="r">{(((p.price[t] - p.cost) / p.price[t]) * 100).toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
      {p.catchWeight && <p className="mt-2 hint">Sold by weight: charged on the actual weight from the scale. The price per {p.unit} assumes {p.caseKg} kg.</p>}

      <h3 className="display mt-7 mb-3 text-title font-semibold">Recent stock history</h3>
      <ul className="divide-y divide-line rounded-xl border border-line">
        {moves.map((m) => (
          <li key={m.id} className="flex items-center gap-3 px-4 py-3 text-body">
            <Badge tone={MOVE_TONE[m.type]} className="w-[104px] justify-center">{MOVE_LABEL[m.type]}</Badge>
            <span className="min-w-0 flex-1 truncate">
              {m.ref && <span className="code mr-1.5">{m.ref}</span>}
              <span className="text-ink-2">{m.note ?? (m.lotCode ? `Batch ${m.lotCode}` : "")}</span>
            </span>
            <span className={cx("w-12 text-right font-semibold", m.qty > 0 ? "text-good" : m.qty < 0 ? "text-ink" : "text-ink-3")}>{signed(m.qty)}</span>
            <span className="w-[130px] text-right text-small text-ink-3">{dateTime(m.at)}</span>
          </li>
        ))}
      </ul>

      {adjusting && <AdjustModal key={adjusting.id} lot={adjusting} onClose={() => setAdjusting(null)} />}
      {moving && <MoveModal key={moving.id} lot={moving} onClose={() => setMoving(null)} />}
      {holding && <HoldModal key={holding.id} lot={holding} onClose={() => setHolding(null)} />}
      {editing && <ProductForm product={p} onClose={() => setEditing(false)} />}
    </Drawer>
  );
}

function LotsTab({ onOpen }: { onOpen: (sku: string) => void }) {
  const lots = useStore((s) => s.lots);
  const maps = useMaps();
  const { reserved } = useStock();
  const now = useNow();
  const [filter, setFilter] = useState<"all" | "short" | "hold">("all");
  const list = lots
    .filter((l) => l.qty > 0)
    .filter((l) => (filter === "short" ? daysUntil(l.bestBy, now) <= 30 : filter === "hold" ? l.status === "HOLD" : true))
    .sort((a, b) => a.bestBy - b.bestBy);
  return (
    <Panel bodyClass="">
      <div className="flex flex-wrap items-center gap-2 border-b border-line p-4 sm:px-6">
        {(
          [
            ["all", "All batches"],
            ["short", "Expiring within 30 days"],
            ["hold", "On hold"],
          ] as const
        ).map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)} aria-pressed={filter === k} className="chip">
            {l}
          </button>
        ))}
        <span className="hint lg:ml-auto">Oldest best-by date first. Sell them in this order.</span>
      </div>
      <div className="overflow-x-auto scroll-thin">
        <table className="tbl min-w-[980px]">
          <thead>
            <tr>
              <th>Best-by</th>
              <th>Product</th>
              <th>Batch</th>
              <th>Where</th>
              <th>Made</th>
              <th className="r">Quantity</th>
              <th className="r">Set aside</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {list.map((l) => {
              const d = daysUntil(l.bestBy, now);
              const p = maps.product.get(l.sku);
              return (
                <tr key={l.id} className="clickable" onClick={() => onOpen(l.sku)}>
                  <td className={cx(d <= 14 ? "font-semibold text-bad" : d <= 30 ? "font-semibold text-warn" : "")}>
                    {day(l.bestBy)}
                    <div className="text-small font-normal text-ink-3">{d < 0 ? "Expired" : `${d} days left`}</div>
                  </td>
                  <td className="font-semibold">{p?.name}</td>
                  <td className="code font-medium whitespace-nowrap">{l.code}</td>
                  <td>
                    <span className="code">{l.bin}</span>
                    <div className="hint">{ZONES[zoneOfBin(l.bin)].name}</div>
                  </td>
                  <td className="whitespace-nowrap text-ink-2">{day(l.madeAt)}</td>
                  <td className="r font-semibold whitespace-nowrap">
                    {l.qty} <span className="text-small font-normal text-ink-3">{l.qty === 1 ? p?.unit : unitPlural(p?.unit ?? "unit")}</span>
                  </td>
                  <td className="r text-ink-2">{reserved[l.id] || "–"}</td>
                  <td><LotBadge lot={l} now={now} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {list.length === 0 && <Empty title="Nothing here">No batches match this filter right now.</Empty>}
      </div>
    </Panel>
  );
}

function MovesTab() {
  const movements = useStore((s) => s.movements);
  const maps = useMaps();
  const [type, setType] = useState<MoveType | "">("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const list = movements.filter((m) => (!type || m.type === type) && (!q || m.sku.toLowerCase().includes(q.toLowerCase()) || (m.ref ?? "").toLowerCase().includes(q.toLowerCase()) || (m.lotCode ?? "").includes(q)));
  const pages = Math.max(1, Math.ceil(list.length / HISTORY_PAGE));
  const at = Math.min(page, pages - 1);
  const shown = list.slice(at * HISTORY_PAGE, at * HISTORY_PAGE + HISTORY_PAGE);
  return (
    <Panel bodyClass="">
      <div className="flex flex-wrap items-center gap-3 border-b border-line p-4 sm:px-6">
        <input
          className="input max-w-[320px]"
          placeholder="Product code, batch or order number"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(0);
          }}
          aria-label="Search stock history"
        />
        <select
          className="input w-auto"
          value={type}
          onChange={(e) => {
            setType(e.target.value as MoveType | "");
            setPage(0);
          }}
          aria-label="Kind of change"
        >
          <option value="">All kinds of change</option>
          {(Object.keys(MOVE_LABEL) as MoveType[]).map((t) => (
            <option key={t} value={t}>
              {MOVE_LABEL[t]}
            </option>
          ))}
        </select>
        <span className="hint lg:ml-auto">{count(list.length)} of {count(movements.length)} changes, newest first</span>
      </div>
      <div className="overflow-x-auto scroll-thin">
        <table className="tbl min-w-[960px]">
          <thead>
            <tr>
              <th>When</th>
              <th>What</th>
              <th>Product</th>
              <th>Batch</th>
              <th className="r">Change</th>
              <th>Order or batch no.</th>
              <th>By</th>
              <th>Note</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((m) => (
              <tr key={m.id}>
                <td className="whitespace-nowrap text-ink-2">{dateTime(m.at)}</td>
                <td>
                  <Badge tone={MOVE_TONE[m.type]}>{MOVE_LABEL[m.type]}</Badge>
                </td>
                <td>
                  <div className="max-w-[280px] font-semibold">{maps.product.get(m.sku)?.name}</div>
                </td>
                <td className="code">{m.lotCode ?? "–"}</td>
                <td className={cx("r font-semibold", m.qty > 0 && "text-good")}>{signed(m.qty)}</td>
                <td className="code">{m.ref ?? "–"}</td>
                <td className="text-ink-2">{m.by}</td>
                <td className="max-w-[280px] text-ink-2">{m.note ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager page={at} pages={pages} onChange={setPage} />
    </Panel>
  );
}

function ProductsTab({ onOpen }: { onOpen: (sku: string) => void }) {
  const products = useStore((s) => s.products);
  const [editing, setEditing] = useState<Product | "new" | null>(null);
  const [showInactive, setShowInactive] = useState(true);
  const admin = useIsAdmin();
  const list = products.filter((p) => showInactive || p.active).sort((a, b) => Number(b.active) - Number(a.active) || a.sku.localeCompare(b.sku));
  const inactive = products.filter((p) => !p.active).length;
  return (
    <Panel bodyClass="">
      <div className="flex flex-wrap items-center gap-3 border-b border-line p-4 sm:px-6">
        {admin && (
          <button className="btn btn-primary" onClick={() => setEditing("new")}>
            <Plus size={20} aria-hidden /> Add product
          </button>
        )}
        <label className="flex h-11 cursor-pointer items-center gap-3 rounded-xl border border-line-2 bg-white px-4 text-body">
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} className="h-5 w-5 accent-ink" />
          Show products no longer sold ({inactive})
        </label>
        <span className="hint lg:ml-auto">
          {admin ? "Products no longer sold keep their stock and history but can’t be ordered or made." : "Only the owner can add or change products and prices."}
        </span>
      </div>
      <div className="overflow-x-auto scroll-thin">
        <table className="tbl min-w-[900px]">
          <thead>
            <tr>
              <th>Product</th>
              <th>Sold per</th>
              <th className="r">Price</th>
              <th className="r">Make more under</th>
              <th className="r">Fill back up to</th>
              <th>Status</th>
              <th>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.sku} className={cx("clickable", !p.active && "text-ink-3")} onClick={() => onOpen(p.sku)}>
                <td>
                  <div className="font-semibold">{p.name}</div>
                  <div className="hint">
                    {p.category}, code {p.sku}
                  </div>
                </td>
                <td>
                  <div className="font-semibold">{p.unit}</div>
                  <div className="hint">
                    {p.pack}, {p.caseKg} kg
                  </div>
                </td>
                <td className="r whitespace-nowrap">
                  <span className="font-semibold">{money(p.price.C)}</span>
                  <span className="text-small text-ink-3">/{priceUnit(p)}</span>
                </td>
                <td className="r">{p.reorderPoint}</td>
                <td className="r">{p.par}</td>
                <td>{p.active ? <Badge tone="good">On sale</Badge> : <Badge>No longer sold</Badge>}</td>
                <td className="r">
                  {admin && (
                    <button
                      className="btn btn-quiet btn-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditing(p);
                      }}
                    >
                      <Pencil size={16} aria-hidden /> Edit
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editing && <ProductForm key={editing === "new" ? "new" : editing.sku} product={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />}
    </Panel>
  );
}
