"use client";

import { SortableGrid } from "@/components/SortableBlocks";
import { AlertTriangle, Banknote, CreditCard, FileCheck2, History, Landmark, Minus, Plus, Printer, Search, Send, Smartphone, Store, Trash2, Truck, Wallet, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { CategoryTile } from "@/components/CategoryTile";
import { Invoice } from "@/components/Invoice";
import { SendReceipt } from "@/components/SendReceipt";
import { Badge, Field, Kbd, Modal, cx } from "@/components/ui";
import { useIsAdmin } from "@/lib/auth";
import { dayShort, keyToTs, money, money0, unitPlural, units } from "@/lib/format";
import { useMaps, useStock } from "@/lib/hooks";
import { DROP_MIN, PAY_LABEL, TERMS_LABEL, WALK_IN, WALK_IN_ID, buyerName, casePrice, deliveryDays, isWalkIn, orderTotals, priceLines, priceUnit, vatSplit } from "@/lib/logic";
import { useStore, useUi } from "@/lib/store";
import type { Category, Order, PayMethod } from "@/lib/types";

const CATS: (Category | "All")[] = ["All", "Dimsum", "Streetfood", "Tocino & longganisa", "Pork", "Poultry", "Seafood", "Desserts", "Bakery", "Fries", "Chiller"];

type Mode = "WALK_IN" | "DELIVERY";

const PAY_ICON: Record<PayMethod, typeof Banknote> = {
  CASH: Banknote,
  GCASH: Smartphone,
  CARD: CreditCard,
  CHECK: FileCheck2,
  ACCOUNT: Landmark,
  COD: Wallet,
};

export default function Counter() {
  const allProducts = useStore((s) => s.products);
  const products = useMemo(() => allProducts.filter((p) => p.active), [allProducts]);
  const clients = useStore((s) => s.clients);
  const orders = useStore((s) => s.orders);
  const deliveries = useStore((s) => s.deliveries);
  const placeOrder = useStore((s) => s.placeOrder);
  const toast = useUi((s) => s.toast);
  const maps = useMaps();
  const { rows } = useStock();

  // A client handed over from the Customers page arrives through the UI store and starts a delivery order.
  const [handoff] = useState(() => useUi.getState().counterClientId ?? "");
  const [mode, setMode] = useState<Mode>(handoff ? "DELIVERY" : "WALK_IN");
  const [clientId, setClientId] = useState<string>(handoff);
  const [buyer, setBuyer] = useState("");
  const [cart, setCart] = useState<{ sku: string; qty: number }[]>([]);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<Category | "All">("All");
  const [days] = useState(() => deliveryDays(Date.now(), 6));
  const [date, setDate] = useState(days[0]);
  const [payChoice, setPayChoice] = useState<PayMethod | null>(null);
  const [clientPo, setClientPo] = useState("");
  const [notes, setNotes] = useState("");
  const [override, setOverride] = useState(false);
  const admin = useIsAdmin();
  const [extras, setExtras] = useState(false);
  const [done, setDone] = useState<Order | null>(null);
  const [sending, setSending] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const orderRef = useRef<HTMLElement>(null);

  const fulfillment = mode === "WALK_IN" ? "PICKUP" : "DELIVERY";
  const accounts = useMemo(() => clients.filter((c) => !isWalkIn(c)), [clients]);
  // A walk-in with no account picked is sold to the built-in walk-in account.
  const walkIn = clients.find((c) => c.id === WALK_IN_ID) ?? WALK_IN;
  const picked = accounts.find((c) => c.id === clientId);
  const client = picked ?? (mode === "WALK_IN" ? walkIn : undefined);
  const anonymous = isWalkIn(client);
  const tier = client?.tier ?? "C";

  useEffect(() => {
    useUi.getState().setCounterClient(undefined);
  }, []);

  // First option is the sensible default for the account's terms. Anonymous walk-ins pay now.
  const payOptions: PayMethod[] = anonymous
    ? ["CASH", "GCASH", "CARD"]
    : client?.terms === "COD"
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
    const term = q
      .trim()
      .toLowerCase()
      .replace(/\s+\d+$/, "");
    return products.filter((p) => (cat === "All" || p.category === cat) && (!term || p.sku.toLowerCase().includes(term) || p.name.toLowerCase().includes(term)));
  }, [products, q, cat]);

  const inCart = new Map(cart.map((l) => [l.sku, l.qty]));
  const priced = client ? priceLines(products, client, cart) : [];
  const subtotal = priced.reduce((s, l) => s + l.lineTotal, 0);
  const totals = orderTotals(subtotal, fulfillment);
  const vat = vatSplit(totals.total).vat;
  const items = cart.reduce((s, l) => s + l.qty, 0);

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

  const lastOrder = picked ? orders.filter((o) => o.clientId === picked.id && o.status !== "CANCELLED").sort((a, b) => b.createdAt - a.createdAt)[0] : undefined;

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

  function switchMode(m: Mode) {
    setMode(m);
    setPayChoice(null);
    setOverride(false);
  }

  function submit() {
    if (!client) return;
    const res = placeOrder({
      clientId: client.id,
      lines: cart,
      fulfillment,
      date,
      payMethod: pay,
      clientPo,
      notes,
      by: "Counter 1",
      buyerName: anonymous ? buyer : undefined,
    });
    if (!res.ok) {
      toast(res.error, "warn");
      return;
    }
    setDone(res.order);
    toast(`${res.order.number} ${fulfillment === "PICKUP" ? "paid" : "placed"} for ${buyerName(res.order, client)}`);
  }

  function reset() {
    setDone(null);
    setCart([]);
    setBuyer("");
    setClientPo("");
    setNotes("");
    setOverride(false);
    setExtras(false);
  }

  const doneClient = done ? (maps.client.get(done.clientId) ?? walkIn) : undefined;

  return (
    <div className={cx("mx-auto max-w-[1500px]", cart.length > 0 && "pb-16 xl:pb-0")}>
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        {/* ---------- Catalog ---------- */}
        <div className="min-w-0">
          <div className="mb-5">
            <div className="relative w-full max-w-[560px]">
              <Search size={20} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-ink-3" aria-hidden />
              <input
                ref={searchRef}
                className="input h-13 pr-12 pl-12 text-lead"
                placeholder="Search for a product"
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

          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h2 className="display text-title font-semibold">Products</h2>
            <span className="text-small text-ink-2">
              {filtered.length} of {products.length} shown{!anonymous && picked ? `, prices for ${picked.name}` : ""}
            </span>
          </div>
          <div className="mb-5 flex flex-wrap gap-2" role="group" aria-label="Category">
            {CATS.map((c) => (
              <button key={c} onClick={() => setCat(c)} aria-pressed={cat === c} className="chip">
                {c}
              </button>
            ))}
          </div>

          <SortableGrid
            storageKey="coldline-pos-products"
            className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 sm:grid-cols-[repeat(auto-fill,minmax(230px,1fr))]"
            items={filtered.map((p) => {
              const avail = rows.get(p.sku)?.available ?? 0;
              const qty = inCart.get(p.sku) ?? 0;
              const out = avail <= 0;
              return {
                id: p.sku,
                label: p.name,
                className: "[&>div]:h-full",
                node: (
                  <article
                    key={p.sku}
                    className={cx(
                      "relative flex flex-col rounded-2xl border-2 bg-panel p-4 shadow-card transition-[border-color,box-shadow]",
                      qty ? "border-brand" : "border-transparent",
                    )}
                  >
                    <CategoryTile category={p.category} size="lg" />
                    <h3 className="mt-3 text-lead leading-snug font-semibold">{p.name}</h3>
                    <div className="mt-1 text-small text-ink-2">
                      Per {p.unit}, {p.pack}
                      {p.catchWeight && ", sold by weight"}
                    </div>
                    <div className="mt-auto pt-4">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
                        <div className="display text-heading leading-none font-semibold">
                          {money(p.price[tier])}
                          <span className="ml-1 font-sans text-small font-medium text-ink-2">/{priceUnit(p)}</span>
                        </div>
                        <div className={cx("text-small font-semibold", out ? "text-bad" : avail < p.reorderPoint ? "text-warn" : "text-ink-2")}>
                          {out ? "Out of stock" : `${units(avail, p.unit)} left`}
                        </div>
                      </div>
                      <button className="btn btn-primary mt-3 w-full" onClick={() => add(p.sku)} disabled={out} aria-label={`Add ${p.name}`}>
                        <Plus size={20} strokeWidth={2.6} aria-hidden /> {out ? "Out of stock" : qty ? "Add one more" : "Add to order"}
                      </button>
                    </div>
                    {qty > 0 && (
                      <span className="absolute top-3 right-3 flex h-8 items-center rounded-full bg-ink px-3 text-small font-bold text-white">{qty} in order</span>
                    )}
                  </article>
                ),
              };
            })}
          />
          {filtered.length === 0 && <p className="py-10 text-center text-body text-ink-2">No products match “{q}”. Clear the search or pick another category.</p>}
        </div>

        {/* ---------- Current order ---------- */}
        <aside
          ref={orderRef}
          className="scroll-mt-20 flex flex-col overflow-y-auto rounded-2xl border border-line/70 bg-panel shadow-card xl:sticky xl:top-6 xl:max-h-[calc(100vh-10rem)] scroll-thin"
        >
          <div className="space-y-4 px-5 pt-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="display text-heading font-semibold">Current order</h2>
              <button className="btn btn-ghost btn-sm" onClick={reset} disabled={!cart.length && !buyer}>
                <X size={18} aria-hidden /> Clear
              </button>
            </div>

            <div className="flex gap-2" role="radiogroup" aria-label="Order type">
              {(
                [
                  ["WALK_IN", "Walk-in", Store],
                  ["DELIVERY", "Delivery", Truck],
                ] as const
              ).map(([m, label, Icon]) => (
                <button
                  key={m}
                  role="radio"
                  aria-checked={mode === m}
                  onClick={() => switchMode(m)}
                  className={cx(
                    "flex h-12 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 text-body font-semibold transition-colors",
                    mode === m ? "border-brand bg-brand text-white" : "border-line-2 text-ink-2 hover:text-ink",
                  )}
                >
                  <Icon size={20} aria-hidden /> {label}
                </button>
              ))}
            </div>

            {mode === "WALK_IN" ? (
              <div className="grid gap-2">
                <Field label="Customer name" hint={picked ? undefined : "Optional. Printed on the receipt."}>
                  <input className="input" value={picked ? picked.name : buyer} onChange={(e) => setBuyer(e.target.value)} placeholder="Walk-in customer" disabled={!!picked} />
                </Field>
                <AccountPicker
                  label="Charge to an account"
                  value={clientId}
                  onChange={(id) => {
                    setClientId(id);
                    setPayChoice(null);
                    setOverride(false);
                  }}
                  accounts={accounts}
                  routeName={(rid) => maps.route.get(rid)?.name}
                  empty="No account, pay now"
                />
              </div>
            ) : (
              <AccountPicker
                label="Customer account"
                value={clientId}
                onChange={(id) => {
                  setClientId(id);
                  setPayChoice(null);
                  setOverride(false);
                }}
                accounts={accounts}
                routeName={(rid) => maps.route.get(rid)?.name}
                empty="Choose an account…"
              />
            )}

            {picked && (
              <div className="text-small">
                <div className="flex flex-wrap gap-1.5">
                  <Badge>Price list {picked.tier}</Badge>
                  <Badge tone={picked.terms === "COD" ? "warn" : "neutral"}>{TERMS_LABEL[picked.terms]}</Badge>
                  {mode === "DELIVERY" && <Badge>{maps.route.get(picked.routeId)?.name}</Badge>}
                  {mode === "DELIVERY" && <Badge>{picked.window}</Badge>}
                </div>
                {picked.creditLimit > 0 && (
                  <div className="mt-2.5">
                    <div className="flex justify-between text-ink-2">
                      <span>Owes {money0(picked.balance)}</span>
                      <span>Credit limit {money0(picked.creditLimit)}</span>
                    </div>
                    <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-sunk">
                      <div
                        className={cx("h-full rounded-full", creditAfter > picked.creditLimit ? "bg-bad" : picked.balance / picked.creditLimit > 0.8 ? "bg-warn" : "bg-ink-2")}
                        style={{ width: `${Math.min(100, (creditAfter / picked.creditLimit) * 100)}%` }}
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
                    <History size={18} aria-hidden /> Repeat last order ({lastOrder.number}, {money0(lastOrder.total)})
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="mt-4 shrink-0 border-y border-line bg-sunk/50 px-3 py-3">
            {cart.length === 0 ? (
              <p className="px-3 py-8 text-center text-body text-ink-2">Nothing in the order yet. Tap &ldquo;Add to order&rdquo; on a product.</p>
            ) : (
              <ul className="space-y-2">
                {cart.map((l) => {
                  const p = maps.product.get(l.sku)!;
                  const pl = priced.find((x) => x.sku === l.sku);
                  const avail = rows.get(l.sku)?.available ?? 0;
                  const short = l.qty > avail;
                  return (
                    <li key={l.sku} className="rounded-xl bg-panel p-3 shadow-card">
                      <div className="flex items-start gap-3">
                        <CategoryTile category={p.category} size="md" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="text-body leading-snug font-semibold">{p.name}</div>
                            <button
                              className="-mt-1 -mr-1 flex h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg px-2 text-small font-semibold text-ink-2 hover:bg-bad-bg hover:text-bad"
                              onClick={() => setQty(l.sku, 0)}
                              aria-label={`Remove ${p.name}`}
                            >
                              <Trash2 size={18} aria-hidden /> Remove
                            </button>
                          </div>
                          <div className="text-small text-ink-2">
                            {money(p.price[tier])}/{priceUnit(p)}
                            {p.catchWeight && `, about ${p.caseKg * l.qty} kg`}
                          </div>
                          <div className="mt-2 flex items-center justify-between gap-2">
                            <div className="text-lead font-semibold">{money(pl?.lineTotal ?? casePrice(p, tier) * l.qty)}</div>
                            <div className="flex items-center rounded-full border border-line-2 bg-white">
                              <button className="grid h-11 w-11 cursor-pointer place-items-center rounded-full text-ink hover:bg-sunk" onClick={() => add(l.sku, -1)} aria-label={`One less ${p.unit}`}>
                                <Minus size={18} />
                              </button>
                              <input
                                className="h-11 w-12 text-center text-lead font-semibold focus:outline-none"
                                value={l.qty}
                                inputMode="numeric"
                                onChange={(e) => setQty(l.sku, parseInt(e.target.value.replace(/\D/g, "") || "0", 10))}
                                aria-label={`Number of ${unitPlural(p.unit)}`}
                              />
                              <button className="grid h-11 w-11 cursor-pointer place-items-center rounded-full text-ink hover:bg-sunk" onClick={() => add(l.sku, 1)} aria-label={`One more ${p.unit}`}>
                                <Plus size={18} />
                              </button>
                            </div>
                          </div>
                          {short && <div className="mt-1.5 text-small font-semibold text-bad">Only {units(avail, p.unit)} left in stock</div>}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="space-y-4 px-5 pt-4 pb-4">
            {mode === "DELIVERY" && (
              <div className="space-y-2">
                <Field label="Delivery day">
                  <select className="input" value={date} onChange={(e) => setDate(e.target.value)}>
                    {days.map((d) => (
                      <option key={d} value={d}>
                        {dayShort(keyToTs(d))}
                      </option>
                    ))}
                  </select>
                </Field>
                {extras || clientPo || notes ? (
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Purchase order no.">
                      <input className="input" value={clientPo} onChange={(e) => setClientPo(e.target.value)} placeholder="Optional" autoFocus={extras && !clientPo} />
                    </Field>
                    <Field label="Note for driver">
                      <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
                    </Field>
                  </div>
                ) : (
                  <button className="btn btn-quiet btn-sm -ml-3" onClick={() => setExtras(true)}>
                    Add a purchase order number or driver note
                  </button>
                )}
              </div>
            )}

            <dl className="space-y-1.5 text-body">
              <div className="flex justify-between">
                <dt className="text-ink-2">Items</dt>
                <dd>
                  {items} for {money(subtotal)}
                </dd>
              </div>
              {totals.dropFee > 0 && (
                <div className="flex justify-between gap-2">
                  <dt className="text-ink-2">
                    Small order fee <span className="text-small text-ink-3">(add {money0(DROP_MIN - subtotal)} more to skip it)</span>
                  </dt>
                  <dd>{money(totals.dropFee)}</dd>
                </div>
              )}
              {totals.fuel > 0 && (
                <div className="flex justify-between">
                  <dt className="text-ink-2">Fuel fee</dt>
                  <dd>{money(totals.fuel)}</dd>
                </div>
              )}
              <div className="flex justify-between text-ink-2">
                <dt>Includes 12% VAT</dt>
                <dd>{money(vat)}</dd>
              </div>
              <div className="flex items-baseline justify-between border-t border-dashed border-line pt-2">
                <dt className="font-semibold">Total</dt>
                <dd className="display text-figure leading-none font-semibold">{money(totals.total)}</dd>
              </div>
            </dl>

            <div>
              <div className="mb-2 text-body font-semibold">Payment</div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Payment">
                {payOptions.map((p) => {
                  const Icon = PAY_ICON[p];
                  return (
                    <button
                      key={p}
                      role="radio"
                      aria-checked={pay === p}
                      onClick={() => setPayChoice(p)}
                      disabled={!client}
                      className={cx(
                        "flex h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 px-2 text-body font-semibold whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:border-line disabled:bg-sunk disabled:text-ink-3",
                        pay === p ? "border-ink bg-ink text-white" : "border-line-2 text-ink-2 hover:text-ink",
                      )}
                    >
                      <Icon size={18} aria-hidden /> {PAY_LABEL[p]}
                    </button>
                  );
                })}
              </div>
            </div>

            {creditProblem && (
              <div className="rounded-xl border border-warn/30 bg-warn-bg p-4 text-small text-warn">
                <div className="flex gap-2 font-semibold">
                  <AlertTriangle size={18} className="mt-0.5 shrink-0" aria-hidden /> Over the credit limit: {creditProblem}
                </div>
                {admin ? (
                  <label className="mt-2 ml-6 flex min-h-11 cursor-pointer items-center gap-3 text-ink">
                    <input type="checkbox" checked={override} onChange={(e) => setOverride(e.target.checked)} className="h-5 w-5 accent-ink" />
                    Manager approved this order
                  </label>
                ) : (
                  <p className="mt-1 ml-6 text-ink-2">Only the owner can approve an order over the credit limit.</p>
                )}
              </div>
            )}
          </div>

          {/* Checkout stays in view at the bottom of the panel however long the order gets. */}
          <div className="sticky bottom-0 border-t border-line bg-panel px-5 pt-3 pb-5">
            <button className="btn btn-primary btn-lg w-full" disabled={!canPlace} onClick={submit}>
              {mode === "WALK_IN" ? `Checkout ${money(totals.total)}` : `Place order for ${dayShort(keyToTs(date)).split(",")[0]}, ${money(totals.total)}`}
            </button>
            {cart.length === 0 && <p className="mt-2 text-center hint">Add products to check out.</p>}
            {mode === "DELIVERY" && !client && cart.length > 0 && <p className="mt-2 hint">Choose the customer account to price and place this order.</p>}
          </div>
        </aside>
      </div>

      {/* Below xl the order sits under the products, so phones and tablets get a shortcut to it. */}
      {cart.length > 0 && (
        <button
          className="btn btn-dark fixed inset-x-4 bottom-[calc(76px+env(safe-area-inset-bottom))] z-30 h-12 justify-between rounded-xl px-4 text-body shadow-lg lg:bottom-4 xl:hidden"
          onClick={() => orderRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
        >
          <span>View order, {units(items, "item")}</span>
          <span>{money(totals.total)}</span>
        </button>
      )}

      <Modal
        open={!!done}
        onClose={reset}
        title={done?.fulfillment === "PICKUP" ? "Sale complete" : "Order placed"}
        width={820}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => window.print()}>
              <Printer size={18} aria-hidden /> Print
            </button>
            <button className="btn btn-ghost" onClick={() => setSending(true)}>
              <Send size={18} aria-hidden /> Send receipt
            </button>
            <button className="btn btn-primary" onClick={reset}>
              Start next order
            </button>
          </>
        }
      >
        {done && doneClient && (
          <div className="-mx-5 -my-4">
            <Invoice order={done} client={doneClient} delivery={deliveries.find((d) => d.id === done.deliveryId)} route={maps.route.get(doneClient.routeId)} products={maps.product} />
          </div>
        )}
      </Modal>
      {done && doneClient && sending && (
        // The placed order lives in the store; read it back so a logged send shows up.
        <SendReceipt order={orders.find((o) => o.id === done.id) ?? done} client={doneClient} by="Counter 1" onClose={() => setSending(false)} />
      )}
    </div>
  );
}

/** Customer accounts grouped by van route. Never lists the built-in walk-in account. */
function AccountPicker({
  label,
  value,
  onChange,
  accounts,
  routeName,
  empty,
}: {
  label: string;
  value: string;
  onChange: (id: string) => void;
  accounts: { id: string; name: string; routeId: string }[];
  routeName: (routeId: string) => string | undefined;
  empty: string;
}) {
  return (
    <Field label={label}>
      <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{empty}</option>
        {[...new Set(accounts.map((c) => c.routeId))].map((rid) => (
          <optgroup key={rid} label={routeName(rid) ?? "Other"}>
            {accounts
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
  );
}
