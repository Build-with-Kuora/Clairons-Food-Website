"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { DAY, HOUR, dateKey, keyToTs, lotCode, uid, unitPlural } from "./format";
import {
  ASSIGNABLE,
  NOTE_MAX,
  ONLINE_TIER,
  SERVICE_AREAS,
  WALK_IN,
  WALK_IN_ID,
  allocateFEFO,
  customerError,
  freeBlastBin,
  nextSku,
  priceDiff,
  orderTotals,
  priceLines,
  productError,
  receiptToError,
  refusedCredit,
  refusedSettlement,
  rescheduleError,
  reservedByLot,
  round2,
  runKey,
  zoneOfBin,
} from "./logic";
import { SELLER, buildSeed, type Data } from "./seed";
import type {
  Batch,
  Client,
  CustomerInput,
  DeliveryStatus,
  Lot,
  Movement,
  Order,
  OrderLine,
  PayMethod,
  Pod,
  Product,
  ProductInput,
  ReceiptChannel,
  Rider,
  Run,
} from "./types";

export interface PlaceOrderInput {
  clientId: string;
  lines: { sku: string; qty: number }[];
  fulfillment: "DELIVERY" | "PICKUP";
  date: string;
  payMethod: PayMethod;
  clientPo?: string;
  notes?: string;
  by: string;
  channel?: "ONLINE";
  /** Walk-in buyer's name, optional */
  buyerName?: string;
}

export interface ProduceInput {
  sku: string;
  qty: number;
  by: string;
  note?: string;
}

export interface RiderInput {
  id?: string;
  name: string;
  phone: string;
  bike: string;
  active: boolean;
}

interface Actions {
  reset(): void;
  tick(): void;
  placeOrder(i: PlaceOrderInput): { ok: true; order: Order } | { ok: false; error: string };
  cancelOrder(orderId: string, by: string): void;
  advance(deliveryId: string, to: DeliveryStatus, by: string, note?: string): void;
  dispatchRoute(routeId: string, date: string, by: string): void;
  completeDelivery(deliveryId: string, pod: Omit<Pod, "at">, by: string): void;
  reportException(deliveryId: string, reason: string, note: string, by: string): void;
  /** Give a stop to a rider, or back to the van on its route (riderId null). */
  assignDelivery(deliveryId: string, riderId: string | null, by: string): { ok: true } | { ok: false; error: string };
  saveRider(i: RiderInput): { ok: true; rider: Rider } | { ok: false; error: string };
  /** Move a stop to another day before it is loaded. */
  rescheduleDelivery(deliveryId: string, date: string, by: string): { ok: true } | { ok: false; error: string };
  /** Set or clear dispatch's note on a stop. */
  setDeliveryNote(deliveryId: string, note: string, by: string): { ok: true } | { ok: false; error: string };
  /** Add a product, or edit one (including deactivating it). */
  saveProduct(i: ProductInput, by: string): { ok: true; product: Product } | { ok: false; error: string };
  /** Create or update an online customer's client record (matched by e-mail) from their checkout details. */
  saveCustomer(i: CustomerInput): { ok: true; client: Client } | { ok: false; error: string };
  /** Record that a copy of the receipt went to the buyer. */
  logReceipt(orderId: string, channel: ReceiptChannel, to: string, by: string): { ok: true } | { ok: false; error: string };
  /** Record that the refund owed for refused cases was handed back to the buyer. */
  markRefunded(orderId: string, by: string): { ok: true } | { ok: false; error: string };
  produce(i: ProduceInput): { ok: true; batch: Batch; lot: Lot } | { ok: false; error: string };
  adjust(lotId: string, delta: number, type: "ADJUST" | "WASTE", note: string, by: string): void;
  moveLot(lotId: string, bin: string, by: string): void;
  setHold(lotId: string, hold: boolean, reason: string, by: string): void;
}

export type Store = Data & Actions;

const empty: Data = {
  seller: SELLER,
  products: [],
  lots: [],
  movements: [],
  clients: [],
  orders: [],
  deliveries: [],
  routes: [],
  riders: [],
  runs: {},
  zones: [],
  batches: [],
  priceChanges: [],
  counters: { so: 0, batch: 0, invoice: 0 },
  seededAt: 0,
};

const round1 = (n: number) => Math.round(n * 10) / 10;
const mv = (m: Omit<Movement, "id" | "at"> & { at?: number }): Movement => ({ id: uid(), at: Date.now(), ...m });

// Bump when the saved data shape changes, so browsers with old demo data reseed.
export const STORAGE_KEY = "clairons-coldline-ph-v7";

export const useStore = create<Store>()(
  persist(
    (set, get) => ({
      ...empty,

      reset: () => set(buildSeed()),

      tick: () => {
        const s = get();
        const now = Date.now();
        const today = dateKey(now);
        const zones = s.zones.map((z) => {
          const last = z.readings.at(-1) ?? z.setPointC;
          const next = last + (z.setPointC - last) * 0.4 + (Math.random() - 0.5) * 0.8;
          return { ...z, readings: [...z.readings.slice(-47), round1(next)] };
        });
        const runs: Record<string, Run> = { ...s.runs };
        for (const [k, run] of Object.entries(runs)) {
          if (run.date !== today || run.returnedAt) continue;
          const last = run.temps.at(-1);
          if (last && now - last.at < 45_000) continue;
          const route = s.routes.find((r) => r.id === run.routeId);
          const target = (route?.setPointC ?? -20) + 1;
          const prev = last?.c ?? target;
          const c = round1(prev + (target - prev) * 0.3 + (Math.random() - 0.5) * 0.6);
          runs[k] = { ...run, temps: [...run.temps, { at: now, c }] };
        }
        set({ zones, runs });
      },

      placeOrder: (i) => {
        const s = get();
        const client = s.clients.find((c) => c.id === i.clientId);
        if (!client) return { ok: false, error: "Pick a client first." };
        const qtyLines = i.lines.filter((l) => l.qty > 0);
        if (!qtyLines.length) return { ok: false, error: "Add at least one product to the ticket." };

        const reserved = reservedByLot(s.orders, s.deliveries);
        const lines: OrderLine[] = [];
        const off = qtyLines.find((l) => s.products.find((p) => p.sku === l.sku)?.active === false);
        if (off) return { ok: false, error: `${off.sku} is no longer sold. Take it off the ticket.` };
        for (const l of priceLines(s.products, client, qtyLines)) {
          const allocs = allocateFEFO(s.lots, l.sku, l.qty, reserved);
          if (!allocs) return { ok: false, error: `Not enough sellable stock for ${l.sku}. Lower the quantity, or check held lots and batches still in the blast freezer.` };
          for (const a of allocs) reserved[a.lotId] = (reserved[a.lotId] ?? 0) + a.qty;
          lines.push({ ...l, allocs });
        }

        const now = Date.now();
        const subtotal = round2(lines.reduce((t, l) => t + l.lineTotal, 0));
        const totals = orderTotals(subtotal, i.fulfillment);
        const n = s.counters.so + 1;
        const invoiceNo = s.counters.invoice + 1;
        const order: Order = {
          id: `o-${n}`,
          number: `SO-${n}`,
          invoiceNo,
          clientId: client.id,
          createdAt: now,
          by: i.by,
          lines,
          subtotal,
          ...totals,
          payMethod: i.payMethod,
          paid: ["CARD", "CASH", "CHECK", "GCASH"].includes(i.payMethod),
          fulfillment: i.fulfillment,
          status: "OPEN",
          clientPo: i.clientPo || undefined,
          notes: i.notes || undefined,
          channel: i.channel,
          buyerName: i.buyerName?.trim() || undefined,
        };

        let lots = s.lots;
        let movements = s.movements;
        let deliveries = s.deliveries;
        let runs = s.runs;

        if (i.fulfillment === "PICKUP") {
          order.status = "FULFILLED";
          const take = new Map<string, number>();
          for (const l of lines) for (const a of l.allocs) take.set(a.lotId, (take.get(a.lotId) ?? 0) + a.qty);
          lots = lots.map((l) => (take.has(l.id) ? { ...l, qty: l.qty - take.get(l.id)! } : l));
          const moves = lines.flatMap((l) =>
            l.allocs.map((a) => mv({ sku: l.sku, lotCode: a.lotCode, type: "PICKUP", qty: -a.qty, ref: order.number, by: i.by })),
          );
          movements = [...moves, ...movements];
        } else {
          const seq = s.deliveries.filter((d) => d.date === i.date && d.routeId === client.routeId).length + 1;
          const id = `d-${n}`;
          order.deliveryId = id;
          deliveries = [
            ...deliveries,
            {
              id,
              orderId: order.id,
              clientId: client.id,
              routeId: client.routeId,
              date: i.date,
              seq,
              status: "SCHEDULED",
              events: [{ status: "SCHEDULED", at: now, by: i.by }],
            },
          ];
          const k = runKey(client.routeId, i.date);
          if (!runs[k]) runs = { ...runs, [k]: { routeId: client.routeId, date: i.date, plannedDepart: keyToTs(i.date) + 5.5 * HOUR, temps: [] } };
        }

        const clients =
          i.payMethod === "ACCOUNT"
            ? s.clients.map((c) => (c.id === client.id ? { ...c, balance: round2(c.balance + order.total) } : c))
            : s.clients;

        set({ orders: [...s.orders, order], lots, movements, deliveries, runs, clients, counters: { ...s.counters, so: n, invoice: invoiceNo } });
        return { ok: true, order };
      },

      cancelOrder: (orderId, by) => {
        const s = get();
        const o = s.orders.find((x) => x.id === orderId);
        if (!o || o.status !== "OPEN") return;
        const d = s.deliveries.find((x) => x.id === o.deliveryId);
        if (d && !["SCHEDULED", "PICKING"].includes(d.status)) return;
        set({
          orders: s.orders.map((x) => (x.id === orderId ? { ...x, status: "CANCELLED" } : x)),
          deliveries: s.deliveries.filter((x) => x.id !== o.deliveryId),
          clients:
            o.payMethod === "ACCOUNT"
              ? s.clients.map((c) => (c.id === o.clientId ? { ...c, balance: round2(c.balance - o.total) } : c))
              : s.clients,
          movements: [mv({ sku: o.lines[0]?.sku ?? "", type: "RELEASE", qty: 0, ref: o.number, by, note: "Order cancelled, reservation released" }), ...s.movements],
        });
      },

      advance: (deliveryId, to, by, note) => {
        const s = get();
        const d = s.deliveries.find((x) => x.id === deliveryId);
        if (!d) return;
        const now = Date.now();
        let lots = s.lots;
        let movements = s.movements;
        if (to === "LOADED") {
          const o = s.orders.find((x) => x.id === d.orderId);
          if (o) {
            const take = new Map<string, number>();
            for (const l of o.lines) for (const a of l.allocs) take.set(a.lotId, (take.get(a.lotId) ?? 0) + a.qty);
            lots = lots.map((l) => (take.has(l.id) ? { ...l, qty: Math.max(0, l.qty - take.get(l.id)!) } : l));
            const moves = o.lines.flatMap((l) =>
              l.allocs.map((a) => mv({ sku: l.sku, lotCode: a.lotCode, type: "SHIP", qty: -a.qty, ref: o.number, by })),
            );
            movements = [...moves, ...movements];
          }
        }
        set({
          lots,
          movements,
          deliveries: s.deliveries.map((x) =>
            x.id === deliveryId
              ? { ...x, status: to, eta: to === "ARRIVED" ? undefined : x.eta, events: [...x.events, { status: to, at: now, by, note }] }
              : x,
          ),
        });
      },

      dispatchRoute: (routeId, date, by) => {
        const s = get();
        const now = Date.now();
        const k = runKey(routeId, date);
        const run = s.runs[k] ?? { routeId, date, plannedDepart: now, temps: [] };
        let i = 0;
        set({
          runs: { ...s.runs, [k]: { ...run, departedAt: run.departedAt ?? now } },
          deliveries: s.deliveries
            .slice()
            .sort((a, b) => a.seq - b.seq)
            .map((d) => {
              if (d.routeId !== routeId || d.riderId || d.date !== date || d.status !== "LOADED") return d;
              i++;
              return { ...d, status: "EN_ROUTE" as const, eta: now + i * 35 * 60_000, events: [...d.events, { status: "EN_ROUTE" as const, at: now, by }] };
            }),
        });
      },

      completeDelivery: (deliveryId, pod, by) => {
        const s = get();
        const d = s.deliveries.find((x) => x.id === deliveryId);
        const o = s.orders.find((x) => x.id === d?.orderId);
        if (!d || !o) return;
        const now = Date.now();
        let lots = s.lots;
        let movements = s.movements;
        const credit = refusedCredit(o, pod.shorts);
        const settle = refusedSettlement(o);
        for (const sh of pod.shorts) {
          const line = o.lines.find((l) => l.sku === sh.sku);
          const alloc = line?.allocs[0];
          if (!line || !alloc || sh.qty <= 0) continue;
          lots = lots.map((l) => (l.id === alloc.lotId ? { ...l, qty: l.qty + sh.qty } : l));
          movements = [mv({ sku: sh.sku, lotCode: alloc.lotCode, type: "RETURN", qty: sh.qty, ref: o.number, by, note: sh.reason }), ...movements];
        }
        set({
          lots,
          movements,
          deliveries: s.deliveries.map((x) =>
            x.id === deliveryId
              ? { ...x, status: "DELIVERED", eta: undefined, pod: { ...pod, at: now }, events: [...x.events, { status: "DELIVERED", at: now, by }] }
              : x,
          ),
          orders: s.orders.map((x) =>
            x.id === o.id
              ? {
                  ...x,
                  status: "FULFILLED",
                  paid: x.paid || (pod.collected ?? 0) > 0,
                  ...(credit > 0 && settle === "REFUND" ? { refund: { amount: credit } } : {}),
                }
              : x,
          ),
          clients:
            credit > 0 && settle === "ACCOUNT"
              ? s.clients.map((c) => (c.id === o.clientId ? { ...c, balance: round2(c.balance - credit) } : c))
              : s.clients,
        });
      },

      reportException: (deliveryId, reason, note, by) => {
        const s = get();
        const now = Date.now();
        set({
          deliveries: s.deliveries.map((x) =>
            x.id === deliveryId
              ? {
                  ...x,
                  status: "EXCEPTION",
                  eta: undefined,
                  exception: { reason, note, at: now },
                  events: [...x.events, { status: "EXCEPTION", at: now, by, note: reason }],
                }
              : x,
          ),
        });
      },

      assignDelivery: (deliveryId, riderId, by) => {
        const s = get();
        const d = s.deliveries.find((x) => x.id === deliveryId);
        if (!d) return { ok: false, error: "Stop not found." };
        if ((d.riderId ?? null) === riderId) return { ok: true };
        if (!ASSIGNABLE.includes(d.status)) return { ok: false, error: "This stop has already left. Reassign it before it goes out." };
        const rider = riderId ? s.riders.find((r) => r.id === riderId) : undefined;
        if (riderId && !rider?.active) return { ok: false, error: "Pick an active rider." };
        const route = s.routes.find((r) => r.id === d.routeId);
        if (!riderId && s.runs[runKey(d.routeId, d.date)]?.departedAt) return { ok: false, error: `${route?.truck} has already left. Keep this stop with a rider.` };
        // Join the end of the new carrier's list for that day.
        const seq =
          Math.max(0, ...s.deliveries.filter((x) => x.date === d.date && x.id !== d.id && (riderId ? x.riderId === riderId : x.routeId === d.routeId && !x.riderId)).map((x) => x.seq)) + 1;
        const note = rider ? `Assigned to rider ${rider.name}` : `Moved back to ${route?.truck}, ${route?.name}`;
        set({
          deliveries: s.deliveries.map((x) =>
            x.id === deliveryId ? { ...x, riderId: riderId ?? undefined, seq, events: [...x.events, { status: x.status, at: Date.now(), by, note }] } : x,
          ),
        });
        return { ok: true };
      },

      rescheduleDelivery: (deliveryId, date, by) => {
        const s = get();
        const d = s.deliveries.find((x) => x.id === deliveryId);
        if (!d) return { ok: false, error: "Stop not found." };
        if (d.date === date) return { ok: true };
        const k = runKey(d.routeId, date);
        const error = rescheduleError(d, date, {
          today: dateKey(Date.now()),
          vanLeft: !!s.runs[k]?.departedAt,
          lots: s.lots,
          order: s.orders.find((o) => o.id === d.orderId),
        });
        if (error) return { ok: false, error };
        // Join the end of the same carrier's list on the new day. Picking starts over on the day it goes.
        const seq =
          Math.max(0, ...s.deliveries.filter((x) => x.date === date && x.id !== d.id && (d.riderId ? x.riderId === d.riderId : x.routeId === d.routeId && !x.riderId)).map((x) => x.seq)) + 1;
        const runs = d.riderId || s.runs[k] ? s.runs : { ...s.runs, [k]: { routeId: d.routeId, date, plannedDepart: keyToTs(date) + 5.5 * HOUR, temps: [] } };
        const note = `Moved from ${d.date} to ${date}`;
        set({
          runs,
          deliveries: s.deliveries.map((x) =>
            x.id === deliveryId ? { ...x, date, seq, status: "SCHEDULED", eta: undefined, events: [...x.events, { status: "SCHEDULED", at: Date.now(), by, note }] } : x,
          ),
        });
        return { ok: true };
      },

      setDeliveryNote: (deliveryId, note, by) => {
        const s = get();
        const d = s.deliveries.find((x) => x.id === deliveryId);
        if (!d) return { ok: false, error: "Stop not found." };
        if (d.status === "DELIVERED" || d.status === "EXCEPTION") return { ok: false, error: "This stop is closed. Its note can't change now." };
        const text = note.trim();
        if (text.length > NOTE_MAX) return { ok: false, error: `Keep the note under ${NOTE_MAX} characters.` };
        if (text === (d.note ?? "")) return { ok: true };
        set({
          deliveries: s.deliveries.map((x) =>
            x.id === deliveryId ? { ...x, note: text || undefined, events: [...x.events, { status: x.status, at: Date.now(), by, note: text ? `Note: ${text}` : "Note removed" }] } : x,
          ),
        });
        return { ok: true };
      },

      saveRider: (i) => {
        const s = get();
        const name = i.name.trim();
        if (!name) return { ok: false, error: "Enter the rider's name." };
        const twin = s.riders.find((r) => r.id !== i.id && r.name.toLowerCase() === name.toLowerCase());
        if (twin) return { ok: false, error: `${twin.name} is already on the rider list.` };
        const rider: Rider = { id: i.id ?? `rd-${uid()}`, name, phone: i.phone.trim(), bike: i.bike.trim(), active: i.active };
        set({ riders: i.id ? s.riders.map((r) => (r.id === i.id ? rider : r)) : [...s.riders, rider] });
        return { ok: true, rider };
      },

      saveProduct: (i, by) => {
        const s = get();
        if (i.sku && !s.products.some((p) => p.sku === i.sku)) return { ok: false, error: "Product not found." };
        const error = productError(i, s.products);
        if (error) return { ok: false, error };
        const product: Product = {
          ...i,
          sku: i.sku ?? nextSku(s.products, i.category),
          name: i.name.trim(),
          unit: i.unit.trim().toLowerCase(),
          pack: i.pack.trim(),
          bin: i.bin.trim().toUpperCase(),
        };
        const before = i.sku ? s.products.find((p) => p.sku === i.sku) : undefined;
        const now = Date.now();
        const changes = before ? priceDiff(before, product).map((c) => ({ ...c, id: uid(), at: now, sku: product.sku, by })) : [];
        set({
          products: i.sku ? s.products.map((p) => (p.sku === i.sku ? product : p)) : [...s.products, product],
          priceChanges: changes.length ? [...changes, ...s.priceChanges] : s.priceChanges,
        });
        return { ok: true, product };
      },

      saveCustomer: (i) => {
        const err = customerError(i);
        if (err) return { ok: false, error: err };
        const s = get();
        const email = i.email.trim().toLowerCase();
        const prev = s.clients.find((c) => c.type === "Online customer" && c.email === email);
        const client: Client = {
          ...(prev ?? {
            id: `c-web-${uid()}`,
            type: "Online customer",
            tier: ONLINE_TIER,
            terms: "COD",
            creditLimit: 0,
            balance: 0,
            pastDue: 0,
            window: "8 am–5 pm",
            dockNote: "",
            email,
          }),
          name: i.name.trim(),
          contact: i.name.trim(),
          phone: i.phone.trim(),
          address: i.address.trim(),
          city: i.city,
          routeId: SERVICE_AREAS[i.city],
        };
        set({ clients: prev ? s.clients.map((c) => (c.id === prev.id ? client : c)) : [...s.clients, client] });
        return { ok: true, client };
      },

      logReceipt: (orderId, channel, to, by) => {
        const s = get();
        if (!s.orders.some((o) => o.id === orderId)) return { ok: false, error: "Order not found." };
        const error = receiptToError(channel, to);
        if (error) return { ok: false, error };
        const send = { at: Date.now(), channel, to: to.trim(), by };
        set({ orders: s.orders.map((o) => (o.id === orderId ? { ...o, receipts: [...(o.receipts ?? []), send] } : o)) });
        return { ok: true };
      },

      markRefunded: (orderId, by) => {
        const s = get();
        const o = s.orders.find((x) => x.id === orderId);
        if (!o?.refund) return { ok: false, error: "No refund is owed on this order." };
        if (o.refund.at) return { ok: false, error: "This refund was already handed back." };
        const refund = { ...o.refund, at: Date.now(), by };
        set({ orders: s.orders.map((x) => (x.id === orderId ? { ...x, refund } : x)) });
        return { ok: true };
      },

      produce: (i) => {
        const s = get();
        const p = s.products.find((x) => x.sku === i.sku);
        if (!p) return { ok: false, error: "Pick a product." };
        if (!p.active) return { ok: false, error: `${p.name} is inactive. Turn it back on under Inventory, Products, to make it.` };
        if (!Number.isInteger(i.qty) || i.qty <= 0) return { ok: false, error: `Enter how many ${unitPlural(p.unit)} were made.` };
        const now = Date.now();
        const n = s.counters.batch + 1;
        const number = `PB-${String(n).padStart(4, "0")}`;
        const bin = freeBlastBin(s.lots);
        const lot: Lot = {
          id: uid(),
          sku: p.sku,
          code: lotCode(now, s.lots.filter((l) => l.madeAt > now - DAY).length + 1),
          madeAt: now,
          bestBy: now + p.shelfDays * DAY,
          madeQty: i.qty,
          qty: i.qty,
          bin,
          coreTempC: -18,
          batch: number,
          status: "AVAILABLE",
        };
        const batch: Batch = { id: `pb-${n}`, number, sku: p.sku, qty: i.qty, madeAt: now, by: i.by, lotId: lot.id, note: i.note || undefined };
        const move = mv({ sku: p.sku, lotCode: lot.code, type: "PRODUCE", qty: i.qty, ref: number, by: i.by, note: `Into blast freezer ${bin}` });
        set({
          lots: [...s.lots, lot],
          batches: [batch, ...s.batches],
          movements: [move, ...s.movements],
          counters: { ...s.counters, batch: n },
        });
        return { ok: true, batch, lot };
      },


      adjust: (lotId, delta, type, note, by) => {
        const s = get();
        const lot = s.lots.find((l) => l.id === lotId);
        if (!lot) return;
        const qty = Math.max(-lot.qty, delta);
        set({
          lots: s.lots.map((l) => (l.id === lotId ? { ...l, qty: l.qty + qty } : l)),
          movements: [mv({ sku: lot.sku, lotCode: lot.code, type, qty, by, note }), ...s.movements],
        });
      },

      moveLot: (lotId, bin, by) => {
        const s = get();
        const lot = s.lots.find((l) => l.id === lotId);
        if (!lot || lot.bin === bin) return;
        const zoneNote = zoneOfBin(lot.bin) !== zoneOfBin(bin) ? " (zone change)" : "";
        set({
          lots: s.lots.map((l) => (l.id === lotId ? { ...l, bin } : l)),
          movements: [mv({ sku: lot.sku, lotCode: lot.code, type: "TRANSFER", qty: 0, by, note: `${lot.bin} to ${bin}${zoneNote}` }), ...s.movements],
        });
      },

      setHold: (lotId, hold, reason, by) => {
        const s = get();
        const lot = s.lots.find((l) => l.id === lotId);
        if (!lot) return;
        set({
          lots: s.lots.map((l) => (l.id === lotId ? { ...l, status: hold ? "HOLD" : "AVAILABLE", holdReason: hold ? reason : undefined } : l)),
          movements: [mv({ sku: lot.sku, lotCode: lot.code, type: hold ? "HOLD" : "RELEASE", qty: 0, by, note: reason }), ...s.movements],
        });
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      // Demo data saved before walk-in sales existed has no walk-in account; add it rather than reseed.
      merge: (saved, current) => {
        const s = { ...current, ...(saved as Partial<Store>) };
        if (s.products.length && !s.clients.some((c) => c.id === WALK_IN_ID)) s.clients = [...s.clients, WALK_IN];
        return s;
      },
      partialize: (s) => {
        const data: Partial<Data> = {};
        for (const k of Object.keys(empty) as (keyof Data)[]) (data as Record<string, unknown>)[k] = s[k];
        return data as Data;
      },
    },
  ),
);

/** Non-persisted UI state: toasts and cross-page hand-offs. */
interface Ui {
  toasts: { id: string; text: string; tone: "ok" | "warn" }[];
  toast(text: string, tone?: "ok" | "warn"): void;
  counterClientId?: string;
  setCounterClient(id?: string): void;
  /** The online order just placed at checkout, so My orders can thank the customer. */
  placedOrderId?: string;
  setPlacedOrder(id?: string): void;
  /** A search typed in the header, for Inventory. `searchId` changes on every search so the table restarts with it. */
  inventorySearch: string;
  searchId: number;
  searchInventory(term: string): void;
  clearInventorySearch(): void;
}

export const useUi = create<Ui>()((set) => ({
  toasts: [],
  toast: (text, tone = "ok") => {
    const id = uid();
    set((s) => ({ toasts: [...s.toasts, { id, text, tone }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 3800);
  },
  counterClientId: undefined,
  setCounterClient: (id) => set({ counterClientId: id }),
  placedOrderId: undefined,
  setPlacedOrder: (id) => set({ placedOrderId: id }),
  inventorySearch: "",
  searchId: 0,
  searchInventory: (term) => set((s) => ({ inventorySearch: term, searchId: s.searchId + 1 })),
  clearInventorySearch: () => set({ inventorySearch: "" }),
}));
