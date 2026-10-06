"use client";

import { CheckCircle2, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { ShopFrame } from "@/components/ShopFrame";
import { Badge, cx } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { clock, dateTime, dayLong, keyToTs, money } from "@/lib/format";
import { PAY_LABEL } from "@/lib/logic";
import { useStore, useUi } from "@/lib/store";
import type { Delivery, Order } from "@/lib/types";

/** The four steps a customer sees, from the finer delivery statuses dispatch works with. */
const STEPS = ["Order placed", "Packed", "Out for delivery", "Delivered"] as const;

function stepOf(o: Order, d?: Delivery) {
  if (!d) return o.status === "FULFILLED" ? 3 : 0;
  if (d.status === "DELIVERED") return 3;
  if (d.status === "EN_ROUTE" || d.status === "ARRIVED" || d.status === "EXCEPTION") return 2;
  if (d.status === "LOADED") return 1;
  return 0;
}

export default function MyOrders() {
  const user = useAuth((s) => s.user);
  const clients = useStore((s) => s.clients);
  const orders = useStore((s) => s.orders);
  const deliveries = useStore((s) => s.deliveries);
  const placed = useUi((s) => s.placedOrderId);

  const mine = new Set(clients.filter((c) => c.type === "Online customer" && c.email === user?.email).map((c) => c.id));
  const list = orders.filter((o) => mine.has(o.clientId)).sort((a, b) => b.createdAt - a.createdAt);
  const just = list.find((o) => o.id === placed);

  return (
    <ShopFrame>
      <h1 className="display mb-1 text-figure leading-none font-semibold">My orders</h1>
      <p className="mb-5 text-small text-ink-2">Track your deliveries. Status updates as our team packs and delivers.</p>

      {just && (
        <div className="rise mb-5 flex gap-3 rounded-xl border border-good/30 bg-good-bg p-4 text-good">
          <CheckCircle2 size={22} className="mt-0.5 shrink-0" aria-hidden />
          <div>
            <div className="font-semibold">Thank you! Order {just.number} is in.</div>
            <div className="text-small text-ink-2">
              {just.paid ? "Paid" : `Pay ${money(just.total)} on delivery`}. We&rsquo;ll deliver it on {just.deliveryId ? dayLong(keyToTs(deliveries.find((d) => d.id === just.deliveryId)?.date ?? "")) : "your chosen day"}.
            </div>
          </div>
        </div>
      )}

      {list.length === 0 ? (
        <div className="rounded-xl border border-line bg-panel px-4 py-12 text-center">
          <ShoppingBag size={28} className="mx-auto text-ink-3" aria-hidden />
          <p className="mt-2 text-body font-semibold">No orders yet</p>
          <Link href="/shop" className="btn btn-primary mt-4">
            Start shopping
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {list.map((o) => (
            <OrderCard key={o.id} order={o} delivery={deliveries.find((d) => d.id === o.deliveryId)} />
          ))}
        </div>
      )}
    </ShopFrame>
  );
}

function OrderCard({ order: o, delivery: d }: { order: Order; delivery?: Delivery }) {
  const step = stepOf(o, d);
  const problem = d?.status === "EXCEPTION";
  const cancelled = o.status === "CANCELLED";
  return (
    <article className="rounded-xl border border-line bg-panel">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <div className="display text-title leading-tight font-semibold">Order {o.number}</div>
          <div className="text-small text-ink-3">
            Placed {dateTime(o.createdAt)}
            {d && !cancelled && <> · Delivery {dayLong(keyToTs(d.date))}</>}
          </div>
        </div>
        <div className="text-right">
          <div className="display text-heading leading-none font-semibold">{money(o.total)}</div>
          <div className="mt-1">
            {cancelled ? <Badge tone="bad">Cancelled</Badge> : o.paid ? <Badge tone="good">Paid, {PAY_LABEL[o.payMethod]}</Badge> : <Badge tone="warn">{PAY_LABEL[o.payMethod]}</Badge>}
          </div>
        </div>
      </header>

      {!cancelled && (
        <div className="px-5 pt-4">
          <ol className="grid grid-cols-4 gap-2" aria-label="Delivery progress">
            {STEPS.map((s, i) => (
              <li key={s} aria-current={i === step ? "step" : undefined}>
                <div className={cx("h-1.5 rounded-full", i <= step ? (problem && i === step ? "bg-bad" : "bg-brand") : "bg-sunk")} />
                <div className={cx("mt-1.5 text-caption leading-tight", i <= step ? "font-semibold text-ink" : "text-ink-3")}>{s}</div>
              </li>
            ))}
          </ol>
          {problem && (
            <p className="mt-3 rounded-md bg-bad-bg px-3 py-2 text-small text-bad">
              There was a problem with this delivery. Our dispatch team will call you at the number you gave.
            </p>
          )}
          {d?.status === "DELIVERED" && d.pod && (
            <p className="mt-3 text-small text-ink-2">
              Delivered at {clock(d.pod.at)}, received by {d.pod.receivedBy}.
            </p>
          )}
        </div>
      )}

      <ul className="divide-y divide-line/70 px-5 py-2 text-small">
        {o.lines.map((l) => (
          <li key={l.sku} className="flex justify-between gap-3 py-2">
            <span>
              <span className="font-semibold">{l.name}</span> <span className="text-ink-3">× {l.qty}</span>
            </span>
            <span>{money(l.lineTotal)}</span>
          </li>
        ))}
      </ul>
      {o.dropFee + o.fuel > 0 && <div className="border-t border-line/70 px-5 py-2 text-right text-caption text-ink-3">Includes {money(o.dropFee + o.fuel)} in delivery fees</div>}
    </article>
  );
}
