import type { Client, Lot, Product } from "../lib/types";

/** Monday 12 October 2026, 9 am local. */
export const NOW = new Date(2026, 9, 12, 9, 0, 0).getTime();
export const TODAY = "2026-10-12";
export const DAY = 86_400_000;

export const product = (over: Partial<Product> = {}): Product => ({
  sku: "DM-1001",
  name: "Pork siomai",
  category: "Dimsum",
  unit: "case",
  pack: "10 × 50 pcs",
  caseKg: 10,
  catchWeight: false,
  zone: "FRZ",
  bin: "F-01-01",
  cost: 1000,
  price: { A: 2000, B: 2100, C: 2200 },
  reorderPoint: 10,
  par: 30,
  shelfDays: 180,
  active: true,
  ...over,
});

export const lot = (over: Partial<Lot> = {}): Lot => ({
  id: "lot-1",
  sku: "DM-1001",
  code: "L1",
  madeAt: NOW - 10 * DAY,
  // Far ahead, so rules that compare with the real clock still see it as good.
  bestBy: NOW + 3650 * DAY,
  madeQty: 20,
  qty: 20,
  bin: "F-01-01",
  coreTempC: -18,
  batch: "PB-0001",
  status: "AVAILABLE",
  ...over,
});

export const client = (over: Partial<Client> = {}): Client => ({
  id: "c-1",
  name: "Kusina ni Lola",
  type: "Restaurant",
  tier: "B",
  terms: "NET15",
  creditLimit: 50000,
  balance: 0,
  pastDue: 0,
  address: "Iznart St",
  city: "Iloilo City",
  contact: "Lola",
  phone: "0917 555 1234",
  routeId: "CTY",
  window: "8–10 am",
  dockNote: "",
  ...over,
});
