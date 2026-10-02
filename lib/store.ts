"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { DAY, HOUR, dateKey, keyToTs, lotCode, uid } from "./format";
import {
  allocateFEFO,
  freeBlastBin,
  orderTotals,
  priceLines,
  receiveLimitC,
  reservedByLot,
  round2,
  runKey,
  zoneOfBin,
} from "./logic";
import { buildSeed, type Data } from "./seed";
import type {
  Batch,
  DeliveryStatus,
  Lot,
  Movement,
  Order,
  OrderLine,
  PayMethod,
  Pod,
  PurchaseOrder,
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
}

export interface ProduceInput {
  sku: string;
  qty: number;
  by: string;
  note?: string;
}

export interface ReceiveInput {
  sku: string;
  qty: number;
  bestBy: number;
  bin: string;
  tempC: number;
  po?: string;
  by: string;
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
  produce(i: ProduceInput): { ok: true; batch: Batch; lot: Lot } | { ok: false; error: string };
  receive(i: ReceiveInput): Lot;
  adjust(lotId: string, delta: number, type: "ADJUST" | "WASTE", note: string, by: string): void;
  moveLot(lotId: string, bin: string, by: string): void;
  setHold(lotId: string, hold: boolean, reason: string, by: string): void;
  createPO(supplierId: string, lines: { sku: string; qty: number }[]): PurchaseOrder;
  receivePO(poId: string, entries: { sku: string; qty: number; tempC: number }[], by: string): void;
}

export type Store = Data & Actions;

const empty: Data = {
  products: [],
  lots: [],
  movements: [],
  clients: [],
  orders: [],
  deliveries: [],
  routes: [],
  runs: {},
  zones: [],
  suppliers: [],
  pos: [],
  batches: [],
  counters: { so: 0, po: 0, batch: 0 },
  seededAt: 0,
};

const round1 = (n: number) => Math.round(n * 10) / 10;
const mv = (m: Omit<Movement, "id" | "at"> & { at?: number }): Movement => ({ id: uid(), at: Date.now(), ...m });

// Bump when the saved data shape changes, so browsers with old demo data reseed.
export const STORAGE_KEY = "clairons-coldline-ph-v2";

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
        if (!qtyLines.length) return { ok: false, error: "Add at least one case to the ticket." };

        const reserved = reservedByLot(s.orders, s.deliveries);
        const lines: OrderLine[] = [];
        for (const l of priceLines(s.products, client, qtyLines)) {
          const allocs = allocateFEFO(s.lots, l.sku, l.qty, reserved);
          if (!allocs) return { ok: false, error: `Not enough sellable stock for ${l.sku}. Lower the quantity or check held lots.` };
          for (const a of allocs) reserved[a.lotId] = (reserved[a.lotId] ?? 0) + a.qty;
          lines.push({ ...l, allocs });
        }

        const now = Date.now();
        const subtotal = round2(lines.reduce((t, l) => t + l.lineTotal, 0));
        const totals = orderTotals(subtotal, i.fulfillment);
        const n = s.counters.so + 1;
        const order: Order = {
          id: `o-${n}`,
          number: `SO-${n}`,
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

        set({ orders: [...s.orders, order], lots, movements, deliveries, runs, clients, counters: { ...s.counters, so: n } });
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
              if (d.routeId !== routeId || d.date !== date || d.status !== "LOADED") return d;
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
        let credit = 0;
        for (const sh of pod.shorts) {
          const line = o.lines.find((l) => l.sku === sh.sku);
          const alloc = line?.allocs[0];
          if (!line || !alloc || sh.qty <= 0) continue;
          credit += line.catchWeight ? (line.lineTotal / line.qty) * sh.qty : line.unitPrice * sh.qty;
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
            x.id === o.id ? { ...x, status: "FULFILLED", paid: x.paid || (pod.collected ?? 0) > 0 } : x,
          ),
          clients:
            credit > 0 && o.payMethod === "ACCOUNT"
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

      produce: (i) => {
        const s = get();
        const p = s.products.find((x) => x.sku === i.sku);
        if (!p) return { ok: false, error: "Pick a product." };
        if (!Number.isInteger(i.qty) || i.qty <= 0) return { ok: false, error: "Enter how many cases were made." };
        const now = Date.now();
        const n = s.counters.batch + 1;
        const number = `PB-${String(n).padStart(4, "0")}`;
        const bin = freeBlastBin(s.lots);
        const lot: Lot = {
          id: uid(),
          sku: p.sku,
          code: lotCode(now, s.lots.filter((l) => l.receivedAt > now - DAY).length + 1),
          receivedAt: now,
          bestBy: now + p.shelfDays * DAY,
          receivedQty: i.qty,
          qty: i.qty,
          bin,
          supplierId: p.supplierId,
          receiveTempC: -18,
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

      receive: (i) => {
        const s = get();
        const p = s.products.find((x) => x.sku === i.sku)!;
        const now = Date.now();
        const warm = i.tempC > receiveLimitC(p.zone);
        const lot: Lot = {
          id: uid(),
          sku: i.sku,
          code: lotCode(now, s.lots.filter((l) => l.receivedAt > now - DAY).length + 1),
          receivedAt: now,
          bestBy: i.bestBy,
          receivedQty: i.qty,
          qty: i.qty,
          bin: i.bin,
          supplierId: p.supplierId,
          receiveTempC: i.tempC,
          po: i.po,
          status: warm ? "HOLD" : "AVAILABLE",
          holdReason: warm ? `Received at ${i.tempC}°C, above the ${receiveLimitC(p.zone)}°C limit. Probe and inspect before release.` : undefined,
        };
        const moves = [mv({ sku: i.sku, lotCode: lot.code, type: "RECEIVE", qty: i.qty, ref: i.po, by: i.by, note: `${i.tempC}°C at dock, put away to ${i.bin}` })];
        if (warm) moves.unshift(mv({ sku: i.sku, lotCode: lot.code, type: "HOLD", qty: 0, by: i.by, note: "Auto hold: warm at receipt" }));
        set({ lots: [...s.lots, lot], movements: [...moves, ...s.movements] });
        return lot;
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

      createPO: (supplierId, lines) => {
        const s = get();
        const sup = s.suppliers.find((x) => x.id === supplierId)!;
        const n = s.counters.po + 1;
        const now = Date.now();
        const po: PurchaseOrder = {
          id: `po-${n}`,
          number: `PO-${n}`,
          supplierId,
          createdAt: now,
          eta: now + sup.leadDays * DAY,
          status: "SENT",
          lines: lines.map((l) => ({ ...l, cost: s.products.find((p) => p.sku === l.sku)?.cost ?? 0 })),
        };
        set({ pos: [po, ...s.pos], counters: { ...s.counters, po: n } });
        return po;
      },

      receivePO: (poId, entries, by) => {
        const s = get();
        const po = s.pos.find((x) => x.id === poId);
        if (!po) return;
        const now = Date.now();
        for (const e of entries) {
          if (e.qty <= 0) continue;
          const p = s.products.find((x) => x.sku === e.sku)!;
          get().receive({ sku: e.sku, qty: e.qty, tempC: e.tempC, bestBy: now + p.shelfDays * DAY, bin: p.bin, po: po.number, by });
        }
        set({ pos: get().pos.map((x) => (x.id === poId ? { ...x, status: "RECEIVED", receivedAt: now } : x)) });
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
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
}));
