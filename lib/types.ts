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
  /** Selling unit the owner sets, singular: "case", "pack", "tub". Stock, production and sales count in it. */
  unit: string;
  /** What is inside one unit, e.g. "10 × 50 pcs" */
  pack: string;
  /** Weight of one unit in kg */
  caseKg: number;
  /** Catch-weight items are priced per kg; final weight is set at pick. */
  catchWeight: boolean;
  zone: ZoneId;
  bin: string;
  cost: number; // per case, or per kg when catchWeight
  price: Record<Tier, number>;
  reorderPoint: number;
  par: number;
  shelfDays: number;
  /** Inactive products stay in stock and history but can't be ordered or produced. */
  active: boolean;
}

/** Add a product (no sku) or edit one (its sku). */
export type ProductInput = Omit<Product, "sku"> & { sku?: string };

export type LotStatus = "AVAILABLE" | "HOLD";

export interface Lot {
  id: string;
  sku: string;
  code: string;
  madeAt: number;
  bestBy: number;
  madeQty: number;
  qty: number; // cases physically on hand
  bin: string;
  /** Core temperature when the batch was put away */
  coreTempC: number;
  /** Production batch number */
  batch: string;
  status: LotStatus;
  holdReason?: string;
}

export type MoveType =
  | "PRODUCE"
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

export type Terms = "COD" | "NET15" | "NET30";

export interface Client {
  id: string;
  name: string;
  type: "Restaurant" | "Carinderia" | "Supermarket" | "Sari-sari store" | "Food cart franchise" | "School canteen" | "Hospital" | "Caterer" | "Hotel" | "Convenience store" | "Online customer";
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
  /** Where e-mailed receipts go */
  email?: string;
  /** Buyer TIN, printed on the invoice when the account has one */
  tin?: string;
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

export type ReceiptChannel = "SMS" | "EMAIL";

/** A copy of the receipt sent to the buyer. */
export interface ReceiptSend {
  at: number;
  channel: ReceiptChannel;
  to: string;
  by: string;
}

/** The registered business printed on every invoice. */
export interface Seller {
  registeredName: string;
  tradeName: string;
  /** VAT-registered TIN with branch code */
  tin: string;
  address: string;
  phone: string;
  email: string;
  /** BIR Permit to Use number and date for the invoicing system */
  permitNo: string;
  permitDate: string;
  /** Approved invoice serial range */
  seriesFrom: number;
  seriesTo: number;
  /** True while the details are made up for the prototype */
  sample: boolean;
}

export interface Order {
  id: string;
  number: string;
  /** Sales invoice serial, issued in order when the order is placed and never reused */
  invoiceNo: number;
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
  receipts?: ReceiptSend[];
  /** Placed by a customer on the online store rather than at the counter */
  channel?: "ONLINE";
}

/** What a customer gives at checkout on the online store. Becomes (or updates) their client record. */
export interface CustomerInput {
  email: string;
  name: string;
  phone: string;
  address: string;
  city: string;
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
  /** Set when a motorbike rider takes this stop instead of the van on its route */
  riderId?: string;
  /** Dispatch's note for this drop, shown to the driver or rider */
  note?: string;
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

/** Motorbike rider for small drops. No reefer, so no temperature log. */
export interface Rider {
  id: string;
  name: string;
  phone: string;
  /** Motorbike and plate, e.g. "Honda Click, NBC 4512" */
  bike: string;
  active: boolean;
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
