export const MIN = 60_000;
export const HOUR = 3_600_000;
export const DAY = 86_400_000;

const php = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" });
const php0 = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 });
const int = new Intl.NumberFormat("en-PH");

export const money = (n: number) => php.format(n);
export const money0 = (n: number) => php0.format(n);
/** Compact peso for chart axes and small totals: ₱12.5k, ₱1.71M */
export const pesoK = (n: number) => (n >= 1_000_000 ? `₱${+(n / 1_000_000).toFixed(2)}M` : n >= 1000 ? `₱${+(n / 1000).toFixed(1)}k` : money0(n));
export const count = (n: number) => int.format(n);

/** Typographic minus so negative temperatures line up and read correctly. */
export const temp = (c: number, digits = 1) => `${c < 0 ? "−" : ""}${Math.abs(c).toFixed(digits)}°C`;
export const tempBare = (c: number, digits = 1) => `${c < 0 ? "−" : ""}${Math.abs(c).toFixed(digits)}°`;

export const clock = (ts: number) =>
  new Date(ts).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

export const day = (ts: number) =>
  new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });

export const dayLong = (ts: number) =>
  new Date(ts).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

export const dayShort = (ts: number) =>
  new Date(ts).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

export const dateTime = (ts: number) => `${day(ts)}, ${clock(ts)}`;

export function dateKey(ts: number) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function keyToTs(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).getTime();
}

export function startOfDay(ts: number) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export const daysUntil = (ts: number, now = Date.now()) => Math.floor((ts - now) / DAY);

export function ago(ts: number, now = Date.now()) {
  const m = Math.round((now - ts) / MIN);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ${m % 60} min ago`;
  return `${Math.floor(h / 24)} d ago`;
}

export function inMinutes(ts: number, now = Date.now()) {
  const m = Math.round((ts - now) / MIN);
  if (m <= 0) return "due now";
  if (m < 60) return `in ${m} min`;
  return `in ${Math.floor(m / 60)} h ${m % 60} min`;
}

/** Julian-date lot code, the way most frozen packers print it: YYDDD-NN */
export function lotCode(ts: number, n: number) {
  const d = new Date(ts);
  const start = new Date(d.getFullYear(), 0, 0).getTime();
  const doy = Math.floor((ts - start) / DAY);
  return `${String(d.getFullYear()).slice(2)}${String(doy).padStart(3, "0")}-${String(n).padStart(2, "0")}`;
}

/** BIR-style sales invoice serial: SI 001234 */
export const invoiceNumber = (n: number) => `SI ${String(n).padStart(6, "0")}`;

export const uid = () => Math.random().toString(36).slice(2, 10);

export const plural = (n: number, one: string, many = `${one}s`) => `${count(n)} ${n === 1 ? one : many}`;

export const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Plural of an owner-typed selling unit: case → cases, box → boxes. */
export const unitPlural = (u: string) => (/(s|x|z|ch|sh)$/i.test(u) ? `${u}es` : `${u}s`);

/** A quantity in its selling unit: "1 case", "12 tubs". */
export const units = (n: number, unit: string) => plural(n, unit, unitPlural(unit));
