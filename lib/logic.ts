import type {
  Alloc,
  Client,
  Delivery,
  DeliveryStatus,
  Lot,
  Order,
  PayMethod,
  Product,
  Run,
  Terms,
  Tier,
  ZoneId,
} from "./types";

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

/** Highest product temperature we accept at the dock, by storage zone. */
export const receiveLimitC = (zone: ZoneId) => (zone === "COOL" ? 5 : FROZEN_LIMIT_C);

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
    let res = 0;
    let nextBestBy: number | undefined;
    for (const l of ls) {
      onHand += l.qty;
      res += reserved[l.id] ?? 0;
      if (l.status === "HOLD" || l.bestBy <= now) held += l.qty;
      else if (nextBestBy === undefined) nextBestBy = l.bestBy;
    }
    rows.set(p.sku, {
      product: p,
      onHand,
      reserved: res,
      held,
      available: Math.max(0, onHand - held - res),
      lots: ls,
      nextBestBy,
      value: onHand * caseCost(p),
    });
  }
  return rows;
}

/** First-expired, first-out. Returns null when there is not enough sellable stock. */
export function allocateFEFO(
  lots: Lot[],
  sku: string,
  qty: number,
  reserved: Record<string, number>,
  now = Date.now(),
): Alloc[] | null {
  const candidates = lots
    .filter((l) => l.sku === sku && l.status === "AVAILABLE" && l.bestBy > now && l.qty > 0)
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
      return { to: "LOADED", label: "Mark loaded" };
    case "EN_ROUTE":
      return { to: "ARRIVED", label: "Mark arrived" };
    default:
      return null;
  }
}
