"use client";

import { ArrowLeft, LogOut, Minus, Plus, ReceiptText, ShoppingCart } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { ROLE_LABEL, useAuth } from "@/lib/auth";
import { CART_MAX, useCart } from "@/lib/cart";
import { money } from "@/lib/format";
import { useStock } from "@/lib/hooks";
import { DROP_FEE, DROP_MIN, ONLINE_TIER, cartQuote, priceUnit } from "@/lib/logic";
import { useStore } from "@/lib/store";
import { Logo } from "./Logo";
import { Drawer, cx } from "./ui";

/** Header, cart and footer shared by every page of the online store. */
export function ShopFrame({ children }: { children: ReactNode }) {
  const path = usePathname();
  const user = useAuth((s) => s.user);
  const logOut = useAuth((s) => s.logOut);
  const count = useCart((s) => s.lines.reduce((t, l) => t + l.qty, 0));
  const products = useStore((s) => s.products);
  const lines = useCart((s) => s.lines);
  const [cartOpen, setCartOpen] = useState(false);
  const quote = cartQuote(products, lines);
  const atCheckout = path.startsWith("/shop/checkout");

  return (
    <div className="flex min-h-screen flex-col bg-page">
      {user && user.role !== "customer" && (
        <div className="bg-ink px-4 py-2 text-center text-caption text-white">
          Viewing the store as {ROLE_LABEL[user.role]}. Online orders show up in Orders and Delivery.{" "}
          <Link href="/" className="font-semibold underline">
            Back to the app
          </Link>
        </div>
      )}
      <header className="sticky top-0 z-30 border-b border-line bg-panel/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1200px] items-center gap-3 px-4 py-2.5">
          <Link href="/shop" aria-label="Clairon's Food online store, home">
            <Logo height={34} />
          </Link>
          <span className="hidden text-caption font-semibold tracking-[0.08em] text-ink-3 uppercase sm:inline">Online store</span>
          <nav className="ml-auto flex items-center gap-1.5">
            {user?.role === "customer" && (
              <Link href="/shop/orders" className={cx("btn btn-quiet", path.startsWith("/shop/orders") && "bg-sunk text-ink")}>
                <ReceiptText size={16} aria-hidden /> <span className="hidden sm:inline">My orders</span>
              </Link>
            )}
            {!atCheckout && (
              <button className="btn btn-ghost relative" onClick={() => setCartOpen(true)} aria-label={`Cart, ${count} items`}>
                <ShoppingCart size={16} aria-hidden />
                <span className="hidden sm:inline">Cart</span>
                {count > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-brand px-1 text-caption font-semibold text-white">{count}</span>}
              </button>
            )}
            {user ? (
              <button className="btn btn-quiet" onClick={logOut} title={user.email}>
                <LogOut size={16} aria-hidden /> <span className="hidden sm:inline">Log out</span>
              </button>
            ) : (
              <Link href={`/login?next=${encodeURIComponent(path)}`} className="btn btn-primary">
                Log in
              </Link>
            )}
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 pt-6 pb-24">{children}</main>

      <footer className="border-t border-line bg-panel">
        <div className="mx-auto flex max-w-[1200px] flex-wrap gap-x-6 gap-y-1 px-4 py-5 text-caption text-ink-3">
          <span className="font-semibold text-ink-2">Clairon&rsquo;s Food</span>
          <span>Made in Iloilo City, delivered frozen Monday to Saturday.</span>
          <span>Prototype store: no real payments are taken.</span>
        </div>
      </footer>

      {count > 0 && !atCheckout && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-panel/95 p-3 backdrop-blur sm:hidden">
          <button className="btn btn-primary btn-lg w-full" onClick={() => setCartOpen(true)}>
            <ShoppingCart size={18} aria-hidden /> View cart, {money(quote.subtotal)}
          </button>
        </div>
      )}

      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    </div>
  );
}

function CartDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const products = useStore((s) => s.products);
  const lines = useCart((s) => s.lines);
  const setQty = useCart((s) => s.setQty);
  const { rows } = useStock();
  const quote = cartQuote(products, lines);
  const short = quote.items.find((i) => i.qty > (rows.get(i.product.sku)?.available ?? 0));
  const team = useAuth((s) => !!s.user && s.user.role !== "customer");

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Your cart"
      sub={quote.items.length ? `${quote.items.length} ${quote.items.length === 1 ? "product" : "products"}` : undefined}
      footer={
        quote.items.length > 0 && (
          <div className="w-full">
            <dl className="mb-3 space-y-1 text-small">
              <Row label="Subtotal" value={money(quote.subtotal)} />
              <Row label="Delivery fee" value={money(quote.fuel)} />
              {quote.dropFee > 0 && <Row label={`Small order fee (under ${money(DROP_MIN)})`} value={money(quote.dropFee)} />}
              <div className="flex items-baseline justify-between border-t border-line pt-2">
                <dt className="font-semibold">Total</dt>
                <dd className="display text-heading leading-none font-semibold">{money(quote.total)}</dd>
              </div>
            </dl>
            {short && <p className="mb-2 text-caption text-bad">Only {rows.get(short.product.sku)?.available ?? 0} of {short.product.name} left. Lower the quantity to check out.</p>}
            {/* The team browses the store but can't check out as a customer (spec 10.4); they take orders on the POS. */}
            {team ? (
              <p className="text-small text-ink-2">Customers check out here. Staff take orders on the POS.</p>
            ) : (
              <button
                className="btn btn-primary btn-lg w-full"
                disabled={!!short}
                onClick={() => {
                  onClose();
                  router.push("/shop/checkout");
                }}
              >
                Check out
              </button>
            )}
          </div>
        )
      }
    >
      {quote.items.length === 0 ? (
        <div className="py-10 text-center">
          <ShoppingCart size={28} className="mx-auto text-ink-3" aria-hidden />
          <p className="mt-2 text-body font-semibold">Your cart is empty</p>
          <p className="text-small text-ink-3">Add products from the store to order.</p>
          <button className="btn btn-ghost mt-4" onClick={onClose}>
            <ArrowLeft size={15} aria-hidden /> Keep shopping
          </button>
        </div>
      ) : (
        <ul className="divide-y divide-line">
          {quote.items.map(({ product: p, qty, total }) => {
            const left = rows.get(p.sku)?.available ?? 0;
            return (
              <li key={p.sku} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-body font-semibold">{p.name}</div>
                  <div className="text-caption text-ink-3">
                    {p.pack}, {money(p.price[ONLINE_TIER])}/{priceUnit(p)}
                  </div>
                </div>
                <Stepper qty={qty} max={Math.min(CART_MAX, left)} onChange={(n) => setQty(p.sku, n)} label={p.name} />
                <div className="w-24 text-right text-body font-semibold">{money(total)}</div>
              </li>
            );
          })}
        </ul>
      )}
      {quote.items.length > 0 && quote.dropFee > 0 && (
        <p className="mt-3 rounded-md bg-sunk px-3 py-2 text-caption text-ink-2">
          Add {money(DROP_MIN - quote.subtotal)} more to skip the {money(DROP_FEE)} small order fee.
        </p>
      )}
    </Drawer>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-ink-2">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

/** Quantity control. Going below 1 takes the product out of the cart. */
export function Stepper({ qty, max, onChange, label }: { qty: number; max: number; onChange: (n: number) => void; label: string }) {
  return (
    <div className="flex h-11 items-center rounded-xl border border-line-2 bg-panel">
      <button className="grid h-full w-11 cursor-pointer place-items-center text-ink-2 hover:text-ink" onClick={() => onChange(qty - 1)} aria-label={`One less ${label}`}>
        <Minus size={15} />
      </button>
      <span className="w-9 text-center text-lead font-semibold" aria-live="polite">
        {qty}
      </span>
      <button
        className="grid h-full w-11 cursor-pointer place-items-center text-ink-2 hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
        onClick={() => onChange(qty + 1)}
        disabled={qty >= max}
        aria-label={`One more ${label}`}
      >
        <Plus size={15} />
      </button>
    </div>
  );
}
