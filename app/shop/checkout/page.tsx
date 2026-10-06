"use client";

import { ArrowLeft, Banknote, CreditCard, Smartphone } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { ShopFrame } from "@/components/ShopFrame";
import { Field, cx } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { useCart } from "@/lib/cart";
import { dayLong, keyToTs, money } from "@/lib/format";
import { useStock } from "@/lib/hooks";
import { SERVICE_AREAS, cartQuote, deliveryDays } from "@/lib/logic";
import { useStore, useUi } from "@/lib/store";
import type { PayMethod } from "@/lib/types";

const PAY_OPTIONS: { id: PayMethod; label: string; sub: string; icon: typeof Banknote }[] = [
  { id: "GCASH", label: "GCash", sub: "Pay now from your GCash wallet", icon: Smartphone },
  { id: "CARD", label: "Credit or debit card", sub: "Visa or Mastercard, paid now", icon: CreditCard },
  { id: "COD", label: "Cash on delivery", sub: "Pay the rider or driver when it arrives", icon: Banknote },
];

export default function Checkout() {
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const products = useStore((s) => s.products);
  const clients = useStore((s) => s.clients);
  const saveCustomer = useStore((s) => s.saveCustomer);
  const placeOrder = useStore((s) => s.placeOrder);
  const lines = useCart((s) => s.lines);
  const clearCart = useCart((s) => s.clear);
  const toast = useUi((s) => s.toast);
  const setPlacedOrder = useUi((s) => s.setPlacedOrder);
  const { rows } = useStock();
  const quote = cartQuote(products, lines);

  // Returning customers get their last delivery details back.
  const prev = clients.find((c) => c.type === "Online customer" && c.email === user?.email);
  const [name, setName] = useState(prev?.name ?? "");
  const [phone, setPhone] = useState(prev?.phone ?? "");
  const [address, setAddress] = useState(prev?.address ?? "");
  const [city, setCity] = useState(prev?.city ?? "");
  const [days] = useState(() => deliveryDays(Date.now(), 6));
  const [date, setDate] = useState(days[0]);
  const [notes, setNotes] = useState("");
  const [pay, setPay] = useState<PayMethod>("GCASH");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user?.role !== "customer") {
    return (
      <ShopFrame>
        <Notice title="Customers check out here">Log in with a customer account to place an online order. Staff take orders on the Counter.</Notice>
      </ShopFrame>
    );
  }

  if (!quote.items.length) {
    return (
      <ShopFrame>
        <Notice title="Your cart is empty">Add products from the store first.</Notice>
      </ShopFrame>
    );
  }

  const short = quote.items.find((i) => i.qty > (rows.get(i.product.sku)?.available ?? 0));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    if (short) return setError(`Only ${rows.get(short.product.sku)?.available ?? 0} of ${short.product.name} left. Go back to the cart and lower the quantity.`);
    const saved = saveCustomer({ email: user.email, name, phone, address, city });
    if (!saved.ok) return setError(saved.error);
    setBusy(true);
    // Prototype: stands in for the GCash or card payment page. Nothing is charged.
    if (pay !== "COD") await new Promise((r) => setTimeout(r, 900));
    const res = placeOrder({
      clientId: saved.client.id,
      lines: quote.items.map((i) => ({ sku: i.product.sku, qty: i.qty })),
      fulfillment: "DELIVERY",
      date,
      payMethod: pay,
      notes,
      by: "Online store",
      channel: "ONLINE",
    });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    clearCart();
    toast(`Order ${res.order.number} placed`);
    setPlacedOrder(res.order.id);
    router.push("/shop/orders");
  };

  return (
    <ShopFrame>
      <Link href="/shop" className="btn btn-quiet btn-sm -ml-2.5 mb-2">
        <ArrowLeft size={14} aria-hidden /> Keep shopping
      </Link>
      <h1 className="display mb-5 text-figure leading-none font-semibold">Checkout</h1>

      <form onSubmit={submit} noValidate className="grid items-start gap-5 lg:grid-cols-[1fr_380px]">
        <div className="space-y-5">
          <Section title="Deliver to">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Name">
                <input className="input" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
              </Field>
              <Field label="Mobile number" hint="The rider calls this number on arrival.">
                <input className="input" type="tel" inputMode="tel" autoComplete="tel" placeholder="0917 555 1234" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </Field>
              <Field label="Street address, barangay and landmark" className="sm:col-span-2">
                <input className="input" autoComplete="street-address" value={address} onChange={(e) => setAddress(e.target.value)} />
              </Field>
              <Field label="City" hint="We deliver within these Metro Manila cities.">
                <select className="input" value={city} onChange={(e) => setCity(e.target.value)}>
                  <option value="">Choose a city</option>
                  {Object.keys(SERVICE_AREAS).map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </Field>
              <Field label="Notes for the driver (optional)">
                <input className="input" placeholder="Gate code, call first…" value={notes} onChange={(e) => setNotes(e.target.value)} />
              </Field>
            </div>
          </Section>

          <Section title="Delivery day">
            <div className="flex flex-wrap gap-2">
              {days.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDate(d)}
                  aria-pressed={date === d}
                  className={cx("h-10 cursor-pointer rounded-md border px-3 text-small font-semibold", date === d ? "border-ink bg-ink text-white" : "border-line bg-panel hover:border-line-2")}
                >
                  {dayLong(keyToTs(d)).split(",")[0]}, {new Date(keyToTs(d)).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </button>
              ))}
            </div>
            <p className="mt-2 text-caption text-ink-3">Delivered between 8 am and 5 pm. No deliveries on Sundays.</p>
          </Section>

          <Section title="Payment">
            <div className="grid gap-2 sm:grid-cols-3">
              {PAY_OPTIONS.map((o) => (
                <label
                  key={o.id}
                  className={cx("flex cursor-pointer gap-3 rounded-lg border p-3", pay === o.id ? "border-ink bg-sunk" : "border-line hover:border-line-2")}
                >
                  <input type="radio" name="pay" className="mt-1 accent-ink" checked={pay === o.id} onChange={() => setPay(o.id)} />
                  <span>
                    <span className="flex items-center gap-1.5 text-small font-semibold">
                      <o.icon size={15} aria-hidden /> {o.label}
                    </span>
                    <span className="block text-caption text-ink-3">{o.sub}</span>
                  </span>
                </label>
              ))}
            </div>
            {pay !== "COD" && (
              <p className="mt-2 rounded-md bg-warn-bg px-3 py-2 text-caption text-warn">
                Prototype: no money is charged. The live store sends you to {pay === "GCASH" ? "GCash" : "the card payment page"} here; this demo marks the order paid.
              </p>
            )}
          </Section>
        </div>

        <aside className="rounded-xl border border-line bg-panel p-5 lg:sticky lg:top-20">
          <h2 className="display text-title font-semibold">Order summary</h2>
          <ul className="mt-3 divide-y divide-line/70 text-small">
            {quote.items.map((i) => (
              <li key={i.product.sku} className="flex justify-between gap-3 py-2">
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{i.product.name}</span>
                  <span className="text-ink-3">
                    {i.qty} × {i.product.unit}
                  </span>
                </span>
                <span className="font-semibold">{money(i.total)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-2 space-y-1 border-t border-line pt-3 text-small text-ink-2">
            <Line label="Subtotal" value={money(quote.subtotal)} />
            <Line label="Delivery fee" value={money(quote.fuel)} />
            {quote.dropFee > 0 && <Line label="Small order fee" value={money(quote.dropFee)} />}
            <div className="flex items-baseline justify-between border-t border-line pt-2 text-ink">
              <dt className="font-semibold">Total</dt>
              <dd className="display text-figure leading-none font-semibold">{money(quote.total)}</dd>
            </div>
          </dl>
          <p className="mt-2 text-caption text-ink-3">Prices include 12% VAT. Items sold by weight are billed at the weight delivered.</p>
          {error && (
            <p className="mt-3 rounded-md bg-bad-bg px-3 py-2 text-caption text-bad" role="alert">
              {error}
            </p>
          )}
          <button type="submit" className="btn btn-primary btn-lg mt-4 w-full" disabled={busy}>
            {busy ? "Placing order…" : pay === "COD" ? `Place order, ${money(quote.total)}` : `Pay ${money(quote.total)} and place order`}
          </button>
        </aside>
      </form>
    </ShopFrame>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-panel p-5">
      <h2 className="display mb-3 text-title font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function Notice({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-md rounded-xl border border-line bg-panel p-8 text-center">
      <h1 className="display text-heading font-semibold">{title}</h1>
      <p className="mt-2 text-small text-ink-2">{children}</p>
      <Link href="/shop" className="btn btn-ghost mt-5">
        <ArrowLeft size={15} aria-hidden /> Back to the store
      </Link>
    </div>
  );
}
