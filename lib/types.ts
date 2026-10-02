export type ZoneId = "BLAST" | "DEEP" | "FRZ" | "COOL";

export interface Zone {
  id: ZoneId;
  name: string;
  setPointC: number;
  /** Alarm threshold. Readings above this are an excursion. */
  maxC: number;
  capacity: number; // pallet positions
  used: number;
  readings: number[]; // newest last, one per tick
}

export type Category =
  | "Dimsum"
  | "Streetfood"
  | "Tocino & longganisa"
  | "Pork"
  | "Poultry"
  | "Seafood"
  | "Desserts"
  | "Bakery"
  | "Fries"
  | "Chiller";

export type Tier = "A" | "B" | "C";

export interface Product {
  sku: string;
  name: string;
  category: Category;
  pack: string;
  caseKg: number;
  /** Catch-weight items are priced per kg; final weight is set at pick. */
  catchWeight: boolean;
  zone: ZoneId;
  bin: string;
  cost: number; // per case, or per kg when catchWeight
  price: Record<Tier, number>;
  reorderPoint: number;
  par: number;
  supplierId: string;
  shelfDays: number;
}

export type LotStatus = "AVAILABLE" | "HOLD";

export interface Lot {
  id: string;
  sku: string;
  code: string;
  receivedAt: number;
  bestBy: number;
  receivedQty: number;
  qty: number; // cases physically on hand
  bin: string;
  supplierId: string;
  receiveTempC: number;
  po?: string;
  /** Production batch number, for lots made in-house */
  batch?: string;
  status: LotStatus;
  holdReason?: string;
}

export type MoveType =
  | "PRODUCE"
  | "RECEIVE"
  | "SHIP"
  | "PICKUP"
  | "ADJUST"
  | "WASTE"
  | "TRANSFER"
  | "RETURN"
  | "HOLD"
  | "RELEASE";

export interface Movement {
  id: string;
  at: number;
  sku: string;
  lotCode?: string;
  type: MoveType;
  qty: number; // signed cases
  ref?: string;
  by: string;
  note?: string;
}

export interface Supplier {
  id: string;
  name: string;
  leadDays: number;
  phone: string;
}

export type Terms = "COD" | "NET15" | "NET30";

export interface Client {
  id: string;
  name: string;
  type: "Restaurant" | "Carinderia" | "Supermarket" | "Sari-sari store" | "Food cart franchise" | "School canteen" | "Hospital" | "Caterer" | "Hotel" | "Convenience store";
  tier: Tier;
  terms: Terms;
  creditLimit: number;
  balance: number;
  pastDue: number;
  address: string;
  city: string;
  contact: string;
  phone: string;
  routeId: string;
  window: string;
  dockNote: string;
}

export interface Alloc {
  lotId: string;
  lotCode: string;
  qty: number;
}

export interface OrderLine {
  sku: string;
  name: string;
  qty: number;
  unitPrice: number; // per case, or per kg when catchWeight
  catchWeight: boolean;
  estKg?: number;
  lineTotal: number;
  allocs: Alloc[];
}

export type PayMethod = "ACCOUNT" | "CARD" | "CASH" | "CHECK" | "GCASH" | "COD";

export interface Order {
  id: string;
  number: string;
  clientId: string;
  createdAt: number;
  by: string;
  lines: OrderLine[];
  subtotal: number;
  dropFee: number;
  fuel: number;
  total: number;
  payMethod: PayMethod;
  paid: boolean;
  fulfillment: "DELIVERY" | "PICKUP";
  deliveryId?: string;
  status: "OPEN" | "FULFILLED" | "CANCELLED";
  clientPo?: string;
  notes?: string;
}

export type DeliveryStatus =
  | "SCHEDULED"
  | "PICKING"
  | "LOADED"
  | "EN_ROUTE"
  | "ARRIVED"
  | "DELIVERED"
  | "EXCEPTION";

export interface DeliveryEvent {
  status: DeliveryStatus;
  at: number;
  by: string;
  note?: string;
}

export interface Short {
  sku: string;
  qty: number;
  reason: string;
}

export interface Pod {
  at: number;
  receivedBy: string;
  signature?: string; // data: URL from the pad, or an SVG path for seeded records
  productTempC: number;
  notes?: string;
  shorts: Short[];
  collected?: number;
}

export interface Delivery {
  id: string;
  orderId: string;
  clientId: string;
  routeId: string;
  date: string; // yyyy-mm-dd
  seq: number;
  status: DeliveryStatus;
  events: DeliveryEvent[];
  eta?: number;
  pod?: Pod;
  exception?: { reason: string; note?: string; at: number };
}

export interface Route {
  id: string;
  name: string;
  truck: string;
  driver: string;
  setPointC: number;
}

export interface TempReading {
  at: number;
  c: number;
}

/** One route on one day: the truck run and its reefer temperature log. */
export interface Run {
  routeId: string;
  date: string;
  plannedDepart: number;
  departedAt?: number;
  returnedAt?: number;
  temps: TempReading[];
}

/** One production run of one product. It becomes a stock lot that starts in the blast freezer. */
export interface Batch {
  id: string;
  number: string;
  sku: string;
  qty: number; // cases
  madeAt: number;
  by: string;
  lotId: string;
  note?: string;
}

export interface PurchaseOrder {
  id: string;
  number: string;
  supplierId: string;
  createdAt: number;
  eta: number;
  lines: { sku: string; qty: number; cost: number }[];
  status: "SENT" | "RECEIVED";
  receivedAt?: number;
}
