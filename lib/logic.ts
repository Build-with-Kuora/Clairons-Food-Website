import type {
  Alloc,
  Batch,
  Client,
  Delivery,
  DeliveryStatus,
  Lot,
  Order,
  PayMethod,
  Product,
  Rider,
  Route,
  Run,
  Terms,
  Tier,
  ZoneId,
} from "./types";
import { HOUR } from "./format";

export const ZONES: Record<ZoneId, { name: string; setPointC: number; maxC: number; color: string; prefix: string }> = {
  BLAST: { name: "Blast freezer", setPointC: -35, maxC: -28, color: "var(--color-z-blast)", prefix: "B" },
  DEEP: { name: "Deep freeze", setPointC: -25, maxC: -20, color: "var(--color-z-deep)", prefix: "D" },
  FRZ: { name: "Freezer", setPointC: -18, maxC: -15, color: "var(--color-z-frz)", prefix: "F" },
  COOL: { name: "Chiller", setPointC: 3, maxC: 5, color: "var(--color-z-cool)", prefix: "C" },
};

export const ZONE_ORDER: ZoneId[] = ["BLAST", "DEEP", "FRZ", "COOL"];

export function zoneOfBin(bin: string): ZoneId {
  const p = bin.charAt(0).toUpperCase();
  return (ZONE_ORDER.find((z) => ZONES[z].prefix === p) ?? "FRZ") as ZoneId;
}

/** Warmest core temperature a batch may have when put away, by storage zone. Warmer goes on QA hold. */
export const coreLimitC = (zone: ZoneId) => (zone === "COOL" ? 5 : FROZEN_LIMIT_C);

/** Hours a fresh batch spends in the blast freezer before it can be put away and sold. */
export const BLAST_HOURS = 24;

export const isFreezing = (l: Lot) => zoneOfBin(l.bin) === "BLAST";
export const readyAt = (l: Lot) => l.madeAt + BLAST_HOURS * HOUR;

/** Frozen product targets −18°C; it may drift briefly but never above −15°C. */
export const FROZEN_LIMIT_C = -15;

/** Ref vans run frozen loads; anything warmer than this in the box is an excursion. */
export const TRUCK_LIMIT_C = FROZEN_LIMIT_C;

export const caseCost = (p: Product) => (p.catchWeight ? p.cost * p.caseKg : p.cost);
export const casePrice = (p: Product, tier: Tier) => (p.catchWeight ? p.price[tier] * p.caseKg : p.price[tier]);

/** Stock tied to orders that have not left the building yet. */
const RESERVING: DeliveryStatus[] = ["SCHEDULED", "PICKING"];

export function reservedByLot(orders: Order[], deliveries: Delivery[]) {
  const byId = new Map(deliveries.map((d) => [d.id, d]));
  const out: Record<string, number> = {};
  for (const o of orders) {
    if (o.status !== "OPEN" || !o.deliveryId) continue;
    const d = byId.get(o.deliveryId);
    if (!d || !RESERVING.includes(d.status)) continue;
    for (const l of o.lines) for (const a of l.allocs) out[a.lotId] = (out[a.lotId] ?? 0) + a.qty;
  }
  return out;
}

export interface StockRow {
  product: Product;
  onHand: number;
  reserved: number;
  held: number;
  /** Still in the blast freezer, not sellable yet */
  freezing: number;
  available: number;
  lots: Lot[];
  nextBestBy?: number;
  value: number;
}

export function stockRows(products: Product[], lots: Lot[], reserved: Record<string, number>, now = Date.now()) {
  const bySku = new Map<string, Lot[]>();
  for (const l of lots) {
    if (l.qty <= 0) continue;
    const list = bySku.get(l.sku) ?? [];
    list.push(l);
    bySku.set(l.sku, list);
  }
  const rows = new Map<string, StockRow>();
  for (const p of products) {
    const ls = (bySku.get(p.sku) ?? []).sort((a, b) => a.bestBy - b.bestBy);
    let onHand = 0;
    let held = 0;
    let freezing = 0;
    let res = 0;
    let nextBestBy: number | undefined;
    for (const l of ls) {
      onHand += l.qty;
      res += reserved[l.id] ?? 0;
      if (l.status === "HOLD" || l.bestBy <= now) held += l.qty;
      else if (isFreezing(l)) freezing += l.qty;
      else if (nextBestBy === undefined) nextBestBy = l.bestBy;
    }
    rows.set(p.sku, {
      product: p,
      onHand,
      reserved: res,
      held,
      freezing,
      available: Math.max(0, onHand - held - freezing - res),
      lots: ls,
      nextBestBy,
      value: onHand * caseCost(p),
    });
  }
  return rows;
}

/** First-expired, first-out, from lots that are released, in date and out of the blast freezer. Returns null when there is not enough sellable stock. */
export function allocateFEFO(
  lots: Lot[],
  sku: string,
  qty: number,
  reserved: Record<string, number>,
  now = Date.now(),
): Alloc[] | null {
  const candidates = lots
    .filter((l) => l.sku === sku && l.status === "AVAILABLE" && l.bestBy > now && l.qty > 0 && !isFreezing(l))
    .sort((a, b) => a.bestBy - b.bestBy);
  const out: Alloc[] = [];
  let left = qty;
  for (const l of candidates) {
    if (left <= 0) break;
    const free = l.qty - (reserved[l.id] ?? 0);
    if (free <= 0) continue;
    const take = Math.min(free, left);
    out.push({ lotId: l.id, lotCode: l.code, qty: take });
    left -= take;
  }
  return left > 0 ? null : out;
}

/** Paid when the order is placed, so it counts as a sale right away. */
const PAID_UPFRONT: PayMethod[] = ["CASH", "CARD", "CHECK", "GCASH"];

export interface Sale {
  orderId: string;
  clientId: string;
  at: number;
  lines: { sku: string; qty: number; amount: number }[];
  fees: number;
  total: number;
}

/**
 * Orders that count as sales (decision 0.6). Walk-ins and orders paid upfront count when placed;
 * deliveries on account or COD count when delivered. Cases refused at the door are not sold.
 */
export function salesOf(orders: Order[], deliveries: Delivery[]): Sale[] {
  const byId = new Map(deliveries.map((d) => [d.id, d]));
  const out: Sale[] = [];
  for (const o of orders) {
    if (o.status === "CANCELLED") continue;
    const d = o.deliveryId ? byId.get(o.deliveryId) : undefined;
    const at = o.fulfillment === "PICKUP" || PAID_UPFRONT.includes(o.payMethod) ? o.createdAt : d?.pod?.at;
    if (at === undefined) continue;
    const refused = new Map<string, number>();
    for (const sh of d?.pod?.shorts ?? []) refused.set(sh.sku, (refused.get(sh.sku) ?? 0) + sh.qty);
    const lines = o.lines
      .map((l) => {
        const qty = Math.max(0, l.qty - (refused.get(l.sku) ?? 0));
        return { sku: l.sku, qty, amount: round2((l.lineTotal * qty) / l.qty) };
      })
      .filter((l) => l.qty > 0);
    const fees = o.dropFee + o.fuel;
    out.push({ orderId: o.id, clientId: o.clientId, at, lines, fees, total: round2(lines.reduce((t, l) => t + l.amount, 0) + fees) });
  }
  return out;
}

/** Cases sold per SKU since `since`. */
export function soldBySku(sales: Sale[], since: number) {
  const out = new Map<string, number>();
  for (const s of sales) {
    if (s.at < since) continue;
    for (const l of s.lines) out.set(l.sku, (out.get(l.sku) ?? 0) + l.qty);
  }
  return out;
}

export const VAT_RATE = 0.12;

/** Prices are VAT-inclusive: split a gross amount into VATable sales and the VAT inside it. */
export function vatSplit(gross: number) {
  const net = round2(gross / (1 + VAT_RATE));
  return { net, vat: round2(gross - net) };
}

export interface ProductSales {
  sku: string;
  qty: number;
  amount: number;
  /** Sales this product appeared in */
  orders: number;
}

/** Sales that counted between `from` (inclusive) and `to` (exclusive), per product, plus the delivery fees charged. */
export function salesSummary(sales: Sale[], from: number, to: number) {
  const bySku = new Map<string, ProductSales>();
  let fees = 0;
  let count = 0;
  for (const s of sales) {
    if (s.at < from || s.at >= to) continue;
    count++;
    fees += s.fees;
    for (const l of s.lines) {
      const r = bySku.get(l.sku) ?? { sku: l.sku, qty: 0, amount: 0, orders: 0 };
      r.qty += l.qty;
      r.amount = round2(r.amount + l.amount);
      r.orders++;
      bySku.set(l.sku, r);
    }
  }
  const rows = [...bySku.values()].sort((a, b) => b.amount - a.amount || a.sku.localeCompare(b.sku));
  const products = round2(rows.reduce((t, r) => t + r.amount, 0));
  return { rows, count, cases: rows.reduce((t, r) => t + r.qty, 0), products, fees: round2(fees), total: round2(products + fees) };
}

/** Cases produced per SKU in batches made since `since`. */
export function producedBySku(batches: Batch[], since: number) {
  const out = new Map<string, number>();
  for (const b of batches) if (b.madeAt >= since) out.set(b.sku, (out.get(b.sku) ?? 0) + b.qty);
  return out;
}

/** What to make next: products whose free stock is under the reorder point, topped back up to par. */
export function toMake(rows: Iterable<StockRow>) {
  return [...rows]
    .filter((r) => r.available < r.product.reorderPoint)
    .map((r) => ({ row: r, qty: r.product.par - r.available }))
    .sort((a, b) => a.row.available / a.row.product.reorderPoint - b.row.available / b.row.product.reorderPoint);
}

/** Fresh product goes into the blast freezer first: the first blast bin not already holding stock. */
export function freeBlastBin(lots: Lot[]) {
  const used = new Set(lots.filter((l) => l.qty > 0 && zoneOfBin(l.bin) === "BLAST").map((l) => l.bin));
  for (let i = 1; i <= 99; i++) {
    const bin = `B-01-${String(i).padStart(2, "0")}`;
    if (!used.has(bin)) return bin;
  }
  return "B-01-99";
}

export const DROP_MIN = 5000;
export const DROP_FEE = 300;
export const FUEL_FEE = 150;

export function priceLines(products: Product[], client: Client, lines: { sku: string; qty: number }[]) {
  const bySku = new Map(products.map((p) => [p.sku, p]));
  return lines.flatMap((l) => {
    const p = bySku.get(l.sku);
    if (!p) return [];
    const unitPrice = p.price[client.tier];
    const estKg = p.catchWeight ? p.caseKg * l.qty : undefined;
    return [
      {
        sku: p.sku,
        name: p.name,
        qty: l.qty,
        unitPrice,
        catchWeight: p.catchWeight,
        estKg,
        lineTotal: round2(p.catchWeight ? unitPrice * (estKg ?? 0) : unitPrice * l.qty),
      },
    ];
  });
}

export function orderTotals(subtotal: number, fulfillment: "DELIVERY" | "PICKUP") {
  const dropFee = fulfillment === "DELIVERY" && subtotal > 0 && subtotal < DROP_MIN ? DROP_FEE : 0;
  const fuel = fulfillment === "DELIVERY" && subtotal > 0 ? FUEL_FEE : 0;
  return { dropFee, fuel, total: round2(subtotal + dropFee + fuel) };
}

export const round2 = (n: number) => Math.round(n * 100) / 100;

export const STATUS_FLOW: DeliveryStatus[] = ["SCHEDULED", "PICKING", "LOADED", "EN_ROUTE", "ARRIVED", "DELIVERED"];

export const STATUS_LABEL: Record<DeliveryStatus, string> = {
  SCHEDULED: "Scheduled",
  PICKING: "Picking",
  LOADED: "Loaded",
  EN_ROUTE: "En route",
  ARRIVED: "Arrived",
  DELIVERED: "Delivered",
  EXCEPTION: "Exception",
};

export const TERMS_LABEL: Record<Terms, string> = { COD: "COD", NET15: "Net 15", NET30: "Net 30" };

export const PAY_LABEL: Record<PayMethod, string> = {
  ACCOUNT: "On account",
  CARD: "Card",
  CASH: "Cash",
  CHECK: "Check",
  GCASH: "GCash",
  COD: "Collect on delivery",
};

export const runKey = (routeId: string, date: string) => `${routeId}|${date}`;

/** Reefer readings that cover this delivery: from load until hand-off (or now). */
export function deliveryTrace(d: Delivery, run: Run | undefined, now = Date.now()) {
  if (!run) return [];
  const loaded = d.events.find((e) => e.status === "LOADED")?.at ?? run.departedAt;
  if (!loaded) return [];
  const end = d.pod?.at ?? d.exception?.at ?? now;
  return run.temps.filter((t) => t.at >= loaded - 1 && t.at <= end + 1);
}

export function statusAt(d: Delivery, s: DeliveryStatus) {
  return d.events.find((e) => e.status === s)?.at;
}

export function nextAction(d: Delivery): { to: DeliveryStatus; label: string } | null {
  switch (d.status) {
    case "SCHEDULED":
      return { to: "PICKING", label: "Start picking" };
    case "PICKING":
      return { to: "LOADED", label: d.riderId ? "Mark packed" : "Mark loaded" };
    case "LOADED":
      // Vans leave together when the truck is dispatched; a rider takes each stop on its own.
      return d.riderId ? { to: "EN_ROUTE", label: "Hand to rider" } : null;
    case "EN_ROUTE":
      return { to: "ARRIVED", label: "Mark arrived" };
    default:
      return null;
  }
}

/** A stop can change hands until it leaves the building. */
export const ASSIGNABLE: DeliveryStatus[] = ["SCHEDULED", "PICKING", "LOADED"];

/** The three steps riders and the phone table use, plus "problem". */
export type SimpleStatus = "Pending" | "Out for delivery" | "Delivered" | "Problem";

export function simpleStatus(s: DeliveryStatus): SimpleStatus {
  if (s === "DELIVERED") return "Delivered";
  if (s === "EXCEPTION") return "Problem";
  if (s === "EN_ROUTE" || s === "ARRIVED") return "Out for delivery";
  return "Pending";
}

/** Who carries a stop: the rider when one is assigned, otherwise the van on the client's route. */
export function carrierOf(d: Delivery, routes: Map<string, Route>, riders: Map<string, Rider>) {
  const rider = d.riderId ? riders.get(d.riderId) : undefined;
  if (rider) return { kind: "RIDER" as const, person: rider.name, vehicle: rider.bike, label: `${rider.name}, motorbike` };
  const r = routes.get(d.routeId);
  return { kind: "VAN" as const, person: r?.driver ?? "", vehicle: r?.truck ?? "", label: `${r?.driver}, ${r?.truck}` };
}
