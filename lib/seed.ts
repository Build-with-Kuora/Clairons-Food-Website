import { DAY, HOUR, MIN, dateKey, lotCode, startOfDay } from "./format";
import { ZONES, allocateFEFO, orderTotals, priceLines, round2, runKey, zoneOfBin } from "./logic";
import type {
  Alloc,
  Batch,
  Category,
  Client,
  Delivery,
  DeliveryEvent,
  DeliveryStatus,
  Lot,
  Movement,
  Order,
  OrderLine,
  Pod,
  Product,
  Rider,
  Route,
  Run,
  TempReading,
  Zone,
  ZoneId,
} from "./types";

/** Deterministic PRNG so every fresh demo looks the same. */
function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const round1 = (n: number) => Math.round(n * 10) / 10;

type Raw = [string, string, Category, string, number, boolean, ZoneId, string, number, number, number, number, number];

// sku, name, category, pack, case kg, catch weight, zone, home bin, cost ₱, tier-A price ₱, reorder point, par, shelf days
const RAW: Raw[] = [
  ["DM-1001", "Siomai, pork, Japanese style", "Dimsum", "10 × 50 pcs", 10, false, "FRZ", "F-01-A1", 1580, 1950, 25, 80, 180],
  ["DM-1002", "Siomai, shrimp and pork", "Dimsum", "10 × 40 pcs", 10, false, "FRZ", "F-01-A2", 1920, 2350, 15, 50, 180],
  ["DM-1010", "Siopao asado, large", "Dimsum", "6 × 12 pcs", 9, false, "FRZ", "F-01-B1", 1240, 1580, 20, 60, 150],
  ["DM-1011", "Siopao bola-bola, large", "Dimsum", "6 × 12 pcs", 9, false, "FRZ", "F-01-B2", 1300, 1650, 15, 50, 150],
  ["DM-1015", "Siopao asado, mini", "Dimsum", "10 × 20 pcs", 8, false, "FRZ", "F-01-C1", 1350, 1720, 10, 30, 150],
  ["DM-1020", "Hakaw, shrimp dumpling", "Dimsum", "10 × 30 pcs", 7, false, "FRZ", "F-01-C2", 1980, 2450, 8, 24, 180],
  ["DM-1030", "Chicken feet, black bean (tausi)", "Dimsum", "10 × 1 kg", 10, false, "FRZ", "F-02-A1", 1290, 1650, 10, 30, 180],
  ["DM-1031", "Spareribs, black bean (tausi)", "Dimsum", "10 × 1 kg", 10, false, "FRZ", "F-02-A2", 2250, 2800, 8, 24, 180],
  ["DM-1040", "Kuapao, braised pork belly bun", "Dimsum", "6 × 12 pcs", 8, false, "FRZ", "F-02-B1", 1180, 1500, 8, 24, 150],
  ["DM-1050", "Machang, sticky rice in bamboo leaf", "Dimsum", "4 × 10 pcs", 8, false, "FRZ", "F-02-B2", 1650, 2100, 6, 18, 180],
  ["DM-1060", "Lumpiang shanghai, pork", "Dimsum", "12 × 20 pcs", 7, false, "FRZ", "F-02-C1", 1120, 1450, 20, 60, 180],
  ["ST-2001", "Fish balls, flat", "Streetfood", "10 × 1 kg", 10, false, "FRZ", "F-03-A1", 640, 850, 40, 120, 270],
  ["ST-2002", "Squid balls", "Streetfood", "10 × 1 kg", 10, false, "FRZ", "F-03-A2", 860, 1100, 25, 80, 270],
  ["ST-2003", "Kikiam", "Streetfood", "10 × 1 kg", 10, false, "FRZ", "F-03-B1", 720, 950, 30, 90, 270],
  ["ST-2004", "Chicken balls", "Streetfood", "10 × 1 kg", 10, false, "FRZ", "F-03-B2", 680, 900, 20, 60, 270],
  ["ST-2010", "Fish tempura, street style", "Streetfood", "10 × 500 g", 5, false, "FRZ", "F-03-C1", 520, 700, 15, 45, 270],
  ["ST-2020", "Chicken isaw, cleaned, on stick", "Streetfood", "10 × 50 sticks", 8, false, "FRZ", "F-04-A1", 1300, 1700, 10, 30, 120],
  ["ST-2021", "Pork barbecue, marinated, on stick", "Streetfood", "8 × 25 sticks", 8, false, "FRZ", "F-04-A2", 2000, 2600, 10, 30, 120],
  ["ST-2030", "Hotdog, jumbo red", "Streetfood", "10 × 1 kg", 10, false, "FRZ", "F-04-B1", 1250, 1650, 25, 70, 180],
  ["ST-2040", "Turon, banana spring roll", "Streetfood", "10 × 20 pcs", 9, false, "FRZ", "F-04-B2", 1500, 2000, 8, 24, 120],
  ["BR-3001", "Pork tocino, sweet cured", "Tocino & longganisa", "10 × 1 kg", 10, false, "FRZ", "F-05-A1", 1850, 2400, 20, 60, 120],
  ["BR-3002", "Chicken tocino", "Tocino & longganisa", "10 × 1 kg", 10, false, "FRZ", "F-05-A2", 1650, 2150, 10, 30, 120],
  ["BR-3010", "Longganisa, Vigan style garlic", "Tocino & longganisa", "10 × 1 kg", 10, false, "FRZ", "F-05-B1", 1780, 2300, 15, 45, 150],
  ["BR-3011", "Longganisa, Lucban style", "Tocino & longganisa", "10 × 1 kg", 10, false, "FRZ", "F-05-B2", 1700, 2200, 10, 30, 150],
  ["BR-3012", "Longganisa, skinless hamonado", "Tocino & longganisa", "10 × 1 kg", 10, false, "FRZ", "F-05-C1", 1620, 2100, 15, 45, 150],
  ["BR-3020", "Beef tapa, marinated", "Tocino & longganisa", "10 × 1 kg", 10, false, "FRZ", "F-05-C2", 3050, 3900, 10, 30, 120],
  ["BR-3030", "Embutido, pork roll", "Tocino & longganisa", "20 × 500 g", 10, false, "FRZ", "F-06-A1", 2000, 2600, 8, 24, 150],
  ["PK-4001", "Pork liempo, skin-on slab", "Pork", "~20 kg", 20, true, "FRZ", "F-07-A1", 275, 330, 10, 30, 180],
  ["PK-4002", "Pork pata, whole (for crispy pata)", "Pork", "~20 kg", 20, true, "FRZ", "F-07-A2", 215, 265, 8, 24, 180],
  ["PL-5001", "Chicken wings, mid-joint", "Poultry", "12 × 1 kg", 12, false, "FRZ", "F-08-A1", 1650, 2100, 20, 60, 270],
  ["PL-5002", "Chicken leg quarter", "Poultry", "10 × 2 kg", 20, false, "FRZ", "F-08-A2", 2450, 3200, 15, 45, 270],
  ["SE-6001", "Daing na bangus, boneless marinated", "Seafood", "24 × 400 g", 10, false, "DEEP", "D-01-A1", 2400, 3100, 10, 30, 180],
  ["SE-6002", "Shrimp, vannamei 41/50", "Seafood", "10 × 1 kg", 10, false, "DEEP", "D-01-A2", 3300, 4200, 8, 24, 270],
  ["SE-6003", "Squid rings, breaded", "Seafood", "10 × 1 kg", 10, false, "DEEP", "D-01-B1", 1700, 2200, 10, 30, 270],
  ["DE-7001", "Ice cream, ube", "Desserts", "3 gal", 8, false, "DEEP", "D-02-A1", 1020, 1350, 20, 60, 270],
  ["DE-7002", "Ice cream, keso (cheese)", "Desserts", "3 gal", 8, false, "DEEP", "D-02-A2", 1020, 1350, 15, 45, 270],
  ["DE-7003", "Ice cream, mango", "Desserts", "3 gal", 8, false, "DEEP", "D-02-B1", 1020, 1350, 10, 30, 270],
  ["DE-7010", "Leche flan, llanera", "Desserts", "12 × 1 pc", 5, false, "FRZ", "F-09-A1", 880, 1150, 8, 24, 90],
  ["DE-7020", "Buchi, sesame ball with mongo", "Desserts", "10 × 30 pcs", 9, false, "FRZ", "F-09-A2", 1000, 1300, 8, 24, 150],
  ["BK-8001", "Pandesal dough balls", "Bakery", "1 × 200 pcs", 8, false, "FRZ", "F-10-A1", 680, 900, 15, 45, 90],
  ["BK-8002", "Ensaymada, butter and cheese", "Bakery", "6 × 12 pcs", 6, false, "FRZ", "F-10-A2", 1100, 1450, 6, 18, 90],
  ["BK-8003", "Mantou, fried bun", "Bakery", "10 × 20 pcs", 8, false, "FRZ", "F-10-B1", 850, 1100, 8, 24, 150],
  ["FR-8501", "Fries, 3/8\" straight cut", "Fries", "6 × 2 kg", 12, false, "FRZ", "F-11-A1", 1050, 1350, 30, 90, 540],
  ["FR-8502", "Fries, shoestring", "Fries", "6 × 2 kg", 12, false, "FRZ", "F-11-A2", 1100, 1400, 20, 60, 540],
  ["CH-9001", "Quail eggs, boiled and peeled (kwek-kwek)", "Chiller", "10 × 1 kg", 10, false, "COOL", "C-01-A1", 1250, 1600, 8, 24, 21],
  ["CH-9002", "Kesong puti, carabao", "Chiller", "12 × 200 g", 3, false, "COOL", "C-01-A2", 850, 1100, 6, 18, 14],
  ["CH-9003", "Ube halaya", "Chiller", "6 × 1 kg", 6, false, "COOL", "C-01-B1", 1350, 1750, 6, 18, 30],
  ["CH-9004", "Cheese, quick-melt", "Chiller", "6 × 2 kg", 12, false, "COOL", "C-01-B2", 2400, 3100, 8, 24, 180],
];

/** Ice cream sells by the tub; everything else by the case. */
const TUBS = new Set(["DE-7001", "DE-7002", "DE-7003"]);

export const ROUTES: Route[] = [
  { id: "MNL", name: "Binondo & Manila", truck: "Ref van 02", driver: "Rommel Santos", setPointC: -20 },
  { id: "QC", name: "Quezon City loop", truck: "Ref van 05", driver: "Jun Dela Cruz", setPointC: -20 },
  { id: "STH", name: "Makati, Pasig & south", truck: "Ref van 07", driver: "Arnel Reyes", setPointC: -20 },
];

export const RIDERS: Rider[] = [
  { id: "rd-1", name: "Jomar Bautista", phone: "0917 555 3021", bike: "Honda Click, NBC 4512", active: true },
  { id: "rd-2", name: "Ella Santos", phone: "0918 555 7740", bike: "Yamaha Mio, DAE 2219", active: true },
  { id: "rd-3", name: "Dodong Reyes", phone: "0927 555 1186", bike: "Honda TMX, ABK 903", active: false },
];

/** Small cash drops go by motorbike: Ella covers Manila, Jomar the rest. */
const riderFor = (c: Client) => (c.terms !== "COD" ? undefined : c.routeId === "MNL" ? RIDERS[1] : RIDERS[0]);

const CLIENTS: Client[] = [
  { id: "c-wahlee", name: "Wah Lee Dimsum House", type: "Restaurant", tier: "B", terms: "NET15", creditLimit: 150000, balance: 48250.5, pastDue: 0, address: "618 Ongpin St, Binondo", city: "Manila", contact: "Benson Uy", phone: "(02) 8244-3381", routeId: "MNL", window: "6–8 am", dockNote: "Back door on Salazar St. Walk-in freezer is past the steamers." },
  { id: "c-lucky", name: "Lucky Dragon Noodle House", type: "Restaurant", tier: "B", terms: "NET15", creditLimit: 120000, balance: 61200, pastDue: 18400, address: "1021 Masangkay St, Binondo", city: "Manila", contact: "Grace Tan", phone: "(02) 8244-9017", routeId: "MNL", window: "7–9 am", dockNote: "One-lane street, unload fast. Kitchen signs, not the cashier." },
  { id: "c-nena", name: "Aling Nena's Carinderia", type: "Carinderia", tier: "C", terms: "COD", creditLimit: 0, balance: 0, pastDue: 0, address: "2214 Dimasalang St, Sampaloc", city: "Manila", contact: "Aling Nena", phone: "0917 555 2291", routeId: "MNL", window: "6–7 am", dockNote: "Cash or GCash on delivery. Small chest freezer, six cases max." },
  { id: "c-kuyajun", name: "Kuya Jun's Fishball Carts", type: "Food cart franchise", tier: "C", terms: "COD", creditLimit: 0, balance: 0, pastDue: 0, address: "45 Hidalgo St, Quiapo", city: "Manila", contact: "Jun Mendoza", phone: "0918 555 6612", routeId: "MNL", window: "7–9 am", dockNote: "Commissary in the back for six carts. Collect before unloading." },
  { id: "c-dapitan", name: "Dapitan Food Hub canteen", type: "School canteen", tier: "A", terms: "NET30", creditLimit: 400000, balance: 186400, pastDue: 0, address: "Dapitan St cor. Lacson Ave, Sampaloc", city: "Manila", contact: "Canteen manager", phone: "(02) 8731-5500", routeId: "MNL", window: "8–10 am", dockNote: "Gate 3. Guard logs the plate number. Finish before first break at 9:30." },
  { id: "c-murallas", name: "Casa Murallas Hotel", type: "Hotel", tier: "A", terms: "NET30", creditLimit: 750000, balance: 318900, pastDue: 0, address: "Gen. Luna St, Intramuros", city: "Manila", contact: "Purchasing", phone: "(02) 8527-1000", routeId: "MNL", window: "9–11 am", dockNote: "Receiving dock B. Receiver probes every case, −18°C or colder." },
  { id: "c-titababy", name: "Tita Baby's Siopao & Siomai", type: "Food cart franchise", tier: "A", terms: "NET15", creditLimit: 500000, balance: 212300, pastDue: 0, address: "112 Kamuning Rd", city: "Quezon City", contact: "Commissary head", phone: "0917 555 8820", routeId: "QC", window: "6–8 am", dockNote: "Commissary for 14 kiosks, freezer on 2F. Use the service lift." },
  { id: "c-sampaguita", name: "Sampaguita Supermart, Commonwealth", type: "Supermarket", tier: "A", terms: "NET30", creditLimit: 900000, balance: 402500, pastDue: 0, address: "Commonwealth Ave, Brgy. Holy Spirit", city: "Quezon City", contact: "Receiving supervisor", phone: "(02) 8931-2240", routeId: "QC", window: "8–10 am", dockNote: "Back dock. QA checks ice cream hardness before accepting." },
  { id: "c-stisidore", name: "St. Isidore General Hospital", type: "Hospital", tier: "A", terms: "NET30", creditLimit: 600000, balance: 264800, pastDue: 52300, address: "88 E. Rodriguez Sr. Ave", city: "Quezon City", contact: "Dietary office", phone: "(02) 8723-0101", routeId: "QC", window: "9–11 am", dockNote: "Sign in at security. Dietary manager signs and probes temps." },
  { id: "c-maginhawa", name: "Maginhawa Silog Spot", type: "Restaurant", tier: "C", terms: "NET15", creditLimit: 60000, balance: 22400, pastDue: 0, address: "Maginhawa St, Teachers Village", city: "Quezon City", contact: "Paolo Ramos", phone: "0927 555 3108", routeId: "QC", window: "10 am–12 pm", dockNote: "Opens at 10. Do not leave product at the door." },
  { id: "c-kapitolyo", name: "Kapitolyo Kitchen Catering", type: "Caterer", tier: "B", terms: "NET15", creditLimit: 250000, balance: 104700, pastDue: 0, address: "15 East Capitol Dr, Kapitolyo", city: "Pasig", contact: "Chef Mika", phone: "0917 555 4402", routeId: "STH", window: "6–8 am", dockNote: "Loading bay off United St. Ring twice." },
  { id: "c-lorenzo", name: "Colegio de San Lorenzo canteen", type: "School canteen", tier: "A", terms: "NET30", creditLimit: 350000, balance: 141900, pastDue: 0, address: "Dr. A. Santos Ave, Sucat", city: "Parañaque", contact: "Canteen concessionaire", phone: "(02) 8825-6600", routeId: "STH", window: "7–9 am", dockNote: "Gate 2 only. Pallets must be shrink-wrapped." },
  { id: "c-rizalmart", name: "Rizal Mart Convenience", type: "Convenience store", tier: "B", terms: "NET30", creditLimit: 450000, balance: 198600, pastDue: 0, address: "Ortigas Ave Extension", city: "Pasig", contact: "Warehouse lead", phone: "(02) 8655-9012", routeId: "STH", window: "9–11 am", dockNote: "DC receiving for 8 branches. Bring two copies of the invoice." },
  { id: "c-poblacion", name: "Poblacion Night Market stalls", type: "Food cart franchise", tier: "C", terms: "COD", creditLimit: 0, balance: 0, pastDue: 0, address: "Kalayaan Ave, Poblacion", city: "Makati", contact: "Stall coordinator", phone: "0918 555 1170", routeId: "STH", window: "9–11 am", dockNote: "Cash or GCash. Ice cream goes to the stall 4 chest freezer." },
  { id: "c-tonyo", name: "Mang Tonyo's Sari-sari & Frozen", type: "Sari-sari store", tier: "C", terms: "COD", creditLimit: 0, balance: 0, pastDue: 0, address: "Real St, Brgy. Pamplona", city: "Las Piñas", contact: "Mang Tonyo", phone: "0928 555 7731", routeId: "STH", window: "10 am–12 pm", dockNote: "Narrow street. Park on Real St and hand-carry." },
];

const BUYS: Record<Client["type"], Category[]> = {
  Restaurant: ["Dimsum", "Streetfood", "Tocino & longganisa", "Pork", "Poultry", "Seafood", "Desserts", "Chiller"],
  Carinderia: ["Tocino & longganisa", "Pork", "Poultry", "Streetfood", "Seafood"],
  Supermarket: ["Dimsum", "Tocino & longganisa", "Desserts", "Streetfood", "Seafood", "Fries", "Chiller"],
  "Sari-sari store": ["Streetfood", "Tocino & longganisa", "Desserts", "Dimsum"],
  "Food cart franchise": ["Streetfood", "Dimsum", "Chiller", "Fries"],
  "School canteen": ["Dimsum", "Streetfood", "Poultry", "Fries", "Bakery", "Desserts"],
  Hospital: ["Poultry", "Seafood", "Tocino & longganisa", "Bakery", "Desserts"],
  Caterer: ["Dimsum", "Pork", "Seafood", "Desserts", "Bakery", "Chiller"],
  Hotel: ["Seafood", "Pork", "Bakery", "Desserts", "Dimsum", "Chiller", "Tocino & longganisa"],
  "Convenience store": ["Dimsum", "Streetfood", "Desserts", "Tocino & longganisa"],
};

const BIG: Client["type"][] = ["Supermarket", "School canteen", "Hospital", "Hotel", "Convenience store"];

const RECEIVERS = ["J. Santos", "Mae D.", "Rico Bautista", "Liza Tan", "M. Villanueva", "Joy Garcia", "R. Aquino", "Cherry L.", "Ben Co", "A. Mercado", "Nonoy R.", "K. Lim"];

const LOW = new Set(["DM-1020", "ST-2002", "BR-3020", "SE-6002", "BK-8002", "DE-7003"]);

function squiggle(r: () => number) {
  let x = 10;
  let y = 30 + r() * 10;
  let d = `M${x} ${y.toFixed(0)}`;
  const n = 6 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const nx = x + 16 + r() * 18;
    const ny = 18 + r() * 26;
    d += ` C${(x + 8).toFixed(0)} ${(y - 30 + r() * 60).toFixed(0)} ${(nx - 8).toFixed(0)} ${(ny - 30 + r() * 60).toFixed(0)} ${nx.toFixed(0)} ${ny.toFixed(0)}`;
    x = nx;
    y = ny;
  }
  return `svg:${d} M${(10 + r() * 30).toFixed(0)} 50 L${(x - 20).toFixed(0)} ${(46 + r() * 6).toFixed(0)}`;
}

/** Ref van log: pull-down, a small bump after each door opening, and an optional excursion. */
function reeferLog(
  r: () => number,
  start: number,
  end: number,
  setPoint: number,
  doors: number[],
  excursion?: { from: number; to: number; peak: number },
): TempReading[] {
  const out: TempReading[] = [];
  let f = setPoint + 7;
  for (let t = start; t <= end; t += 10 * MIN) {
    f += (setPoint + 1 - f) * 0.35 + (r() - 0.5) * 0.8;
    let v = f;
    for (const d of doors) {
      const since = t - d;
      if (since >= 0 && since < 25 * MIN) v += 3.5 * (1 - since / (25 * MIN));
    }
    if (excursion && t >= excursion.from && t <= excursion.to) {
      const span = excursion.to - excursion.from;
      const k = (t - excursion.from) / span;
      const shape = k < 0.4 ? k / 0.4 : 1 - (k - 0.4) / 0.6;
      v = v + (excursion.peak - v) * shape;
    }
    out.push({ at: t, c: round1(v) });
  }
  return out;
}

export interface Data {
  products: Product[];
  lots: Lot[];
  movements: Movement[];
  clients: Client[];
  orders: Order[];
  deliveries: Delivery[];
  routes: Route[];
  riders: Rider[];
  runs: Record<string, Run>;
  zones: Zone[];
  batches: Batch[];
  counters: { so: number; batch: number };
  seededAt: number;
}

export function buildSeed(now = Date.now()): Data {
  const r = rng(20261001);
  const int = (a: number, b: number) => a + Math.floor(r() * (b - a + 1));
  const pick = <T,>(arr: T[]) => arr[Math.floor(r() * arr.length)];
  const today = startOfDay(now);
  const todayKey = dateKey(now);
  const tomorrowKey = dateKey(today + DAY + 2 * HOUR);
  let mv = 0;
  const mvId = () => `mv-${++mv}`;

  const products: Product[] = RAW.map(([sku, name, category, pack, caseKg, catchWeight, zone, bin, cost, a, reorderPoint, par, shelfDays]) => ({
    sku,
    name,
    category,
    unit: TUBS.has(sku) ? "tub" : "case",
    pack,
    caseKg,
    catchWeight,
    zone,
    bin,
    cost,
    price: { A: a, B: Math.round(a * 1.05), C: Math.round(a * 1.1) },
    reorderPoint,
    par,
    shelfDays,
    active: true,
  }));

  // ---------- Lots ----------
  // Every lot is one production batch. `qty` is what is on hand now. `madeQty`, the batch record and
  // the PRODUCE movement are filled in at the end, once every shipment, return and write-off against
  // the lot is known, so each lot's ledger adds up to its on-hand.
  const lots: Lot[] = [];
  const movements: Movement[] = [];
  const overflow: Partial<Record<ZoneId, number>> = {};
  // Dated stock that needs selling first: days left on the oldest lot
  const expiring: Record<string, number> = { "CH-9002": 3, "CH-9001": 6, "CH-9003": 12, "BR-3001": 20 };
  // Fresh batches still hard-freezing in the blast freezer: hours since made, blast bin
  const blasting: Record<string, [number, string]> = { "DM-1001": [26, "B-01-02"], "ST-2001": [4, "B-01-01"] };
  let lotN = 0;
  for (const p of products) {
    const target = LOW.has(p.sku)
      ? int(Math.max(2, Math.ceil(p.reorderPoint * 0.5)), p.reorderPoint - 1)
      : int(Math.ceil(p.reorderPoint * 1.3), Math.ceil(p.par * 1.05));
    const n = target < 8 ? 1 : int(2, 3);
    let left = target;
    for (let i = 0; i < n; i++) {
      const first = i === 0;
      const last = i === n - 1;
      const qty = last ? left : Math.max(1, Math.round(left * (0.18 + r() * 0.2)));
      left -= qty;
      const age = Math.round((n - i) * p.shelfDays * 0.16 * (0.6 + r() * 0.5)) + int(1, 3);
      let madeAt = today - age * DAY + int(6, 13) * HOUR;
      let coreTempC = p.zone !== "COOL" ? round1(-22 + r() * 5) : round1(2 + r() * 2.5);
      let seq = int(1, 14);
      let bin: string | undefined;
      const lot: Partial<Lot> = { status: "AVAILABLE" };

      if (first && expiring[p.sku] !== undefined) madeAt = today + (expiring[p.sku] - p.shelfDays) * DAY + int(6, 13) * HOUR;
      if (last && n > 1 && blasting[p.sku]) {
        madeAt = now - blasting[p.sku][0] * HOUR;
        bin = blasting[p.sku][1];
        coreTempC = -16.5;
        seq = 7;
      }
      if (last && n > 1 && p.sku === "SE-6001") {
        // Came out of the blast freezer warm yesterday and is waiting on QA
        madeAt = today - DAY + 15 * HOUR;
        coreTempC = -9.5;
        lot.status = "HOLD";
        lot.holdReason = "Core temp −9.5°C at put-away, warmer than the −15°C limit. Re-probe after 12 hours in the freezer before release.";
      }
      // Blasted overnight two days ago, put away yesterday morning
      if (last && n > 1 && p.sku === "DM-1010") madeAt = today - 2 * DAY + 14 * HOUR;

      // The oldest lot sits in the home pick bin; newer lots go to overstock bins in the same zone.
      if (!bin && first) bin = p.bin;
      if (!bin) {
        const k = (overflow[p.zone] = (overflow[p.zone] ?? 0) + 1);
        bin = `${ZONES[p.zone].prefix}-OS-${String(k).padStart(2, "0")}`;
      }

      lots.push({
        ...lot,
        id: `lot-${++lotN}`,
        sku: p.sku,
        code: lotCode(madeAt, seq),
        madeAt,
        bestBy: startOfDay(madeAt + p.shelfDays * DAY),
        madeQty: 0,
        qty,
        bin,
        coreTempC,
      } as Lot);
    }
  }
  const lotsOf = (sku: string) => lots.filter((l) => l.sku === sku).sort((a, b) => a.madeAt - b.madeAt);

  // Batch numbers follow production order; new batches continue the sequence.
  [...lots].sort((a, b) => a.madeAt - b.madeAt).forEach((l, i) => (l.batch = `PB-${String(i + 1).padStart(4, "0")}`));

  const warm = lotsOf("SE-6001").at(-1)!;
  movements.push({ id: mvId(), at: warm.madeAt + 20 * MIN, sku: warm.sku, lotCode: warm.code, type: "HOLD", qty: 0, by: "QA", note: "Auto hold: warm at put-away" });

  const putAway = lotsOf("DM-1010").at(-1)!;
  movements.push(
    { id: mvId(), at: today - 3 * DAY + 15 * HOUR, sku: "FR-8501", lotCode: lotsOf("FR-8501")[0].code, type: "ADJUST", qty: -1, by: "Inventory", note: "Cycle count variance" },
    { id: mvId(), at: today - 2 * DAY + 10 * HOUR, sku: "DE-7001", lotCode: lotsOf("DE-7001")[0].code, type: "WASTE", qty: -2, by: "Inventory", note: "Tub lid cracked, freezer burn" },
    { id: mvId(), at: today - DAY + 9 * HOUR, sku: "DM-1010", lotCode: putAway.code, type: "TRANSFER", qty: 0, by: "Inventory", note: `B-01-03 to ${putAway.bin} after blast` },
  );

  /** Lot a past shipment came from: earliest best-by among lots already made, sellable and out of the blast freezer. */
  const shipLot = (sku: string, at: number) =>
    lots
      .filter((l) => l.sku === sku && l.status === "AVAILABLE" && l.madeAt < at && l.bestBy > at && zoneOfBin(l.bin) !== "BLAST")
      .sort((a, b) => a.bestBy - b.bestBy)[0];

  // ---------- Orders and deliveries ----------
  const clients = CLIENTS.map((c) => ({ ...c }));
  const clientById = new Map(clients.map((c) => [c.id, c]));
  const orders: Order[] = [];
  const deliveries: Delivery[] = [];
  const runs: Record<string, Run> = {};
  const reserved: Record<string, number> = {};
  let so = 24010;

  /**
   * reserve: allocate FEFO from what is free now (order not picked yet).
   * Otherwise the cases already left: take them from the lot that was sellable when the order was placed.
   */
  function draftLines(c: Client, reserve: boolean, at: number) {
    const pool = products.filter((p) => BUYS[c.type].includes(p.category));
    const n = int(3, 6);
    const big = BIG.includes(c.type);
    const tried = new Set<string>();
    const out: { sku: string; qty: number; allocs: Alloc[] }[] = [];
    while (out.length < n && tried.size < pool.length) {
      const p = pick(pool);
      if (tried.has(p.sku)) continue;
      tried.add(p.sku);
      let qty = p.catchWeight ? int(1, 2) : big ? (reserve ? int(2, 5) : int(3, 10)) : reserve ? int(1, 3) : int(1, 5);
      if (!reserve) {
        const l = shipLot(p.sku, at);
        if (l) out.push({ sku: p.sku, qty, allocs: [{ lotId: l.id, lotCode: l.code, qty }] });
        continue;
      }
      let allocs: Alloc[] | null = null;
      while (qty > 0 && !(allocs = allocateFEFO(lots, p.sku, qty, reserved, now))) qty--;
      if (!allocs || qty === 0) continue;
      for (const a of allocs) reserved[a.lotId] = (reserved[a.lotId] ?? 0) + a.qty;
      out.push({ sku: p.sku, qty, allocs });
    }
    return out;
  }

  function makeOrder(c: Client, createdAt: number, fulfillment: Order["fulfillment"], reserve: boolean, by = "Counter 1"): Order {
    const drafted = draftLines(c, reserve, createdAt);
    const priced = priceLines(products, c, drafted);
    const lines: OrderLine[] = priced.map((l, i) => ({ ...l, allocs: drafted[i].allocs }));
    const subtotal = round2(lines.reduce((s, l) => s + l.lineTotal, 0));
    const t = orderTotals(subtotal, fulfillment);
    const payMethod = c.terms === "COD" ? (fulfillment === "PICKUP" ? "CASH" : "COD") : "ACCOUNT";
    const o: Order = {
      id: `o-${++so}`,
      number: `SO-${so}`,
      clientId: c.id,
      createdAt,
      by,
      lines,
      subtotal,
      ...t,
      payMethod,
      paid: payMethod === "CASH",
      fulfillment,
      status: "OPEN",
      clientPo: BIG.includes(c.type) ? `${c.name.slice(0, 3).toUpperCase()}-${int(1000, 9999)}` : undefined,
    };
    orders.push(o);
    return o;
  }

  function ensureRun(routeId: string, date: string, plannedDepart: number) {
    const k = runKey(routeId, date);
    runs[k] ??= { routeId, date, plannedDepart, temps: [] };
    return runs[k];
  }

  function makeDelivery(o: Order, date: string, seq: number, status: DeliveryStatus, events: DeliveryEvent[], extra: Partial<Delivery> = {}) {
    const c = clientById.get(o.clientId)!;
    const d: Delivery = { id: `d-${o.id.slice(2)}`, orderId: o.id, clientId: c.id, routeId: c.routeId, date, seq, status, events, ...extra };
    o.deliveryId = d.id;
    deliveries.push(d);
    return d;
  }

  function shipMoves(o: Order, at: number) {
    for (const l of o.lines)
      for (const a of l.allocs) movements.push({ id: mvId(), at, sku: l.sku, lotCode: a.lotCode, type: "SHIP", qty: -a.qty, ref: o.number, by: "Dock" });
  }

  function pod(c: Client, at: number, total: number, payMethod: Order["payMethod"]): Pod {
    return {
      at,
      receivedBy: pick(RECEIVERS),
      signature: squiggle(r),
      productTempC: round1(-21 + r() * 4),
      shorts: [],
      collected: payMethod === "COD" ? total : undefined,
      notes: /probe/i.test(c.dockNote) ? "Receiver probed two cases, both colder than −18°C." : undefined,
    };
  }

  // History: orders placed 13..2 days ago, delivered the next day.
  for (let back = 13; back >= 2; back--) {
    const placed = today - back * DAY;
    const deliverDay = placed + DAY;
    if (new Date(deliverDay).getDay() === 0) continue; // no Sunday routes
    const dk = dateKey(deliverDay + 2 * HOUR);
    const nOrders = int(5, 9);
    const used = new Set<string>();
    const routeStops: Record<string, number> = {};
    for (let i = 0; i < nOrders; i++) {
      const c = pick(clients);
      if (used.has(c.id)) continue;
      used.add(c.id);
      const o = makeOrder(c, placed + int(8, 16) * HOUR + int(0, 59) * MIN, "DELIVERY", false);
      const rider = riderFor(c);
      const lane = rider?.id ?? c.routeId;
      const seq = (routeStops[lane] = (routeStops[lane] ?? 0) + 1);
      const depart = deliverDay + 5.5 * HOUR + int(0, 40) * MIN;
      const at = depart + seq * 38 * MIN + int(0, 20) * MIN;
      o.status = "FULFILLED";
      o.paid = o.payMethod === "COD" || r() < 0.55;
      const evs: DeliveryEvent[] = [
        { status: "SCHEDULED", at: o.createdAt, by: o.by },
        { status: "PICKING", at: deliverDay + 2 * HOUR, by: "Night pick" },
        { status: "LOADED", at: depart - 30 * MIN, by: "Dock" },
        { status: "EN_ROUTE", at: depart, by: "Dispatch" },
        { status: "ARRIVED", at: at - 12 * MIN, by: rider?.name ?? "Driver" },
        { status: "DELIVERED", at, by: rider?.name ?? "Driver" },
      ];
      makeDelivery(o, dk, seq, "DELIVERED", evs, { pod: pod(c, at, o.total, o.payMethod), riderId: rider?.id });
      shipMoves(o, depart - 30 * MIN);
      if (rider) continue;
      const run = ensureRun(c.routeId, dk, depart);
      run.departedAt = depart;
    }
    for (const rt of ROUTES) {
      const run = runs[runKey(rt.id, dk)];
      if (!run || !run.departedAt) continue;
      const stops = deliveries.filter((d) => d.date === dk && d.routeId === rt.id && !d.riderId);
      const lastAt = Math.max(...stops.map((d) => d.pod!.at));
      run.returnedAt = lastAt + 50 * MIN;
      run.temps = reeferLog(r, run.departedAt - 40 * MIN, run.returnedAt, rt.setPointC, stops.map((d) => d.pod!.at - 12 * MIN));
    }
  }

  // Today: orders placed yesterday, on the trucks now.
  type Plan = { client: string; status: DeliveryStatus; at?: number; eta?: number; rider?: Rider };
  const yesterday = today - DAY;
  const plans: Record<string, { depart: number; departed: boolean; stops: Plan[] }> = {
    MNL: {
      depart: now - 3 * HOUR - 20 * MIN,
      departed: true,
      stops: [
        { client: "c-nena", status: "DELIVERED", at: now - 160 * MIN },
        { client: "c-wahlee", status: "DELIVERED", at: now - 125 * MIN },
        { client: "c-lucky", status: "DELIVERED", at: now - 90 * MIN },
        { client: "c-kuyajun", status: "DELIVERED", at: now - 50 * MIN, rider: RIDERS[1] },
        { client: "c-dapitan", status: "ARRIVED", at: now - 8 * MIN },
        { client: "c-murallas", status: "EN_ROUTE", eta: now + 40 * MIN },
      ],
    },
    QC: {
      depart: now - 150 * MIN,
      departed: true,
      stops: [
        { client: "c-titababy", status: "DELIVERED", at: now - 110 * MIN },
        { client: "c-sampaguita", status: "EXCEPTION", at: now - 70 * MIN },
        { client: "c-stisidore", status: "EN_ROUTE", eta: now + 15 * MIN },
        { client: "c-maginhawa", status: "EN_ROUTE", eta: now + 55 * MIN },
      ],
    },
    STH: {
      depart: now + 25 * MIN,
      departed: false,
      stops: [
        { client: "c-kapitolyo", status: "LOADED" },
        { client: "c-lorenzo", status: "LOADED" },
        { client: "c-rizalmart", status: "PICKING" },
        { client: "c-poblacion", status: "SCHEDULED", rider: RIDERS[0] },
      ],
    },
  };

  for (const rt of ROUTES) {
    const plan = plans[rt.id];
    const run = ensureRun(rt.id, todayKey, plan.depart);
    if (plan.departed) run.departedAt = plan.depart;
    const doors: number[] = [];
    const lanes: Record<string, number> = {};
    plan.stops.forEach((s) => {
      const c = clientById.get(s.client)!;
      const by = s.rider?.name ?? rt.driver;
      const lane = s.rider?.id ?? rt.id;
      const seq = (lanes[lane] = (lanes[lane] ?? 0) + 1);
      const reserving = s.status === "SCHEDULED" || s.status === "PICKING";
      const o = makeOrder(c, yesterday + int(9, 17) * HOUR + int(0, 59) * MIN, "DELIVERY", reserving);
      const evs: DeliveryEvent[] = [{ status: "SCHEDULED", at: o.createdAt, by: o.by }];
      const loadedAt = plan.departed ? plan.depart - 25 * MIN : now - 20 * MIN;
      if (s.status !== "SCHEDULED") evs.push({ status: "PICKING", at: loadedAt - (reserving ? 0 : 50 * MIN) - (s.status === "PICKING" ? 15 * MIN : 0), by: "Night pick" });
      if (!reserving) {
        evs.push({ status: "LOADED", at: loadedAt, by: "Dock" });
        shipMoves(o, loadedAt);
      }
      if (plan.departed) evs.push({ status: "EN_ROUTE", at: s.rider && s.at ? s.at - 40 * MIN : plan.depart, by: "Dispatch" });
      const extra: Partial<Delivery> = {};
      if (s.at) {
        evs.push({ status: "ARRIVED", at: s.status === "ARRIVED" ? s.at : s.at - 12 * MIN, by });
        if (!s.rider) doors.push(s.status === "ARRIVED" ? s.at : s.at - 12 * MIN);
      }
      if (s.status === "DELIVERED") {
        evs.push({ status: "DELIVERED", at: s.at!, by });
        extra.pod = pod(c, s.at!, o.total, o.payMethod);
        o.status = "FULFILLED";
        if (o.payMethod === "COD") o.paid = true;
      }
      if (s.status === "EXCEPTION") {
        const ic = o.lines.find((l) => l.sku.startsWith("DE-")) ?? o.lines.find((l) => l.sku.startsWith("DM-")) ?? o.lines[0];
        const refused = Math.min(ic.qty, 4);
        evs.push({ status: "EXCEPTION", at: s.at!, by: rt.driver, note: "Partial refusal" });
        extra.exception = {
          at: s.at!,
          reason: "Temperature excursion",
          note: `Box warmed past −15°C after the rear door stayed open at the prior stop. Receiver refused ${refused} cs ${ic.name.toLowerCase()} as soft; rest accepted. Refused cases returning to dock for QA.`,
        };
        extra.pod = { ...pod(c, s.at!, o.total, o.payMethod), productTempC: -9.2, shorts: [{ sku: ic.sku, qty: refused, reason: "Refused, soft on arrival" }] };
        movements.push({ id: mvId(), at: s.at!, sku: ic.sku, lotCode: ic.allocs[0].lotCode, type: "RETURN", qty: refused, ref: o.number, by: rt.driver, note: "Refused, soft on arrival" });
      }
      if (s.eta) extra.eta = s.eta;
      if (s.rider) extra.riderId = s.rider.id;
      makeDelivery(o, todayKey, seq, s.status, evs, extra);
    });
    const start = plan.departed ? plan.depart - 40 * MIN : now - 70 * MIN;
    const excursion = rt.id === "QC" ? { from: now - 125 * MIN, to: now - 78 * MIN, peak: -6 } : undefined;
    run.temps = reeferLog(r, start, now, rt.setPointC, doors, excursion);
  }

  // Walk-in will-call orders this morning
  for (const [cid, h] of [["c-tonyo", 1.6], ["c-kuyajun", 0.7]] as const) {
    const c = clientById.get(cid)!;
    const at = Math.min(now - 5 * MIN, Math.max(today + 7 * HOUR, now - h * HOUR));
    const o = makeOrder(c, at, "PICKUP", false);
    o.payMethod = cid === "c-tonyo" ? "CASH" : "GCASH";
    o.paid = true;
    o.status = "FULFILLED";
    for (const l of o.lines)
      for (const a of l.allocs) movements.push({ id: mvId(), at, sku: l.sku, lotCode: a.lotCode, type: "PICKUP", qty: -a.qty, ref: o.number, by: "Counter 1" });
  }

  // Orders taken today for tomorrow's trucks
  const tomorrowStart = startOfDay(today + DAY + 2 * HOUR);
  ["c-wahlee", "c-lucky", "c-sampaguita", "c-maginhawa", "c-lorenzo"].forEach((cid, i) => {
    const c = clientById.get(cid)!;
    const o = makeOrder(c, Math.min(now - (5 - i) * 6 * MIN, Math.max(today + 6 * HOUR, now - (5 - i) * 35 * MIN)), "DELIVERY", true);
    const seq = deliveries.filter((d) => d.date === tomorrowKey && d.routeId === c.routeId).length + 1;
    makeDelivery(o, tomorrowKey, seq, "SCHEDULED", [{ status: "SCHEDULED", at: o.createdAt, by: o.by }]);
    ensureRun(c.routeId, tomorrowKey, tomorrowStart + 5.5 * HOUR);
  });

  // ---------- Freezers ----------
  const zones: Zone[] = (["BLAST", "DEEP", "FRZ", "COOL"] as ZoneId[]).map((id) => {
    const z = ZONES[id];
    const readings: number[] = [];
    for (let i = 0; i < 48; i++) {
      const defrost = id === "FRZ" && i >= 30 && i <= 33 ? [1.2, 2.4, 1.6, 0.6][i - 30] : 0;
      readings.push(round1(z.setPointC + (r() - 0.5) * 1.2 + defrost));
    }
    const cap = { BLAST: [12, 9], DEEP: [120, 88], FRZ: [260, 214], COOL: [60, 31] }[id];
    return { id, name: z.name, setPointC: z.setPointC, maxC: z.maxC, capacity: cap[0], used: cap[1], readings };
  });

  // ---------- Production ----------
  // Made = on hand now + everything that left since (shipments, pickups, write-offs) − returns.
  const net = new Map<string, number>();
  for (const m of movements) if (m.lotCode) net.set(`${m.sku}|${m.lotCode}`, (net.get(`${m.sku}|${m.lotCode}`) ?? 0) + m.qty);
  const batches: Batch[] = [];
  for (const l of lots) {
    l.madeQty = l.qty - (net.get(`${l.sku}|${l.code}`) ?? 0);
    batches.push({ id: `pb-${Number(l.batch.slice(3))}`, number: l.batch, sku: l.sku, qty: l.madeQty, madeAt: l.madeAt, by: "Production line", lotId: l.id });
    const note = zoneOfBin(l.bin) === "BLAST" ? `Into blast freezer ${l.bin}` : undefined;
    movements.push({ id: mvId(), at: l.madeAt, sku: l.sku, lotCode: l.code, type: "PRODUCE", qty: l.madeQty, ref: l.batch, by: "Production line", note });
  }
  batches.sort((a, b) => b.madeAt - a.madeAt);

  movements.sort((a, b) => b.at - a.at);
  return {
    products,
    lots,
    movements,
    clients,
    orders,
    deliveries,
    routes: ROUTES,
    riders: RIDERS,
    runs,
    zones,
    batches,
    counters: { so, batch: lots.length },
    seededAt: now,
  };
}
