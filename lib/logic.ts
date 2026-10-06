import type {
  Alloc,
  Batch,
  Client,
  CustomerInput,
  Delivery,
  DeliveryStatus,
  Lot,
  Category,
  Order,
  PayMethod,
  Product,
  ProductInput,
  ReceiptChannel,
  Seller,
  Rider,
  Route,
  Run,
  Terms,
  Tier,
  ZoneId,
} from "./types";
import { DAY, HOUR, dateKey, dateTime, invoiceNumber, keyToTs, money, startOfDay } from "./format";

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

/** Prices are per kg for catch-weight items, otherwise per selling unit. */
export const priceUnit = (p: Product) => (p.catchWeight ? "kg" : p.unit);

/** The unit a set of products share, or "unit" when they differ. For totals across products. */
export function commonUnit(products: Iterable<Product | undefined>) {
  const set = new Set<string>();
  for (const p of products) if (p) set.add(p.unit);
  return set.size === 1 ? [...set][0] : "unit";
}

export const SKU_PREFIX: Record<Category, string> = {
  Dimsum: "DM",
  Streetfood: "ST",
  "Tocino & longganisa": "BR",
  Pork: "PK",
  Poultry: "PL",
  Seafood: "SE",
  Desserts: "DE",
  Bakery: "BK",
  Fries: "FR",
  Chiller: "CH",
};

export const CATEGORIES = Object.keys(SKU_PREFIX) as Category[];

/** Zones a product can call home. The blast freezer is only a stop on the way in. */
export const HOME_ZONES: ZoneId[] = ["DEEP", "FRZ", "COOL"];

/** Next free SKU in a category: one past the highest number already used with its prefix. */
export function nextSku(products: Product[], category: Category) {
  const prefix = SKU_PREFIX[category];
  const nums = products.filter((p) => p.sku.startsWith(`${prefix}-`)).map((p) => Number(p.sku.slice(prefix.length + 1)) || 0);
  const base = { DM: 1000, ST: 2000, BR: 3000, PK: 4000, PL: 5000, SE: 6000, DE: 7000, BK: 8000, FR: 8500, CH: 9000 }[prefix] ?? 0;
  return `${prefix}-${Math.max(base, ...nums) + 1}`;
}

const isWhole = (n: number) => Number.isInteger(n) && n >= 0;

/** What is wrong with a product before it is saved, or null when it is fine. */
export function productError(i: ProductInput, products: Product[]): string | null {
  const name = i.name.trim();
  if (!name) return "Enter the product name.";
  const twin = products.find((p) => p.sku !== i.sku && p.name.toLowerCase() === name.toLowerCase());
  if (twin) return `${twin.sku} already uses that name.`;
  if (!i.unit.trim()) return "Enter the selling unit, e.g. case, pack or tray.";
  if (!/^[a-z][a-z -]*$/i.test(i.unit.trim()) || i.unit.trim().length > 16) return "Write the unit as a short word, e.g. case, pack or tray.";
  if (!i.pack.trim()) return `Say what is inside one ${i.unit.trim()}, e.g. 10 × 50 pcs.`;
  if (!(i.caseKg > 0)) return `Enter the weight of one ${i.unit.trim()} in kg.`;
  for (const t of ["A", "B", "C"] as const) if (!(i.price[t] > 0)) return `Enter a tier ${t} price.`;
  if (!(i.cost >= 0)) return "Production cost can't be negative.";
  if (!isWhole(i.reorderPoint)) return "Reorder point must be a whole number.";
  if (!isWhole(i.par) || i.par <= i.reorderPoint) return "Par level must be a whole number above the reorder point.";
  if (!isWhole(i.shelfDays) || i.shelfDays < 1) return "Shelf life must be at least 1 day.";
  if (!HOME_ZONES.includes(i.zone)) return "Pick where the product is stored.";
  if (!i.bin.trim() || i.bin.trim().charAt(0).toUpperCase() !== ZONES[i.zone].prefix) return `Home bin must be in ${ZONES[i.zone].name.toLowerCase()}, starting with ${ZONES[i.zone].prefix}-.`;
  return null;
}

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

/** Units sold per SKU since `since`. */
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

/**
 * Anonymous counter sales go to this one built-in account, so they price, invoice and count like
 * any other sale. List price, cash at the counter, no credit and no route. Hidden from Customers.
 */
export const WALK_IN_ID = "walk-in";
export const WALK_IN: Client = {
  id: WALK_IN_ID,
  name: "Walk-in customer",
  type: "Walk-in",
  tier: "C",
  terms: "COD",
  creditLimit: 0,
  balance: 0,
  pastDue: 0,
  address: "",
  city: "",
  contact: "",
  phone: "",
  routeId: "",
  window: "",
  dockNote: "",
};
export const isWalkIn = (c: Pick<Client, "id"> | undefined) => c?.id === WALK_IN_ID;

/** Who bought: the name a walk-in gave, else the account name. */
export const buyerName = (o: Pick<Order, "buyerName">, c: Pick<Client, "name"> | undefined) => o.buyerName || c?.name || "";

/** Fulfillment as staff say it: counter sales are walk-ins, the rest go out on a truck or bike. */
export const FULFILLMENT_LABEL: Record<Order["fulfillment"], string> = { PICKUP: "Walk-in", DELIVERY: "Delivery" };

/** Whole-number percent change from `prev` to `now`, or null when there is nothing to compare against. */
export function pctChange(now: number, prev: number): number | null {
  if (prev === 0) return null;
  return Math.round(((now - prev) / Math.abs(prev)) * 100);
}

/** The period of the same length that ends where [from, to) starts. */
export const previousRange = (from: number, to: number) => ({ from: from - (to - from), to: from });

/** Amount sold per product category between `from` and `to`, largest first. Fees are left out. */
export function salesByCategory(sales: Sale[], products: Map<string, Product>, from: number, to: number) {
  const out = new Map<Category, number>();
  for (const s of sales) {
    if (s.at < from || s.at >= to) continue;
    for (const l of s.lines) {
      const c = products.get(l.sku)?.category;
      if (c) out.set(c, round2((out.get(c) ?? 0) + l.amount));
    }
  }
  return [...out.entries()].map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount);
}

/**
 * Sales per day (or per week for long ranges) split into walk-in and delivery, oldest first.
 * Buckets with no sales are kept so the chart shows the gaps.
 */
export function salesByDay(sales: Sale[], orders: Map<string, Order>, from: number, to: number) {
  const days = Math.max(1, Math.round((to - from) / DAY));
  const step = days > 31 ? 7 : 1;
  const out: { start: number; walkIn: number; delivery: number }[] = [];
  for (let t = startOfDay(from + 2 * HOUR); t < to; t = startOfDay(t + step * DAY + 2 * HOUR)) out.push({ start: t, walkIn: 0, delivery: 0 });
  for (const s of sales) {
    if (s.at < from || s.at >= to) continue;
    let i = out.length - 1;
    while (i > 0 && out[i].start > s.at) i--;
    const pickup = orders.get(s.orderId)?.fulfillment === "PICKUP";
    if (pickup) out[i].walkIn = round2(out[i].walkIn + s.total);
    else out[i].delivery = round2(out[i].delivery + s.total);
  }
  return { step, buckets: out };
}

/** Amount sold per buying account between `from` and `to`, largest first. */
export function salesByClient(sales: Sale[], from: number, to: number) {
  const out = new Map<string, { clientId: string; amount: number; count: number }>();
  for (const s of sales) {
    if (s.at < from || s.at >= to) continue;
    const r = out.get(s.clientId) ?? { clientId: s.clientId, amount: 0, count: 0 };
    r.amount = round2(r.amount + s.total);
    r.count++;
    out.set(s.clientId, r);
  }
  return [...out.values()].sort((a, b) => b.amount - a.amount);
}

/**
 * The sales-by-product table as CSV for a spreadsheet or the accountant: one row per product,
 * then products, delivery fees and total rows. Amounts are plain numbers in pesos, VAT-inclusive.
 */
export function salesCsv(sum: ReturnType<typeof salesSummary>, products: Map<string, Product>, period: string) {
  const cell = (v: string | number) => (typeof v === "number" ? v.toFixed(2).replace(/\.00$/, "") : /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const row = (...v: (string | number)[]) => v.map(cell).join(",");
  const money = (gross: number) => {
    const v = vatSplit(gross);
    return [v.net.toFixed(2), v.vat.toFixed(2), gross.toFixed(2)];
  };
  const lines = [
    row("Clairon's Food, sales by product", period),
    row("SKU", "Product", "Unit", "Sold", "Sales", "VATable sales", "VAT 12%", "Amount"),
    ...sum.rows.map((r) => {
      const p = products.get(r.sku);
      return row(r.sku, p?.name ?? r.sku, p?.unit ?? "", r.qty, r.orders, ...money(r.amount));
    }),
    row("", "Products", "", sum.cases, "", ...money(sum.products)),
    row("", "Delivery fees (small drop, fuel)", "", "", "", ...money(sum.fees)),
    row("", "Total", "", sum.cases, sum.count, ...money(sum.total)),
  ];
  return lines.join("\r\n") + "\r\n";
}

/** Units produced per SKU in batches made since `since`. */
export function producedBySku(batches: Batch[], since: number) {
  const out = new Map<string, number>();
  for (const b of batches) if (b.madeAt >= since) out.set(b.sku, (out.get(b.sku) ?? 0) + b.qty);
  return out;
}

/** What to make next: active products whose free stock is under the reorder point, topped back up to par. */
export function toMake(rows: Iterable<StockRow>) {
  return [...rows]
    .filter((r) => r.product.active && r.available < r.product.reorderPoint)
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

/** Cities the online store delivers to, and the van route that covers each. Dispatch can still hand a stop to a rider. */
export const SERVICE_AREAS: Record<string, string> = {
  Manila: "MNL",
  Caloocan: "MNL",
  "Quezon City": "QC",
  "San Juan": "QC",
  Marikina: "QC",
  Mandaluyong: "STH",
  Makati: "STH",
  Pasig: "STH",
  Taguig: "STH",
  Pasay: "STH",
  "Parañaque": "STH",
  "Las Piñas": "STH",
};

/** Online shoppers buy at list price (tier C), the same as walk-in COD accounts. */
export const ONLINE_TIER = "C" as const;

/** What is wrong with a customer's delivery details, or null when they are fine. */
export function customerError(i: CustomerInput): string | null {
  if (!i.name.trim()) return "Enter the name to deliver to.";
  if (i.phone.replace(/\D/g, "").length < 10) return "Enter a mobile number the rider can call, like 0917 555 1234.";
  if (!i.address.trim()) return "Enter the street address, barangay and landmark.";
  if (!SERVICE_AREAS[i.city]) return "Pick a city we deliver to.";
  return null;
}

/**
 * The online cart priced at the online tier, with the delivery fees the order will carry.
 * Matches what `placeOrder` charges: catch-weight items are estimated at their nominal weight.
 */
export function cartQuote(products: Product[], lines: { sku: string; qty: number }[]) {
  const bySku = new Map(products.map((p) => [p.sku, p]));
  const items = lines.flatMap((l) => {
    const p = bySku.get(l.sku);
    return p && p.active && l.qty > 0 ? [{ product: p, qty: l.qty, total: round2(casePrice(p, ONLINE_TIER) * l.qty) }] : [];
  });
  const subtotal = round2(items.reduce((t, i) => t + i.total, 0));
  return { items, subtotal, ...orderTotals(subtotal, "DELIVERY") };
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
  PICKING: "Being packed",
  LOADED: "Loaded",
  EN_ROUTE: "En route",
  ARRIVED: "Arrived",
  DELIVERED: "Delivered",
  EXCEPTION: "Problem",
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

/** Why a receipt can't go to this address or number, or null when it can. */
export function receiptToError(channel: ReceiptChannel, to: string): string | null {
  const v = to.trim();
  if (channel === "EMAIL") return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? null : "Enter an e-mail address, e.g. name@example.com.";
  const digits = v.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 13 ? null : "Enter a mobile number, e.g. 0917 555 1234.";
}

/** The receipt as plain text: one short line for SMS, the full breakdown for e-mail. */
export function receiptMessage(o: Order, buyer: Client, seller: Seller, channel: ReceiptChannel) {
  const no = invoiceNumber(o.invoiceNo);
  const v = vatSplit(o.total);
  const status = o.paid ? "Paid" : o.payMethod === "COD" ? "Pay on delivery" : "Charged to your account";
  const subject = `${seller.tradeName} sales invoice ${no}`;
  if (channel === "SMS") {
    const items = o.lines.reduce((t, l) => t + l.qty, 0);
    return { subject, body: `${seller.tradeName}: invoice ${no}, ${dateTime(o.createdAt)}. ${items} items, total ${money(o.total)} incl. VAT ${money(v.vat)}. ${status}. Thank you!` };
  }
  const lines = o.lines.map((l) => `${l.qty} × ${l.name} (${l.sku}) @ ${money(l.unitPrice)}${l.catchWeight ? "/kg" : ""} = ${money(l.lineTotal)}`);
  const fees = [o.dropFee > 0 && `Small-drop fee ${money(o.dropFee)}`, o.fuel > 0 && `Fuel surcharge ${money(o.fuel)}`].filter(Boolean) as string[];
  const body = [
    `${seller.registeredName}`,
    `VAT Reg. TIN ${seller.tin}`,
    seller.address,
    "",
    `Sales invoice ${no}, order ${o.number}`,
    `Date: ${dateTime(o.createdAt)}`,
    `Sold to: ${buyerName(o, buyer)}${buyer.tin ? `, TIN ${buyer.tin}` : ""}`,
    ...(buyer.address ? [`${buyer.address}, ${buyer.city}`] : []),
    "",
    ...lines,
    ...fees,
    "",
    `VATable sales: ${money(v.net)}`,
    "VAT-exempt sales: ₱0.00",
    "Zero-rated sales: ₱0.00",
    `VAT 12%: ${money(v.vat)}`,
    `Total: ${money(o.total)}`,
    `${PAY_LABEL[o.payMethod]}. ${status}.`,
    ...(o.status === "CANCELLED" ? ["", "This invoice was cancelled."] : []),
    "",
    `Questions: ${seller.phone}, ${seller.email}`,
  ].join("\n");
  return { subject, body };
}

/** Opens the device's own SMS or mail app with the receipt filled in. */
export function receiptHref(channel: ReceiptChannel, to: string, msg: { subject: string; body: string }) {
  if (channel === "SMS") return `sms:${to.replace(/[^\d+]/g, "")}?body=${encodeURIComponent(msg.body)}`;
  return `mailto:${encodeURIComponent(to.trim())}?subject=${encodeURIComponent(msg.subject)}&body=${encodeURIComponent(msg.body)}`;
}

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

/** A stop can move to another day until its stock is loaded, since loading takes it off the shelf. */
export const RESCHEDULABLE: DeliveryStatus[] = ["SCHEDULED", "PICKING"];

/** Vans and riders run Monday to Saturday. */
export const isDeliveryDay = (key: string) => new Date(keyToTs(key)).getDay() !== 0;

/** The next `n` delivery days as yyyy-mm-dd, starting today or tomorrow. Noon keeps daylight saving off the boundary. */
export function deliveryDays(now: number, n: number, fromToday = false) {
  const out: string[] = [];
  let t = startOfDay(now) + (fromToday ? 0 : DAY) + 12 * HOUR;
  while (out.length < n) {
    const k = dateKey(t);
    if (isDeliveryDay(k)) out.push(k);
    t += DAY;
  }
  return out;
}

/** Why a stop can't move to `date`, or null when it can. `vanLeft` is whether the van on its route has left that day. */
export function rescheduleError(d: Delivery, date: string, opts: { today: string; vanLeft: boolean; lots: Lot[]; order?: Order }) {
  if (!RESCHEDULABLE.includes(d.status)) return "This stop is already loaded or on its way. Move it before it is loaded.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "Pick a date.";
  if (date < opts.today) return "Pick today or a later day.";
  if (!isDeliveryDay(date)) return "No deliveries on Sundays. Pick another day.";
  if (!d.riderId && opts.vanLeft) return "The van has already left that day. Pick another day or give the stop to a rider.";
  const byId = new Map(opts.lots.map((l) => [l.id, l]));
  const end = keyToTs(date) + DAY;
  for (const line of opts.order?.lines ?? []) {
    for (const a of line.allocs) {
      const lot = byId.get(a.lotId);
      if (lot && lot.bestBy < end) return `Lot ${lot.code} of ${line.name} is past its best-by by then. Pick an earlier day.`;
    }
  }
  return null;
}

export const NOTE_MAX = 300;

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
