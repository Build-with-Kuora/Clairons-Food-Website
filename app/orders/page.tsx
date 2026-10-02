"use client";

import { Printer, Search, Send } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Invoice } from "@/components/Invoice";
import { SendReceipt } from "@/components/SendReceipt";
import { Badge, Drawer, Empty, PageHead, Panel, StatusPill, cx } from "@/components/ui";
import { dateTime, dayShort, invoiceNumber, keyToTs, money, money0, startOfDay } from "@/lib/format";
import { queryParam, useMaps, useNow } from "@/lib/hooks";
import { PAY_LABEL } from "@/lib/logic";
import { useStore, useUi } from "@/lib/store";
import type { Order } from "@/lib/types";

type Filter = "all" | "open" | "today" | "unpaid" | "cancelled";

export default function Orders() {
  const orders = useStore((s) => s.orders);
  const deliveries = useStore((s) => s.deliveries);
  const cancelOrder = useStore((s) => s.cancelOrder);
  const toast = useUi((s) => s.toast);
  const maps = useMaps();
  const now = useNow();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [openId, setOpenId] = useState<string | null>(() => queryParam("id"));
  const [sending, setSending] = useState(false);

  const dById = new Map(deliveries.map((d) => [d.id, d]));
  const dayStart = startOfDay(now);
  const list = orders
    .filter((o) => {
      if (filter === "open") return o.status === "OPEN";
      if (filter === "today") return o.createdAt >= dayStart;
      if (filter === "unpaid") return !o.paid && o.status !== "CANCELLED";
      if (filter === "cancelled") return o.status === "CANCELLED";
      return true;
    })
    .filter((o) => {
      const needle = q.trim().toLowerCase();
      return !needle || o.number.toLowerCase().includes(needle) || invoiceNumber(o.invoiceNo).toLowerCase().includes(needle) || maps.client.get(o.clientId)?.name.toLowerCase().includes(needle);
    })
    .sort((a, b) => b.createdAt - a.createdAt);

  const open = orders.find((o) => o.id === openId);
  const openD = open?.deliveryId ? dById.get(open.deliveryId) : undefined;
  const cancellable = open?.status === "OPEN" && (!openD || openD.status === "SCHEDULED" || openD.status === "PICKING");

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHead
        title="Orders"
        sub={`${orders.filter((o) => o.status === "OPEN").length} open, ${money0(orders.filter((o) => !o.paid && o.status !== "CANCELLED").reduce((s, o) => s + o.total, 0))} not yet paid.`}
        actions={<Link href="/counter" className="btn btn-primary">New order</Link>}
      />
      <Panel bodyClass="">
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
          <div className="relative min-w-[220px] flex-1">
            <Search size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-3" />
            <input className="input pl-8" placeholder="Order, invoice number or client" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          {(
            [
              ["all", "All"],
              ["today", "Placed today"],
              ["open", "Open"],
              ["unpaid", "Unpaid"],
              ["cancelled", "Cancelled"],
            ] as const
          ).map(([k, l]) => (
            <button key={k} onClick={() => setFilter(k)} className={cx("h-8 cursor-pointer rounded-full border px-3 text-[13.5px] font-semibold", filter === k ? "border-ink bg-ink text-white" : "border-line bg-white text-ink-2")}>
              {l}
            </button>
          ))}
        </div>
        <div className="max-h-[72vh] overflow-auto scroll-thin">
          <table className="tbl min-w-[960px]">
            <thead>
              <tr>
                <th>Order</th>
                <th>Invoice</th>
                <th>Placed</th>
                <th>Client</th>
                <th>Fulfillment</th>
                <th>Status</th>
                <th>Payment</th>
                <th className="r">Total</th>
              </tr>
            </thead>
            <tbody>
              {list.map((o) => {
                const d = o.deliveryId ? dById.get(o.deliveryId) : undefined;
                return (
                  <tr key={o.id} className="clickable" onClick={() => setOpenId(o.id)}>
                    <td className="code font-medium">{o.number}</td>
                    <td className="code text-ink-2">{invoiceNumber(o.invoiceNo)}</td>
                    <td className="whitespace-nowrap text-ink-2">{dateTime(o.createdAt)}</td>
                    <td className="font-semibold">{maps.client.get(o.clientId)?.name}</td>
                    <td className="text-ink-2">
                      {o.fulfillment === "PICKUP" ? "Will-call" : d ? `${dayShort(keyToTs(d.date))}, ${d.riderId ? `rider ${maps.rider.get(d.riderId)?.name}` : maps.route.get(d.routeId)?.name}` : "Truck"}
                    </td>
                    <td>{o.status === "CANCELLED" ? <Badge>Cancelled</Badge> : d ? <StatusPill status={d.status} /> : <Badge tone="good">Picked up</Badge>}</td>
                    <td>
                      <span className="text-ink-2">{PAY_LABEL[o.payMethod]}</span>{" "}
                      {o.status !== "CANCELLED" && (o.paid ? <Badge tone="good">Paid</Badge> : o.payMethod === "COD" ? <Badge tone="warn">Collect</Badge> : <Badge>Invoiced</Badge>)}
                    </td>
                    <td className="r font-semibold">{money(o.total)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {list.length === 0 && <Empty title="No orders match">Try another filter or search term.</Empty>}
        </div>
      </Panel>

      {open && (
        <Drawer
          open
          onClose={() => setOpenId(null)}
          title={open.number}
          sub={`${maps.client.get(open.clientId)?.name}, placed ${dateTime(open.createdAt)} by ${open.by}`}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => window.print()}>
                <Printer size={16} /> Print invoice
              </button>
              <button className="btn btn-ghost" onClick={() => setSending(true)}>
                <Send size={16} /> Send receipt
              </button>
              {openD && (
                <Link className="btn btn-ghost" href={`/dispatch?stop=${openD.id}`}>
                  Track delivery
                </Link>
              )}
              {cancellable && (
                <button
                  className="btn btn-danger ml-auto"
                  onClick={() => {
                    cancelOrder(open.id, "Counter 1");
                    toast(`${open.number} cancelled, stock released`);
                  }}
                >
                  Cancel order
                </button>
              )}
            </>
          }
        >
          <OrderBody order={open} />
          {sending && <SendReceipt order={open} client={maps.client.get(open.clientId)!} by="Counter 1" onClose={() => setSending(false)} />}
        </Drawer>
      )}
    </div>
  );
}

function OrderBody({ order }: { order: Order }) {
  const maps = useMaps();
  const deliveries = useStore((s) => s.deliveries);
  const d = deliveries.find((x) => x.id === order.deliveryId);
  const c = maps.client.get(order.clientId)!;
  return (
    <div className="-mx-5 -my-4">
      {d && (
        <div className="flex flex-wrap items-center gap-3 border-b border-line bg-sunk px-5 py-2.5 text-[14px]">
          <StatusPill status={d.status} />
          {d.pod ? (
            <span>
              Signed by <span className="font-semibold">{d.pod.receivedBy}</span> at {dateTime(d.pod.at)}
            </span>
          ) : d.eta ? (
            <span>ETA {dateTime(d.eta)}</span>
          ) : (
            <span className="text-ink-3">{d.riderId ? `Rider drop, ${maps.rider.get(d.riderId)?.name}` : `Stop ${d.seq} on ${maps.route.get(d.routeId)?.name}`}</span>
          )}
        </div>
      )}
      <Invoice order={order} client={c} delivery={d} route={maps.route.get(c.routeId)} rider={d?.riderId ? maps.rider.get(d.riderId) : undefined} products={maps.product} />
    </div>
  );
}
