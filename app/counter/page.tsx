"use client";

import { AlertTriangle, History, Minus, Plus, Printer, Search, Send, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Invoice } from "@/components/Invoice";
import { SendReceipt } from "@/components/SendReceipt";
import { Badge, Field, Kbd, Modal, PageHead, cx } from "@/components/ui";
import { DAY, dateKey, dayShort, keyToTs, money, money0, startOfDay, unitPlural, units } from "@/lib/format";
import { useMaps, useStock } from "@/lib/hooks";
import { DROP_MIN, PAY_LABEL, TERMS_LABEL, ZONES, allocateFEFO, casePrice, orderTotals, priceLines, priceUnit } from "@/lib/logic";
import { useStore, useUi } from "@/lib/store";
import type { Category, Order, PayMethod } from "@/lib/types";

const CATS: (Category | "All")[] = ["All", "Dimsum", "Streetfood", "Tocino & longganisa", "Pork", "Poultry", "Seafood", "Desserts", "Bakery", "Fries", "Chiller"];

function deliveryDays(now: number) {
  const out: string[] = [];
  let t = startOfDay(now) + DAY + 2 * 3_600_000;
  while (out.length < 6) {
    if (new Date(t).getDay() !== 0) out.push(dateKey(t));
    t += DAY;
  }
  return out;
}

export default function Counter() {
  const allProducts = useStore((s) => s.products);
  const products = useMemo(() => allProducts.filter((p) => p.active), [allProducts]);
  const clients = useStore((s) => s.clients);
  const orders = useStore((s) => s.orders);
  const deliveries = useStore((s) => s.deliveries);
  const lots = useStore((s) => s.lots);
  const placeOrder = useStore((s) => s.placeOrder);
  const toast = useUi((s) => s.toast);
  const maps = useMaps();
  const { rows, reserved } = useStock();

  // A client handed over from the Clients page arrives through the UI store.
  const [clientId, setClientId] = useState<string>(() => useUi.getState().counterClientId ?? "");
  const [cart, setCart] = useState<{ sku: string; qty: number }[]>([]);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<Category | "All">("All");
  const [fulfillment, setFulfillment] = useState<"DELIVERY" | "PICKUP">("DELIVERY");
  const [days] = useState(() => deliveryDays(Date.now()));
  const [date, setDate] = useState(days[0]);
  const [payChoice, setPayChoice] = useState<PayMethod | null>(null);
  const [clientPo, setClientPo] = useState("");
  const [notes, setNotes] = useState("");
  const [override, setOverride] = useState(false);
  const [extras, setExtras] = useState(false);
  const [done, setDone] = useState<Order | null>(null);
  const [sending, setSending] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const client = clients.find((c) => c.id === clientId);
  const tier = client?.tier ?? "C";

  useEffect(() => {
    useUi.getState().setCounterClient(undefined);
  }, []);

  // First option is the sensible default for the account's terms.
  const payOptions: PayMethod[] =
    client?.terms === "COD"
      ? fulfillment === "DELIVERY"
        ? ["COD", "GCASH", "CARD", "CHECK"]
        : ["CASH", "GCASH", "CARD", "CHECK"]
      : fulfillment === "DELIVERY"
        ? ["ACCOUNT", "GCASH", "CARD", "CHECK"]
        : ["ACCOUNT", "CASH", "GCASH", "CARD", "CHECK"];
  const pay = payChoice && payOptions.includes(payChoice) ? payChoice : payOptions[0];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      if (e.key === "/" && !(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement)) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase().replace(/\s+\d+$/, "");
    return products.filter(
      (p) =>
        (cat === "All" || p.category === cat) &&
        (!term || p.sku.toLowerCase().includes(term) || p.name.toLowerCase().includes(term)),
    );
  }, [products, q, cat]);

  const inCart = new Map(cart.map((l) => [l.sku, l.qty]));
  const priced = client ? priceLines(products, client, cart) : [];
  const subtotal = priced.reduce((s, l) => s + l.lineTotal, 0);
  const totals = orderTotals(subtotal, fulfillment);

  const shortLines = cart.filter((l) => l.qty > (rows.get(l.sku)?.available ?? 0));
  const creditAfter = client ? client.balance + (pay === "ACCOUNT" ? totals.total : 0) : 0;
  const creditProblem =
    client && pay === "ACCOUNT" && client.terms !== "COD"
      ? client.pastDue > 0
        ? `${money(client.pastDue)} past due on this account.`
        : creditAfter > client.creditLimit
          ? `This order takes the account to ${money0(creditAfter)}, over the ${money0(client.creditLimit)} limit.`
          : null
      : null;
  const canPlace = !!client && cart.length > 0 && shortLines.length === 0 && (!creditProblem || override);

  const lastOrder = client
    ? orders.filter((o) => o.clientId === client.id && o.status !== "CANCELLED").sort((a, b) => b.createdAt - a.createdAt)[0]
    : undefined;

  function add(sku: string, n = 1) {
    setCart((c) => {
      const has = c.find((l) => l.sku === sku);
      if (has) return c.map((l) => (l.sku === sku ? { ...l, qty: Math.max(0, l.qty + n) } : l)).filter((l) => l.qty > 0);
      return n > 0 ? [...c, { sku, qty: n }] : c;
    });
  }
  function setQty(sku: string, n: number) {
    setCart((c) => (n <= 0 ? c.filter((l) => l.sku !== sku) : c.map((l) => (l.sku === sku ? { ...l, qty: n } : l))));
  }

  function onSearchKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    const m = q.trim().match(/^(.*?)(?:\s*[x×*]?\s*(\d+))?$/i);
    const n = m?.[2] ? parseInt(m[2], 10) : 1;
    const exact = products.find((p) => p.sku.toLowerCase() === (m?.[1] ?? "").trim().toLowerCase());
    const target = exact ?? filtered[0];
    if (target) {
      add(target.sku, n);
      setQ("");
    }
  }

  function submit() {
    if (!client) return;
    const res = placeOrder({ clientId: client.id, lines: cart, fulfillment, date, payMethod: pay, clientPo, notes, by: "Counter 1" });
    if (!res.ok) {
      toast(res.error, "warn");
      return;
    }
    setDone(res.order);
    toast(`${res.order.number} placed for ${client.name}`);
  }

  function reset() {
    setDone(null);
    setCart([]);
    setClientPo("");
    setNotes("");
    setOverride(false);
    setExtras(false);
  }

  return (
    <div className="mx-auto max-w-[1500px]">
      <PageHead title="Counter" sub="Phone, fax and walk-in orders. Stock is reserved first-expired, first-out when you place the order." />

      <div className="grid items-start gap-5 xl:grid-cols-[1fr_440px]">
        {/* ---------- Catalog ---------- */}
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <div className="relative min-w-[260px] flex-1">
              <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-3" />
              <input
                ref={searchRef}
                className="input h-11 pl-9 text-[15px]"
                placeholder="Search name or SKU. Type “DM-1001 4” and Enter to add 4."
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={onSearchKey}
                aria-label="Search products"
              />
              <span className="absolute top-1/2 right-3 -translate-y-1/2">
                <Kbd>/</Kbd>
              </span>
            </div>
          </div>
          <div className="mb-4 flex gap-1.5 overflow-x-auto pb-1 scroll-thin">
            {CATS.map((c) => (
              <button
                key={c}
                onClick={() => setCat(c)}
                className={cx(
                  "h-8 shrink-0 cursor-pointer rounded-full border px-3 text-[13.5px] font-semibold",
                  cat === c ? "border-ink bg-ink text-white" : "border-line bg-panel text-ink-2 hover:border-line-2",
                )}
              >
                {c}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-[repeat(auto-fill,minmax(212px,1fr))] gap-2.5">
            {filtered.map((p) => {
              const row = rows.get(p.sku);
              const avail = row?.available ?? 0;
              const qty = inCart.get(p.sku) ?? 0;
              const out = avail <= 0;
              return (
                <button
                  key={p.sku}
                  onClick={() => !out && add(p.sku)}
                  disabled={out}
                  className={cx(
                    "group relative flex min-h-[136px] cursor-pointer flex-col rounded-[4px] border bg-white text-left transition-[border-color,box-shadow] disabled:cursor-not-allowed",
                    qty ? "border-ink shadow-[0_0_0_1px_var(--color-ink)]" : "border-line hover:border-ink-3",
                    out && "opacity-55",
                  )}
                  aria-label={`Add ${p.name}`}
                >
                  <div className="flex items-center justify-between gap-2 border-b border-dashed border-line px-2.5 py-1.5">
                    <span className="code font-medium text-ink-2">{p.sku}</span>
                    <span className="flex items-center gap-1 text-[12px] text-ink-3">
                      <span className="h-2 w-2 rounded-[1px]" style={{ background: ZONES[p.zone].color }} />
                      {ZONES[p.zone].name}
                    </span>
                  </div>
                  <div className="flex-1 px-2.5 pt-1.5">
                    <div className="text-[14.5px] leading-snug font-semibold">{p.name}</div>
                    <div className="text-[13px] text-ink-3">
                      Per {p.unit}, {p.pack}
                      {p.catchWeight && ", catch weight"}
                    </div>
                  </div>
                  <div className="flex items-end justify-between px-2.5 pt-1 pb-2">
                    <div className="display text-[20px] leading-none font-semibold">
                      {money(p.price[tier])}
                      <span className="ml-0.5 text-[13px] font-medium text-ink-3">/{priceUnit(p)}</span>
                    </div>
                    <div className={cx("text-[12.5px] font-semibold", out ? "text-bad" : avail < p.reorderPoint ? "text-warn" : "text-ink-3")}>
                      {out ? "Out of stock" : `${units(avail, p.unit)} free`}
                    </div>
                  </div>
                  {qty > 0 && (
                    <span className="absolute -top-2 -right-2 grid h-6 min-w-6 place-items-center rounded-full bg-brand px-1.5 text-[12.5px] font-bold text-white">{qty}</span>
                  )}
                </button>
              );
            })}
          </div>
          {filtered.length === 0 && <p className="py-10 text-center text-[14px] text-ink-3">No products match “{q}”. Clear the search or pick another category.</p>}
          {!client && <p className="mt-4 text-[13px] text-ink-3">Prices shown at list (tier C). Pick a client to see their tier.</p>}
        </div>

        {/* ---------- Ticket ---------- */}
        <aside className="sticky top-[72px] flex max-h-[calc(100vh-170px)] min-h-[560px] flex-col overflow-hidden rounded-[10px] border border-line bg-panel">
          <div className="border-b border-line p-4">
            <Field label="Client">
              <select className="input h-10 text-[15px]" value={clientId} onChange={(e) => {
                  setClientId(e.target.value);
                  setPayChoice(null);
                  setOverride(false);
                }}
              >
                <option value="">Choose an account…</option>
                {[...new Set(clients.map((c) => c.routeId))].map((rid) => (
                  <optgroup key={rid} label={maps.route.get(rid)?.name}>
                    {clients
                      .filter((c) => c.routeId === rid)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </select>
            </Field>
            {client && (
              <div className="mt-3 text-[13px]">
                <div className="flex flex-wrap gap-1.5">
                  <Badge>Tier {client.tier}</Badge>
                  <Badge tone={client.terms === "COD" ? "warn" : "neutral"}>{TERMS_LABEL[client.terms]}</Badge>
                  <Badge>{maps.route.get(client.routeId)?.name}</Badge>
                  <Badge>{client.window}</Badge>
                </div>
                {client.creditLimit > 0 && (
                  <div className="mt-2.5">
                    <div className="flex justify-between text-ink-3">
                      <span>Balance {money0(client.balance)}</span>
                      <span>Limit {money0(client.creditLimit)}</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-sunk">
                      <div
                        className={cx("h-full rounded-full", creditAfter > client.creditLimit ? "bg-bad" : client.balance / client.creditLimit > 0.8 ? "bg-warn" : "bg-ink-2")}
                        style={{ width: `${Math.min(100, (creditAfter / client.creditLimit) * 100)}%` }}
                      />
                    </div>
                  </div>
                )}
                {lastOrder && (
                  <button
                    className="btn btn-quiet btn-sm mt-2 -ml-2.5"
                    onClick={() => {
                      setCart(lastOrder.lines.map((l) => ({ sku: l.sku, qty: l.qty })));
                      toast(`Loaded ${lastOrder.lines.length} lines from ${lastOrder.number}`);
                    }}
                  >
                    <History size={14} /> Repeat last order ({lastOrder.number}, {money0(lastOrder.total)})
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="min-h-[120px] flex-1 overflow-y-auto scroll-thin">
            {cart.length === 0 ? (
              <p className="px-4 py-8 text-center text-[14px] text-ink-3">
                Tap a product or type a SKU to start the ticket.
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {cart.map((l) => {
                  const p = maps.product.get(l.sku)!;
                  const pl = priced.find((x) => x.sku === l.sku);
                  const avail = rows.get(l.sku)?.available ?? 0;
                  const allocs = allocateFEFO(lots, l.sku, Math.min(l.qty, avail), reserved) ?? [];
                  const short = l.qty > avail;
                  return (
                    <li key={l.sku} className="px-4 py-2.5">
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="text-[14px] leading-snug font-semibold">{p.name}</div>
                          <div className="text-[12.5px] text-ink-3">
                            <span className="code">{p.sku}</span> {units(l.qty, p.unit)}, {p.pack}
                            {p.catchWeight && `, about ${p.caseKg * l.qty} kg`}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[14px] font-semibold">{money(pl?.lineTotal ?? casePrice(p, tier) * l.qty)}</div>
                          <div className="text-[12px] text-ink-3">
                            {money(p.price[tier])}/{priceUnit(p)}
                          </div>
                        </div>
                      </div>
                      <div className="mt-1.5 flex items-center justify-between gap-2">
                        <div className="flex items-center rounded-md border border-line bg-white">
                          <button className="grid h-8 w-8 cursor-pointer place-items-center text-ink-2 hover:bg-sunk" onClick={() => add(l.sku, -1)} aria-label={`One less ${p.unit}`}>
                            <Minus size={14} />
                          </button>
                          <input
                            className="h-8 w-12 border-x border-line text-center text-[14px] font-semibold focus:outline-none"
                            value={l.qty}
                            inputMode="numeric"
                            onChange={(e) => setQty(l.sku, parseInt(e.target.value.replace(/\D/g, "") || "0", 10))}
                            aria-label={`Number of ${unitPlural(p.unit)}`}
                          />
                          <button className="grid h-8 w-8 cursor-pointer place-items-center text-ink-2 hover:bg-sunk" onClick={() => add(l.sku, 1)} aria-label={`One more ${p.unit}`}>
                            <Plus size={14} />
                          </button>
                        </div>
                        <div className="code min-w-0 flex-1 truncate text-right text-[11.5px] text-ink-3" title="Lots this line will pull, oldest best-by first">
                          {short ? <span className="font-sans text-[12.5px] font-semibold text-bad">Only {units(avail, p.unit)} free</span> : allocs.map((a) => `${a.lotCode}×${a.qty}`).join("  ")}
                        </div>
                        <button className="btn btn-quiet btn-sm px-1.5" onClick={() => setQty(l.sku, 0)} aria-label={`Remove ${p.name}`}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="space-y-3 border-t border-line bg-sunk/60 p-4">
            <div className="grid grid-cols-2 gap-1 rounded-md border border-line bg-white p-0.5" role="radiogroup" aria-label="Fulfillment">
              {(["DELIVERY", "PICKUP"] as const).map((f) => (
                <button
                  key={f}
                  role="radio"
                  aria-checked={fulfillment === f}
                  onClick={() => setFulfillment(f)}
                  className={cx("h-8 cursor-pointer rounded text-[13.5px] font-semibold", fulfillment === f ? "bg-ink text-white" : "text-ink-2 hover:bg-sunk")}
                >
                  {f === "DELIVERY" ? "Truck delivery" : "Will-call at dock"}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {fulfillment === "DELIVERY" ? (
                <Field label="Delivery day">
                  <select className="input" value={date} onChange={(e) => setDate(e.target.value)}>
                    {days.map((d) => (
                      <option key={d} value={d}>
                        {dayShort(keyToTs(d))}
                      </option>
                    ))}
                  </select>
                </Field>
              ) : (
                <div className="text-[12.5px] text-ink-3">Stock leaves inventory when you complete the sale.</div>
              )}
              <Field label="Payment">
                <select className="input" value={pay} onChange={(e) => setPayChoice(e.target.value as PayMethod)} disabled={!client}>
                  {payOptions.map((p) => (
                    <option key={p} value={p}>
                      {PAY_LABEL[p]}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            {extras || clientPo || notes ? (
              <div className="grid grid-cols-2 gap-2">
                <Field label="Client PO">
                  <input className="input" value={clientPo} onChange={(e) => setClientPo(e.target.value)} placeholder="Optional" autoFocus={extras && !clientPo} />
                </Field>
                <Field label="Note for driver">
                  <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
                </Field>
              </div>
            ) : (
              <button className="btn btn-quiet btn-sm -ml-2.5" onClick={() => setExtras(true)}>
                Add client PO or driver note
              </button>
            )}

            <dl className="text-[14px]">
              <div className="flex justify-between py-0.5">
                <dt className="text-ink-2">Subtotal</dt>
                <dd>{money(subtotal)}</dd>
              </div>
              {totals.dropFee > 0 && (
                <div className="flex justify-between py-0.5">
                  <dt className="text-ink-2">
                    Small-drop fee <span className="text-[12.5px] text-ink-3">(add {money0(DROP_MIN - subtotal)} to waive)</span>
                  </dt>
                  <dd>{money(totals.dropFee)}</dd>
                </div>
              )}
              {totals.fuel > 0 && (
                <div className="flex justify-between py-0.5">
                  <dt className="text-ink-2">Fuel surcharge</dt>
                  <dd>{money(totals.fuel)}</dd>
                </div>
              )}
              <div className="mt-1 flex items-baseline justify-between border-t border-line pt-2">
                <dt className="font-semibold">Total</dt>
                <dd className="display text-[30px] leading-none font-semibold">{money(totals.total)}</dd>
              </div>
            </dl>

            {creditProblem && (
              <div className="rounded-md border border-warn/30 bg-warn-bg p-2.5 text-[13px] text-warn">
                <div className="flex gap-2 font-semibold">
                  <AlertTriangle size={15} className="mt-0.5 shrink-0" /> Credit hold: {creditProblem}
                </div>
                <label className="mt-1.5 ml-6 flex cursor-pointer items-center gap-2 text-ink">
                  <input type="checkbox" checked={override} onChange={(e) => setOverride(e.target.checked)} className="accent-ink" />
                  Manager approved this order
                </label>
              </div>
            )}

            <div className="flex gap-2">
              <button className="btn btn-ghost btn-lg px-3" onClick={reset} disabled={!cart.length} aria-label="Clear ticket">
                <X size={18} />
              </button>
              <button className="btn btn-primary btn-lg flex-1" disabled={!canPlace} onClick={submit}>
                {fulfillment === "PICKUP" ? "Complete will-call sale" : `Place order for ${dayShort(keyToTs(date)).split(",")[0]}`}
              </button>
            </div>
            {!client && cart.length > 0 && <p className="text-[12.5px] text-ink-3">Choose the client to price and place this order.</p>}
          </div>
        </aside>
      </div>

      <Modal
        open={!!done}
        onClose={reset}
        title={done?.fulfillment === "PICKUP" ? "Sale complete" : "Order placed"}
        width={820}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => window.print()}>
              <Printer size={16} /> Print
            </button>
            <button className="btn btn-ghost" onClick={() => setSending(true)}>
              <Send size={16} /> Send receipt
            </button>
            <button className="btn btn-primary" onClick={reset}>
              Start next order
            </button>
          </>
        }
      >
        {done && (
          <div className="-mx-5 -my-4">
            <Invoice
              order={done}
              client={maps.client.get(done.clientId)!}
              delivery={deliveries.find((d) => d.id === done.deliveryId)}
              route={maps.route.get(maps.client.get(done.clientId)!.routeId)}
              products={maps.product}
            />
          </div>
        )}
      </Modal>
      {done && sending && (
        // The placed order lives in the store; read it back so a logged send shows up.
        <SendReceipt order={orders.find((o) => o.id === done.id) ?? done} client={maps.client.get(done.clientId)!} by="Counter 1" onClose={() => setSending(false)} />
      )}
    </div>
  );
}
