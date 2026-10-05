"use client";

import { ArrowRight, ChevronLeft, ChevronRight, Download, Ellipsis, Factory, ListFilter, Pencil, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { CategoryTile } from "@/components/CategoryTile";
import { AdjustModal, HoldModal, MoveModal } from "@/components/InventoryModals";
import { ProductForm } from "@/components/ProductForm";
import { Badge, Drawer, Empty, LevelBar, LotBadge, PageHead, Panel, Tabs, ZoneTag, cx } from "@/components/ui";
import { capitalize, count, dateKey, dateTime, day, daysUntil, money, money0, plural, temp, tempBare, unitPlural, units } from "@/lib/format";
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

const MOVE_LABEL: Record<MoveType, string> = {
  PRODUCE: "Produced",
  SHIP: "Shipped",
  PICKUP: "Walk-in",
  ADJUST: "Count adj.",
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
  const categories = new Set(active.map((r) => r.product.category));
  const out = active.filter((r) => r.available <= 0);

  return (
    <div className="mx-auto max-w-[1500px]">
      <PageHead
        title="Inventory summary"
        sub={`${all.length} SKUs, ${units(totalCases, commonUnit(products))} on hand, ${money0(value)} at cost.`}
        actions={
          <>
            <Link href="/production" className="btn btn-ghost">
              <Factory size={16} /> Record batch
            </Link>
            {admin && (
              <button className="btn btn-primary" onClick={() => setAdding(true)}>
                <Plus size={16} /> Add product
              </button>
            )}
          </>
        }
      />
      {adding && <ProductForm onClose={() => setAdding(false)} />}

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <SummaryCard title="Categories" tone="ink" value={`Total ${count(categories.size)}`} note="Sold now" />
        <SummaryCard title="Total products" tone="brand" value={`Total ${count(active.length)}`} note={`${units(totalCases, commonUnit(products))} on hand`} />
        <SummaryCard
          title="Low stock"
          tone="bad"
          value={`Total ${count(low.filter((r) => r.product.active).length)}`}
          note={out.length ? `${count(out.length)} out of stock` : "None out of stock"}
          href="/inventory?filter=low"
          onClick={() => setTab("stock")}
        />
      </div>

      <div className="flex items-end gap-3">
        <div className="min-w-0 flex-1">
          <Tabs<Tab>
            value={tab}
            onChange={setTab}
            tabs={[
              { id: "stock", label: "Stock", count: all.length },
              { id: "lots", label: "Lots and dating", count: shortDated.length + held.length || undefined },
              { id: "moves", label: "Movements" },
              { id: "products", label: "Products" },
            ]}
          />
        </div>
        <Link href="/production" className="flex h-10 shrink-0 items-center gap-1.5 border-b border-line text-[14.5px] font-semibold whitespace-nowrap text-ink-3 hover:text-ink">
          To make
          {low.length > 0 && <span className="rounded bg-warn-bg px-1.5 text-[12px] text-warn">{low.length}</span>}
          <ArrowRight size={14} aria-hidden />
        </Link>
      </div>
      <div className="mt-4">
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

/** One of the three cards over the items table: a colored title, the count, and a note. */
function SummaryCard({ title, tone, value, note, href, onClick }: { title: string; tone: "ink" | "brand" | "bad"; value: string; note: string; href?: string; onClick?: () => void }) {
  const body = (
    <>
      <div className={cx("display text-[26px] leading-tight font-semibold", tone === "brand" ? "text-brand" : tone === "bad" ? "text-bad" : "text-ink")}>{title}</div>
      <div className="mt-3 flex items-end justify-between gap-3">
        <span className="text-[19px] text-ink-2">{value}</span>
        <span className="text-[13.5px] text-ink-3">{note}</span>
      </div>
    </>
  );
  const cls = "block rounded-2xl border border-line/70 bg-panel p-5 shadow-card";
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
  low: { label: "Low stock", dot: "bg-warn", text: "text-warn" },
  out: { label: "Out of stock", dot: "bg-bad", text: "text-bad" },
  hold: { label: "On hold", dot: "bg-bad", text: "text-bad" },
  freezing: { label: "Freezing", dot: "bg-accent", text: "text-accent" },
};

type StatusFilter = "" | "in" | "below" | "out" | "hold";

const PAGE = 10;

function StockTab({ rows, onOpen }: { rows: StockRow[]; onOpen: (sku: string) => void }) {
  const admin = useIsAdmin();
  const [q, setQ] = useState(() => useUi.getState().inventorySearch || queryParam("q") || "");
  const [zone, setZone] = useState<ZoneId | "">("");
  const [cat, setCat] = useState<Category | "">("");
  // The dashboard's "Below reorder point" card links here with ?filter=low.
  const [status, setStatus] = useState<StatusFilter>(() => (queryParam("filter") === "low" ? "below" : ""));
  const [page, setPage] = useState(0);
  const [menu, setMenu] = useState<string | null>(null);
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
      title="Inventory items"
      sub={`${plural(list.length, "product")}${list.length !== rows.length ? ` of ${rows.length}` : ""}`}
      bodyClass=""
      actions={
        <button className="btn btn-primary btn-sm h-9 px-3" onClick={exportCsv} disabled={!list.length}>
          <Download size={15} /> Export
        </button>
      }
    >
      <div className="flex flex-wrap items-center gap-2 px-5 pb-4">
        <div className="relative min-w-[220px] flex-1 md:max-w-[340px]">
          <Search size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-3" />
          <input className="input pl-8" placeholder="Search SKU or product" value={q} onChange={(e) => {
              setQ(e.target.value);
              first();
            }} aria-label="Search inventory" />
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <ListFilter size={16} className="text-ink-3" aria-hidden />
          <select className="input w-auto" value={status} onChange={(e) => {
              setStatus(e.target.value as StatusFilter);
              first();
            }} aria-label="Status">
            <option value="">All statuses</option>
            <option value="in">In stock</option>
            <option value="below">Below reorder point</option>
            <option value="out">Out of stock</option>
            <option value="hold">With held stock</option>
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
            }} aria-label="Zone">
            <option value="">All zones</option>
            {ZONE_ORDER.map((z) => (
              <option key={z} value={z}>
                {ZONES[z].name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="overflow-x-auto border-t border-line scroll-thin">
        <table className="tbl min-w-[1040px]">
          <thead>
            <tr>
              <th className="pl-5">Product name</th>
              <th>Category</th>
              <th>SKU</th>
              <th className="r">On hand</th>
              <th className="r">Reserved</th>
              <th className="r">Free to sell</th>
              <th className="r">Unit price</th>
              <th className="r">Stock value</th>
              <th>Status</th>
              <th className="r pr-5">Action</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => {
              const s = STATUS_PILL[stockStatus(r)];
              return (
                <tr key={r.product.sku} className="clickable" onClick={() => onOpen(r.product.sku)}>
                  <td className="pl-5">
                    <div className="flex items-center gap-3">
                      <CategoryTile category={r.product.category} size="sm" />
                      <div className="min-w-0">
                        <div className="font-semibold">
                          {r.product.name} {!r.product.active && <Badge>Inactive</Badge>}
                        </div>
                        <div className="text-[12.5px] text-ink-3">
                          Per {r.product.unit}, {r.product.pack}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="text-ink-2">{r.product.category}</td>
                  <td className="code text-ink-2">{r.product.sku}</td>
                  <td className="r font-semibold">{r.onHand}</td>
                  <td className="r text-ink-2">{r.reserved || "–"}</td>
                  <td className={cx("r font-semibold", r.available < r.product.reorderPoint && "text-warn", r.available <= 0 && "text-bad")}>{r.available}</td>
                  <td className="r text-ink-2 whitespace-nowrap">
                    {money0(r.product.price.C)}
                    <span className="text-[12px] text-ink-3">/{priceUnit(r.product)}</span>
                  </td>
                  <td className="r text-ink-2">{money0(r.value)}</td>
                  <td>
                    <span className={cx("inline-flex items-center gap-1.5 text-[13px] font-semibold whitespace-nowrap", s.text)}>
                      <span className={cx("h-2 w-2 rounded-full", s.dot)} aria-hidden />
                      {s.label}
                    </span>
                  </td>
                  <td className="r relative pr-5" onClick={(e) => e.stopPropagation()}>
                    <button
                      className="btn btn-quiet btn-sm px-2"
                      onClick={() => setMenu(menu === r.product.sku ? null : r.product.sku)}
                      aria-haspopup="menu"
                      aria-expanded={menu === r.product.sku}
                      aria-label={`Actions for ${r.product.name}`}
                    >
                      <Ellipsis size={18} />
                    </button>
                    {menu === r.product.sku && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setMenu(null)} aria-hidden />
                        <div role="menu" className="rise absolute top-full right-4 z-20 w-44 rounded-xl border border-line bg-panel p-1 text-left shadow-lg">
                          <MenuItem
                            onClick={() => {
                              setMenu(null);
                              onOpen(r.product.sku);
                            }}
                          >
                            Open details
                          </MenuItem>
                          <MenuItem href={`/production?sku=${r.product.sku}`}>Record a batch</MenuItem>
                          {admin && (
                            <MenuItem
                              onClick={() => {
                                setMenu(null);
                                setEditing(r.product);
                              }}
                            >
                              Edit product
                            </MenuItem>
                          )}
                        </div>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {list.length === 0 && <Empty title="No products match these filters">Clear the search or set the filters back to all.</Empty>}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3">
        <div className="flex gap-2">
          <button className="btn btn-ghost btn-sm h-8" onClick={() => setPage(at - 1)} disabled={at === 0}>
            <ChevronLeft size={15} /> Previous
          </button>
          <button className="btn btn-ghost btn-sm h-8" onClick={() => setPage(at + 1)} disabled={at >= pages - 1}>
            Next <ChevronRight size={15} />
          </button>
        </div>
        <span className="text-[13px] text-ink-2">
          Page {at + 1} of {pages}
        </span>
      </div>
      <p className="border-t border-line px-5 py-2.5 text-[12.5px] text-ink-3">
        Counts are in each product&rsquo;s selling unit. Reserved = on orders not yet loaded. Unit price is the list price (tier C); stock value is at cost. Open a product for lots, best-by dates and adjustments.
      </p>
      {editing && <ProductForm key={editing.sku} product={editing} onClose={() => setEditing(null)} />}
    </Panel>
  );
}

function MenuItem({ children, onClick, href }: { children: ReactNode; onClick?: () => void; href?: string }) {
  const cls = "flex w-full cursor-pointer items-center rounded-lg px-3 py-2 text-[14px] font-medium text-ink hover:bg-sunk";
  return href ? (
    <Link role="menuitem" href={href} className={cls}>
      {children}
    </Link>
  ) : (
    <button role="menuitem" className={cls} onClick={onClick}>
      {children}
    </button>
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
          <span className="code">{p.sku}</span>
          <span>
            Sold per {p.unit}, {p.pack}
          </span>
          <ZoneTag zone={p.zone} />
          {!p.active && <Badge>Inactive</Badge>}
        </span>
      }
      footer={
        <>
          {p.active && (
            <Link href={`/production?sku=${p.sku}`} className="btn btn-primary">
              <Factory size={16} /> Make a batch
            </Link>
          )}
          {admin && (
            <button className="btn btn-ghost" onClick={() => setEditing(true)}>
              <Pencil size={15} /> Edit product
            </button>
          )}
          <span className="ml-auto text-[13px] text-ink-3">Home bin {p.bin}, shelf life {p.shelfDays} days</span>
        </>
      }
    >
      <div className="grid grid-cols-5 overflow-hidden rounded-lg border border-line">
        {[
          ["On hand", row.onHand],
          ["Reserved", row.reserved],
          ["Held", row.held],
          ["Freezing", row.freezing],
          ["Free to sell", row.available],
        ].map(([l, v], i) => (
          <div key={l} className={cx("px-3 py-2", i > 0 && "border-l border-line")}>
            <div className="text-[12.5px] text-ink-3">{l}</div>
            <div className={cx("display text-[28px] leading-none font-semibold", l === "Held" && Number(v) > 0 && "text-bad")}>{v}</div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-3 text-[13px] text-ink-3">
        <LevelBar value={row.available} reorder={p.reorderPoint} par={p.par} width={180} />
        In {unitPlural(p.unit)}. Reorder at {p.reorderPoint}, par {p.par}
      </div>

      <h3 className="display mt-6 mb-2 text-[19px] font-semibold">Lots, oldest best-by first</h3>
      <div className="overflow-x-auto rounded-lg border border-line scroll-thin">
        <table className="tbl min-w-[600px]">
          <thead>
            <tr>
              <th>Lot</th>
              <th>Bin</th>
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
                    <div className="code font-medium">{l.code}</div>
                    {l.status === "HOLD" || isFreezing(l) ? <LotBadge lot={l} now={now} /> : reserved[l.id] ? <span className="text-[12.5px] text-ink-3">{reserved[l.id]} reserved</span> : null}
                  </td>
                  <td>
                    <div className="code">{l.bin}</div>
                    <div className="text-[12px] text-ink-3">{ZONES[zoneOfBin(l.bin)].name}</div>
                  </td>
                  <td>
                    <div>{day(l.madeAt)}</div>
                    <div className={cx("text-[12.5px]", l.coreTempC > coreLimitC(p.zone) ? "font-semibold text-bad" : "text-ink-3")}>core {temp(l.coreTempC)}</div>
                  </td>
                  <td className={cx(d <= 30 && "font-semibold text-warn")}>
                    {day(l.bestBy)}
                    <div className="text-[12.5px] font-normal text-ink-3">{d < 0 ? "Expired" : `${d} days`}</div>
                  </td>
                  <td className="r font-semibold">{l.qty}</td>
                  <td className="r whitespace-nowrap">
                    <span className="inline-flex gap-0.5">
                      <button className="btn btn-quiet btn-sm px-2" onClick={() => setAdjusting(l)}>Adjust</button>
                      <button className="btn btn-quiet btn-sm px-2" onClick={() => setMoving(l)}>Move</button>
                      <button className={cx("btn btn-sm px-2", l.status === "HOLD" ? "btn-ghost" : "btn-quiet")} onClick={() => setHolding(l)}>{l.status === "HOLD" ? "Release" : "Hold"}</button>
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {row.lots.length === 0 && <Empty title="No stock on hand">Record a production batch to create the first lot.</Empty>}
      </div>
      {row.lots.filter((l) => l.holdReason).map((l) => (
        <p key={l.id} className="mt-2 rounded-md border border-bad/25 bg-bad-bg p-2.5 text-[13px] text-bad">
          <span className="font-semibold">Lot {l.code}:</span> {l.holdReason}
        </p>
      ))}

      <h3 className="display mt-6 mb-2 text-[19px] font-semibold">Pricing</h3>
      <table className="tbl rounded-lg border border-line">
        <thead>
          <tr>
            <th>Tier</th>
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
                Tier {t} <span className="text-[12.5px] text-ink-3">{t === "A" ? "contract" : t === "B" ? "standard" : "list"}</span>
              </td>
              <td className="r font-semibold">{money(p.price[t])}</td>
              <td className="r">{money(p.catchWeight ? p.price[t] * p.caseKg : p.price[t])}</td>
              <td className="r">{(((p.price[t] - p.cost) / p.price[t]) * 100).toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
      {p.catchWeight && <p className="mt-1.5 text-[12.5px] text-ink-3">Catch weight: invoiced at actual weight from the pick scale. Price per {p.unit} assumes {p.caseKg} kg.</p>}

      <h3 className="display mt-6 mb-2 text-[19px] font-semibold">Recent movements</h3>
      <ul className="divide-y divide-line rounded-lg border border-line">
        {moves.map((m) => (
          <li key={m.id} className="flex items-center gap-3 px-3 py-2 text-[13.5px]">
            <Badge tone={MOVE_TONE[m.type]} className="w-[88px] justify-center">{MOVE_LABEL[m.type]}</Badge>
            <span className="min-w-0 flex-1 truncate">
              {m.ref && <span className="code mr-1.5">{m.ref}</span>}
              <span className="text-ink-3">{m.note ?? (m.lotCode ? `Lot ${m.lotCode}` : "")}</span>
            </span>
            <span className={cx("w-12 text-right font-semibold", m.qty > 0 ? "text-good" : m.qty < 0 ? "text-ink" : "text-ink-3")}>{m.qty > 0 ? `+${m.qty}` : m.qty || "–"}</span>
            <span className="w-[110px] text-right text-[12.5px] text-ink-3">{dateTime(m.at)}</span>
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
      <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
        {(
          [
            ["all", "All lots"],
            ["short", "Best-by within 30 days"],
            ["hold", "On QA hold"],
          ] as const
        ).map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)} className={cx("h-8 cursor-pointer rounded-full border px-3 text-[13.5px] font-semibold", filter === k ? "border-ink bg-ink text-white" : "border-line bg-white text-ink-2")}>
            {l}
          </button>
        ))}
        <span className="ml-auto text-[13px] text-ink-3">Sorted first-expired, first-out. This is the order pickers pull in.</span>
      </div>
      <div className="overflow-x-auto scroll-thin">
        <table className="tbl min-w-[980px]">
          <thead>
            <tr>
              <th>Best-by</th>
              <th>Lot</th>
              <th>Product</th>
              <th>Bin</th>
              <th>Made</th>
              <th className="r">Qty</th>
              <th className="r">Reserved</th>
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
                    <span className="ml-1.5 text-[12.5px] font-normal text-ink-3">{d < 0 ? "expired" : `${d} d`}</span>
                  </td>
                  <td className="code font-medium">{l.code}</td>
                  <td>
                    <div className="font-semibold">{p?.name}</div>
                    <div className="code text-ink-3">{l.sku}</div>
                  </td>
                  <td>
                    <span className="code">{l.bin}</span>
                    <div className="text-[12px] text-ink-3">{ZONES[zoneOfBin(l.bin)].name}</div>
                  </td>
                  <td className="text-ink-2">
                    {day(l.madeAt)} <span className="text-[12.5px] text-ink-3">core {tempBare(l.coreTempC)}C</span>
                  </td>
                  <td className="r font-semibold whitespace-nowrap">
                    {l.qty} <span className="text-[12.5px] font-normal text-ink-3">{p?.unit}</span>
                  </td>
                  <td className="r text-ink-2">{reserved[l.id] || "–"}</td>
                  <td><LotBadge lot={l} now={now} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {list.length === 0 && <Empty title="Nothing here">No lots match this filter right now.</Empty>}
      </div>
    </Panel>
  );
}

function MovesTab() {
  const movements = useStore((s) => s.movements);
  const maps = useMaps();
  const [type, setType] = useState<MoveType | "">("");
  const [q, setQ] = useState("");
  const list = movements
    .filter((m) => (!type || m.type === type) && (!q || m.sku.toLowerCase().includes(q.toLowerCase()) || (m.ref ?? "").toLowerCase().includes(q.toLowerCase()) || (m.lotCode ?? "").includes(q)))
    .slice(0, 250);
  return (
    <Panel bodyClass="">
      <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
        <input className="input max-w-[280px]" placeholder="SKU, lot or order number" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input w-auto" value={type} onChange={(e) => setType(e.target.value as MoveType | "")}>
          <option value="">All movement types</option>
          {(Object.keys(MOVE_LABEL) as MoveType[]).map((t) => (
            <option key={t} value={t}>
              {MOVE_LABEL[t]}
            </option>
          ))}
        </select>
        <span className="ml-auto text-[13px] text-ink-3">Showing {list.length} of {count(movements.length)}</span>
      </div>
      <div className="max-h-[70vh] overflow-auto scroll-thin">
        <table className="tbl min-w-[960px]">
          <thead>
            <tr>
              <th>When</th>
              <th>Type</th>
              <th>Product</th>
              <th>Lot</th>
              <th className="r">Qty</th>
              <th>Reference</th>
              <th>By</th>
              <th>Note</th>
            </tr>
          </thead>
          <tbody>
            {list.map((m) => (
              <tr key={m.id}>
                <td className="whitespace-nowrap text-ink-2">{dateTime(m.at)}</td>
                <td>
                  <Badge tone={MOVE_TONE[m.type]}>{MOVE_LABEL[m.type]}</Badge>
                </td>
                <td>
                  <div className="max-w-[260px] truncate font-semibold">{maps.product.get(m.sku)?.name}</div>
                  <div className="code text-ink-3">{m.sku}</div>
                </td>
                <td className="code">{m.lotCode ?? "–"}</td>
                <td className={cx("r font-semibold", m.qty > 0 && "text-good")}>{m.qty > 0 ? `+${m.qty}` : m.qty || "–"}</td>
                <td className="code">{m.ref ?? "–"}</td>
                <td className="text-ink-2">{m.by}</td>
                <td className="max-w-[260px] truncate text-ink-3">{m.note ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
      <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
        {admin && (
          <button className="btn btn-primary" onClick={() => setEditing("new")}>
            <Plus size={16} /> Add product
          </button>
        )}
        <label className="flex h-9 cursor-pointer items-center gap-2 rounded-md border border-line bg-white px-3 text-[14px]">
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} className="accent-ink" />
          Show inactive ({inactive})
        </label>
        <span className="ml-auto text-[13px] text-ink-3">
          {admin ? "Inactive products keep their stock and history but can’t be ordered or produced." : "Only the owner can add or edit products and prices."}
        </span>
      </div>
      <div className="overflow-x-auto scroll-thin">
        <table className="tbl min-w-[900px]">
          <thead>
            <tr>
              <th>SKU</th>
              <th>Product</th>
              <th>Selling unit</th>
              <th className="r">List price</th>
              <th className="r">Reorder at</th>
              <th className="r">Par</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.sku} className={cx("clickable", !p.active && "text-ink-3")} onClick={() => onOpen(p.sku)}>
                <td className="code text-ink-2">{p.sku}</td>
                <td>
                  <div className="font-semibold">{p.name}</div>
                  <div className="text-[13px] text-ink-3">{p.category}</div>
                </td>
                <td>
                  <div className="font-semibold">{p.unit}</div>
                  <div className="text-[13px] text-ink-3">
                    {p.pack}, {p.caseKg} kg
                  </div>
                </td>
                <td className="r whitespace-nowrap">
                  <span className="font-semibold">{money(p.price.C)}</span>
                  <span className="text-[12.5px] text-ink-3">/{priceUnit(p)}</span>
                </td>
                <td className="r">{p.reorderPoint}</td>
                <td className="r">{p.par}</td>
                <td>{p.active ? <Badge tone="good">Active</Badge> : <Badge>Inactive</Badge>}</td>
                <td className="r">
                  {admin && (
                    <button
                      className="btn btn-quiet btn-sm px-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditing(p);
                      }}
                    >
                      <Pencil size={14} /> Edit
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
