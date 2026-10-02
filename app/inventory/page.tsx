"use client";

import { ArrowDownToLine, PackagePlus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Sparkline } from "@/components/charts";
import { AdjustModal, HoldModal, MoveModal, ReceiveModal, ReceivePOModal } from "@/components/InventoryModals";
import { Badge, Drawer, Empty, LevelBar, PageHead, Panel, Tabs, ZoneTag, cx } from "@/components/ui";
import { count, dateTime, day, daysUntil, money, money0, temp, tempBare } from "@/lib/format";
import { queryParam, useMaps, useNow, useStock } from "@/lib/hooks";
import { ZONES, ZONE_ORDER, caseCost, receiveLimitC, zoneOfBin, type StockRow } from "@/lib/logic";
import { useStore, useUi } from "@/lib/store";
import type { Category, Lot, MoveType, PurchaseOrder, ZoneId } from "@/lib/types";

type Tab = "stock" | "lots" | "moves" | "reorder" | "zones";

const MOVE_TONE: Record<MoveType, "good" | "neutral" | "warn" | "bad" | "accent"> = {
  RECEIVE: "good",
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
  RECEIVE: "Received",
  SHIP: "Shipped",
  PICKUP: "Will-call",
  ADJUST: "Count adj.",
  WASTE: "Written off",
  TRANSFER: "Moved",
  RETURN: "Returned",
  HOLD: "Held",
  RELEASE: "Released",
};

export default function Inventory() {
  const [tab, setTab] = useState<Tab>(() => (queryParam("tab") as Tab | null) ?? "stock");
  const [openSku, setOpenSku] = useState<string | null>(() => queryParam("sku"));
  const [receiving, setReceiving] = useState<string | false>(false);
  const { rows } = useStock();
  const lots = useStore((s) => s.lots);
  const pos = useStore((s) => s.pos);
  const now = useNow();

  const all = [...rows.values()];
  const totalCases = all.reduce((s, r) => s + r.onHand, 0);
  const value = all.reduce((s, r) => s + r.value, 0);
  const low = all.filter((r) => r.available < r.product.reorderPoint);
  const shortDated = lots.filter((l) => l.qty > 0 && daysUntil(l.bestBy, now) <= 30);
  const held = lots.filter((l) => l.qty > 0 && l.status === "HOLD");

  return (
    <div className="mx-auto max-w-[1500px]">
      <PageHead
        title="Inventory"
        sub={`${all.length} SKUs, ${count(totalCases)} cases on hand, ${money0(value)} at cost.`}
        actions={
          <button className="btn btn-primary" onClick={() => setReceiving("")}>
            <ArrowDownToLine size={16} /> Receive stock
          </button>
        }
      />

      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "stock", label: "Stock", count: all.length },
          { id: "lots", label: "Lots and dating", count: shortDated.length + held.length || undefined },
          { id: "moves", label: "Movements" },
          { id: "reorder", label: "Reorder", count: low.length || undefined },
          { id: "zones", label: "Freezer zones" },
        ]}
      />
      <div className="mt-4">
        {tab === "stock" && <StockTab rows={all} onOpen={setOpenSku} />}
        {tab === "lots" && <LotsTab onOpen={setOpenSku} />}
        {tab === "moves" && <MovesTab />}
        {tab === "reorder" && <ReorderTab rows={all} pos={pos} onOpen={setOpenSku} />}
        {tab === "zones" && <ZonesTab />}
      </div>

      {openSku && rows.get(openSku) && (
        <ProductDrawer row={rows.get(openSku)!} onClose={() => setOpenSku(null)} onReceive={() => setReceiving(openSku)} />
      )}
      {receiving !== false && <ReceiveModal open onClose={() => setReceiving(false)} sku={receiving || undefined} />}
    </div>
  );
}

function StockTab({ rows, onOpen }: { rows: StockRow[]; onOpen: (sku: string) => void }) {
  const [q, setQ] = useState("");
  const [zone, setZone] = useState<ZoneId | "">("");
  const [cat, setCat] = useState<Category | "">("");
  const [lowOnly, setLowOnly] = useState(false);
  const now = useNow();
  const cats = [...new Set(rows.map((r) => r.product.category))];
  const list = rows.filter(
    (r) =>
      (!q || r.product.name.toLowerCase().includes(q.toLowerCase()) || r.product.sku.toLowerCase().includes(q.toLowerCase())) &&
      (!zone || r.product.zone === zone) &&
      (!cat || r.product.category === cat) &&
      (!lowOnly || r.available < r.product.reorderPoint),
  );
  return (
    <Panel bodyClass="">
      <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
        <div className="relative min-w-[220px] flex-1">
          <Search size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-3" />
          <input className="input pl-8" placeholder="Search SKU or product" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="input w-auto" value={zone} onChange={(e) => setZone(e.target.value as ZoneId | "")} aria-label="Zone">
          <option value="">All zones</option>
          {ZONE_ORDER.map((z) => (
            <option key={z} value={z}>
              {ZONES[z].name}
            </option>
          ))}
        </select>
        <select className="input w-auto" value={cat} onChange={(e) => setCat(e.target.value as Category | "")} aria-label="Category">
          <option value="">All categories</option>
          {cats.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <label className="flex h-9 cursor-pointer items-center gap-2 rounded-md border border-line bg-white px-3 text-[14px]">
          <input type="checkbox" checked={lowOnly} onChange={(e) => setLowOnly(e.target.checked)} className="accent-ink" />
          Below reorder point
        </label>
      </div>
      <div className="overflow-x-auto scroll-thin">
        <table className="tbl min-w-[1080px]">
          <thead>
            <tr>
              <th>SKU</th>
              <th>Product</th>
              <th>Zone</th>
              <th className="r">On hand</th>
              <th className="r">Reserved</th>
              <th className="r">Held</th>
              <th className="r">Free to sell</th>
              <th>Level vs par</th>
              <th>Next best-by</th>
              <th className="r">Value</th>
            </tr>
          </thead>
          <tbody>
            {list.map((r) => {
              const d = r.nextBestBy ? daysUntil(r.nextBestBy, now) : null;
              return (
                <tr key={r.product.sku} className="clickable" onClick={() => onOpen(r.product.sku)}>
                  <td className="code text-ink-2">{r.product.sku}</td>
                  <td>
                    <div className="font-semibold">{r.product.name}</div>
                    <div className="text-[13px] text-ink-3">
                      {r.product.pack}, {r.lots.length} {r.lots.length === 1 ? "lot" : "lots"}
                    </div>
                  </td>
                  <td>
                    <ZoneTag zone={r.product.zone} temp={false} />
                  </td>
                  <td className="r font-semibold">{r.onHand}</td>
                  <td className="r text-ink-2">{r.reserved || "–"}</td>
                  <td className={cx("r", r.held ? "font-semibold text-bad" : "text-ink-3")}>{r.held || "–"}</td>
                  <td className={cx("r font-semibold", r.available < r.product.reorderPoint && "text-warn", r.available === 0 && "text-bad")}>{r.available}</td>
                  <td>
                    <LevelBar value={r.available} reorder={r.product.reorderPoint} par={r.product.par} />
                  </td>
                  <td className={cx(d !== null && d <= 30 ? "font-semibold text-warn" : "text-ink-2")}>
                    {r.nextBestBy ? `${day(r.nextBestBy)}` : "–"}
                    {d !== null && d <= 30 && <span className="ml-1 text-[12.5px]">({d} d)</span>}
                  </td>
                  <td className="r text-ink-2">{money0(r.value)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {list.length === 0 && <Empty title="No SKUs match these filters">Clear the search or turn off “Below reorder point”.</Empty>}
      </div>
      <div className="flex flex-wrap items-center gap-4 border-t border-line px-4 py-2 text-[12.5px] text-ink-3">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-px bg-warn" /> Reorder point
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-px bg-ink-3" /> Par level
        </span>
        <span>Reserved = on orders not yet loaded. Held = QA hold or past best-by.</span>
      </div>
    </Panel>
  );
}

function ProductDrawer({ row, onClose, onReceive }: { row: StockRow; onClose: () => void; onReceive: () => void }) {
  const p = row.product;
  const maps = useMaps();
  const movements = useStore((s) => s.movements);
  const { reserved } = useStock();
  const now = useNow();
  const [adjusting, setAdjusting] = useState<Lot | null>(null);
  const [moving, setMoving] = useState<Lot | null>(null);
  const [holding, setHolding] = useState<Lot | null>(null);
  const moves = movements.filter((m) => m.sku === p.sku).slice(0, 14);
  const unit = p.catchWeight ? "kg" : "cs";

  return (
    <Drawer
      open
      onClose={onClose}
      title={p.name}
      sub={
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="code">{p.sku}</span>
          <span>{p.pack}</span>
          <ZoneTag zone={p.zone} />
          <span>{maps.supplier.get(p.supplierId)?.name}</span>
        </span>
      }
      footer={
        <>
          <button className="btn btn-primary" onClick={onReceive}>
            <PackagePlus size={16} /> Receive this SKU
          </button>
          <span className="ml-auto text-[13px] text-ink-3">Home bin {p.bin}, shelf life {p.shelfDays} days</span>
        </>
      }
    >
      <div className="grid grid-cols-4 overflow-hidden rounded-lg border border-line">
        {[
          ["On hand", row.onHand],
          ["Reserved", row.reserved],
          ["Held", row.held],
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
        Reorder at {p.reorderPoint}, par {p.par}
      </div>

      <h3 className="display mt-6 mb-2 text-[19px] font-semibold">Lots, oldest best-by first</h3>
      <div className="overflow-x-auto rounded-lg border border-line scroll-thin">
        <table className="tbl min-w-[600px]">
          <thead>
            <tr>
              <th>Lot</th>
              <th>Bin</th>
              <th>Received</th>
              <th>Best-by</th>
              <th className="r">Cases</th>
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
                    {l.status === "HOLD" ? <Badge tone="bad">QA hold</Badge> : reserved[l.id] ? <span className="text-[12.5px] text-ink-3">{reserved[l.id]} reserved</span> : null}
                  </td>
                  <td>
                    <div className="code">{l.bin}</div>
                    <div className="text-[12px] text-ink-3">{ZONES[zoneOfBin(l.bin)].name}</div>
                  </td>
                  <td>
                    <div>{day(l.receivedAt)}</div>
                    <div className={cx("text-[12.5px]", l.receiveTempC > receiveLimitC(p.zone) ? "font-semibold text-bad" : "text-ink-3")}>at {temp(l.receiveTempC)}</div>
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
        {row.lots.length === 0 && <Empty title="No stock on hand">Receive a delivery to create the first lot.</Empty>}
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
            <th className="r">Case price</th>
            <th className="r">Margin</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="text-ink-3">Landed cost</td>
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
      {p.catchWeight && <p className="mt-1.5 text-[12.5px] text-ink-3">Catch weight: invoiced at actual weight from the pick scale. Case price assumes {p.caseKg} kg.</p>}

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
              <th>Received</th>
              <th className="r">Cases</th>
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
                    {day(l.receivedAt)} <span className="text-[12.5px] text-ink-3">at {tempBare(l.receiveTempC)}C</span>
                  </td>
                  <td className="r font-semibold">{l.qty}</td>
                  <td className="r text-ink-2">{reserved[l.id] || "–"}</td>
                  <td>{l.status === "HOLD" ? <Badge tone="bad">QA hold</Badge> : zoneOfBin(l.bin) === "BLAST" ? <Badge tone="accent">Blast freezing</Badge> : <Badge>Sellable</Badge>}</td>
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
              <th className="r">Cases</th>
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

function ReorderTab({ rows, pos, onOpen }: { rows: StockRow[]; pos: PurchaseOrder[]; onOpen: (sku: string) => void }) {
  const createPO = useStore((s) => s.createPO);
  const toast = useUi((s) => s.toast);
  const maps = useMaps();
  const [receivingPo, setReceivingPo] = useState<PurchaseOrder | null>(null);
  const incoming = useMemo(() => {
    const m = new Map<string, number>();
    for (const po of pos) if (po.status === "SENT") for (const l of po.lines) m.set(l.sku, (m.get(l.sku) ?? 0) + l.qty);
    return m;
  }, [pos]);
  const suggestions = rows
    .map((r) => ({ r, inc: incoming.get(r.product.sku) ?? 0 }))
    .filter(({ r, inc }) => r.available + inc < r.product.reorderPoint)
    .map(({ r, inc }) => ({ r, inc, suggest: Math.max(1, r.product.par - r.available - inc) }));
  const bySupplier = new Map<string, typeof suggestions>();
  for (const s of suggestions) {
    const k = s.r.product.supplierId;
    bySupplier.set(k, [...(bySupplier.get(k) ?? []), s]);
  }
  const open = pos.filter((p) => p.status === "SENT");
  const recent = pos.filter((p) => p.status === "RECEIVED").slice(0, 5);

  return (
    <div className="grid items-start gap-5 xl:grid-cols-[1.3fr_1fr]">
      <Panel title="Suggested buys" actions={<span className="text-[13px] text-ink-3">Par minus free stock minus what&rsquo;s already on order</span>} bodyClass="divide-y divide-line">
        {bySupplier.size === 0 && <Empty title="Nothing to reorder">Every SKU is above its reorder point once open POs land.</Empty>}
        {[...bySupplier.entries()].map(([sid, items]) => {
          const sup = maps.supplier.get(sid)!;
          const total = items.reduce((s, i) => s + i.suggest * caseCost(i.r.product), 0);
          return (
            <div key={sid} className="p-4">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-semibold">{sup.name}</div>
                  <div className="text-[13px] text-ink-3">
                    {sup.leadDays}-day lead time, {sup.phone}
                  </div>
                </div>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    const po = createPO(sid, items.map((i) => ({ sku: i.r.product.sku, qty: i.suggest })));
                    toast(`${po.number} sent to ${sup.name}`);
                  }}
                >
                  Send PO, {money0(total)}
                </button>
              </div>
              <table className="tbl">
                <tbody>
                  {items.map(({ r, inc, suggest }) => (
                    <tr key={r.product.sku} className="clickable" onClick={() => onOpen(r.product.sku)}>
                      <td className="w-[90px]">
                        <span className="code">{r.product.sku}</span>
                      </td>
                      <td>{r.product.name}</td>
                      <td className="r text-[13px] text-ink-3">
                        {r.available} free{inc ? `, ${inc} inbound` : ""}
                      </td>
                      <td className="r w-[90px] font-semibold">+{suggest} cs</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
      </Panel>

      <Panel title="Purchase orders" bodyClass="divide-y divide-line">
        {open.length === 0 && <p className="p-4 text-[14px] text-ink-3">No open POs.</p>}
        {open.map((po) => (
          <div key={po.id} className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <span className="code font-medium">{po.number}</span>
                  <Badge tone="accent">Due {day(po.eta)}</Badge>
                </div>
                <div className="mt-0.5 text-[14px] font-semibold">{maps.supplier.get(po.supplierId)?.name}</div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setReceivingPo(po)}>
                <ArrowDownToLine size={14} /> Receive
              </button>
            </div>
            <ul className="mt-2 text-[13.5px] text-ink-2">
              {po.lines.map((l) => (
                <li key={l.sku} className="flex justify-between">
                  <span className="truncate">{maps.product.get(l.sku)?.name}</span>
                  <span className="ml-2 shrink-0">{l.qty} cs</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
        {recent.length > 0 && (
          <div className="p-4">
            <div className="mb-1 text-[13px] font-semibold text-ink-3">Recently received</div>
            {recent.map((po) => (
              <div key={po.id} className="flex justify-between text-[13.5px]">
                <span>
                  <span className="code">{po.number}</span> {maps.supplier.get(po.supplierId)?.name}
                </span>
                <span className="text-ink-3">{po.receivedAt ? day(po.receivedAt) : ""}</span>
              </div>
            ))}
          </div>
        )}
      </Panel>
      {receivingPo && <ReceivePOModal key={receivingPo.id} po={receivingPo} onClose={() => setReceivingPo(null)} />}
    </div>
  );
}

function ZonesTab() {
  const zones = useStore((s) => s.zones);
  const lots = useStore((s) => s.lots);
  const maps = useMaps();
  return (
    <div className="grid gap-5 md:grid-cols-2">
      {zones.map((z) => {
        const cur = z.readings.at(-1) ?? z.setPointC;
        const inZone = lots.filter((l) => l.qty > 0 && zoneOfBin(l.bin) === z.id);
        const cases = inZone.reduce((s, l) => s + l.qty, 0);
        const bySku = new Map<string, number>();
        for (const l of inZone) bySku.set(l.sku, (bySku.get(l.sku) ?? 0) + l.qty);
        const top = [...bySku.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
        const hi = Math.max(...z.readings);
        const lo = Math.min(...z.readings);
        return (
          <Panel key={z.id} edge={ZONES[z.id].color} title={z.name} actions={<span className="text-[13px] text-ink-3">Set {tempBare(z.setPointC, 0)}C, alarm above {tempBare(z.maxC, 0)}C</span>}>
            <div className="flex flex-wrap items-end gap-6">
              <div>
                <div className="text-[13px] text-ink-3">Now</div>
                <div className={cx("display text-[56px] leading-none font-semibold", cur > z.maxC && "text-bad")}>
                  {tempBare(cur)}
                  <span className="text-[22px] text-ink-3">C</span>
                </div>
              </div>
              <div className="flex-1">
                <div className="mb-1 text-[13px] text-ink-3">
                  Last {z.readings.length} readings, low {tempBare(lo)}, high {tempBare(hi)}
                </div>
                <Sparkline values={z.readings} setPoint={z.setPointC} alarm={z.maxC} width={300} height={56} />
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3 border-t border-line pt-3 text-[13.5px]">
              <div>
                <div className="text-ink-3">Pallet positions</div>
                <div className="font-semibold">
                  {z.used} of {z.capacity} ({Math.round((z.used / z.capacity) * 100)}%)
                </div>
              </div>
              <div>
                <div className="text-ink-3">Cases stored</div>
                <div className="font-semibold">{count(cases)}</div>
              </div>
              <div>
                <div className="text-ink-3">Lots</div>
                <div className="font-semibold">{inZone.length}</div>
              </div>
            </div>
            {top.length > 0 && (
              <ul className="mt-3 text-[13.5px]">
                {top.map(([sku, n]) => (
                  <li key={sku} className="flex justify-between border-t border-line/60 py-1">
                    <span className="truncate">{maps.product.get(sku)?.name}</span>
                    <span className="ml-2 shrink-0 text-ink-2">{n} cs</span>
                  </li>
                ))}
              </ul>
            )}
            {z.id === "BLAST" && <p className="mt-2 text-[12.5px] text-ink-3">Product sits here 24 to 48 hours to reach core temperature before put-away.</p>}
          </Panel>
        );
      })}
      <p className="text-[12.5px] text-ink-3 md:col-span-2">Readings arrive every 30 seconds from the zone probes. Pallet counts come from the last slotting scan.</p>
    </div>
  );
}
