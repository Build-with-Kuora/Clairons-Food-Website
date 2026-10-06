"use client";

import { Printer, Search, Send } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Invoice } from "@/components/Invoice";
import { SendReceipt } from "@/components/SendReceipt";
import { Badge, Drawer, Empty, PageHead, Panel, StatusPill } from "@/components/ui";
import { dateTime, dayShort, invoiceNumber, keyToTs, money, money0, startOfDay } from "@/lib/format";
import { queryParam, useMaps, useNow } from "@/lib/hooks";
import { PAY_LABEL, buyerName } from "@/lib/logic";
import { useStore, useUi } from "@/lib/store";
import type { Order } from "@/lib/types";

type Filter = "all" | "today" | "unpaid" | "cancelled";

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
      if (filter === "today") return o.createdAt >= dayStart;
      if (filter === "unpaid") return !o.paid && o.status !== "CANCELLED";
      if (filter === "cancelled") return o.status === "CANCELLED";
      return true;
    })
    .filter((o) => {
      const needle = q.trim().toLowerCase();
      return !needle || o.number.toLowerCase().includes(needle) || invoiceNumber(o.invoiceNo).toLowerCase().includes(needle) || buyerName(o, maps.client.get(o.clientId)).toLowerCase().includes(needle);
    })
    .sort((a, b) => b.createdAt - a.createdAt);

  const open = orders.find((o) => o.id === openId);
  const openD = open?.deliveryId ? dById.get(open.deliveryId) : undefined;
  const cancellable = open?.status === "OPEN" && (!openD || openD.status === "SCHEDULED" || openD.status === "PICKING");

  return (
    <div className="mx-auto max-w-[1500px]">
      <PageHead
        sub={`${orders.filter((o) => o.status === "OPEN").length} orders still open, ${money0(orders.filter((o) => !o.paid && o.status !== "CANCELLED").reduce((s, o) => s + o.total, 0))} not yet paid.`}
      />
      <Panel bodyClass="">
        <div className="flex flex-wrap items-center gap-3 border-b border-line p-4 sm:px-6">
          <div className="relative min-w-[240px] flex-1 md:max-w-[420px]">
            <Search size={20} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-3" aria-hidden />
            <input className="input pl-11" placeholder="Customer name, order or invoice number" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search orders" />
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Show">
            {(
              [
                ["all", "All orders"],
                ["today", "Placed today"],
                ["unpaid", "Not paid"],
                ["cancelled", "Cancelled"],
              ] as const
            ).map(([k, l]) => (
              <button key={k} onClick={() => setFilter(k)} aria-pressed={filter === k} className="chip">
                {l}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto scroll-thin">
          <table className="tbl min-w-[900px]">
            <thead>
              <tr>
                <th className="pl-5 sm:pl-6">Customer</th>
                <th>Placed</th>
                <th>How</th>
                <th>Status</th>
                <th>Payment</th>
                <th className="r pr-5 sm:pr-6">Total</th>
              </tr>
            </thead>
            <tbody>
              {list.map((o) => {
                const d = o.deliveryId ? dById.get(o.deliveryId) : undefined;
                return (
                  <tr key={o.id} className="clickable" onClick={() => setOpenId(o.id)}>
                    <td className="pl-5 sm:pl-6">
                      <div className="font-semibold">
                        {buyerName(o, maps.client.get(o.clientId))}
                        {o.channel === "ONLINE" && (
                          <Badge tone="accent" className="ml-2 align-middle">
                            Online
                          </Badge>
                        )}
                      </div>
                      <div className="hint whitespace-nowrap">
                        Order {o.number}, invoice {invoiceNumber(o.invoiceNo)}
                      </div>
                    </td>
                    <td className="whitespace-nowrap text-ink-2">{dateTime(o.createdAt)}</td>
                    <td className="text-ink-2">
                      {o.fulfillment === "PICKUP" ? "Walk-in" : d ? `Delivery ${dayShort(keyToTs(d.date))}, ${d.riderId ? `rider ${maps.rider.get(d.riderId)?.name}` : maps.route.get(d.routeId)?.name}` : "Delivery"}
                    </td>
                    <td>{o.status === "CANCELLED" ? <Badge>Cancelled</Badge> : d ? <StatusPill status={d.status} /> : <Badge tone="good">Sold at counter</Badge>}</td>
                    <td>
                      <div className="text-ink-2">{PAY_LABEL[o.payMethod]}</div>
                      {o.status !== "CANCELLED" && (o.paid ? <Badge tone="good">Paid</Badge> : o.payMethod === "COD" ? <Badge tone="warn">Collect on delivery</Badge> : <Badge>To be paid</Badge>)}
                    </td>
                    <td className="r pr-5 text-lead font-semibold sm:pr-6">{money(o.total)}</td>
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
          sub={`${buyerName(open, maps.client.get(open.clientId))}, placed ${dateTime(open.createdAt)} by ${open.by}`}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => window.print()}>
                <Printer size={18} aria-hidden /> Print invoice
              </button>
              <button className="btn btn-ghost" onClick={() => setSending(true)}>
                <Send size={18} aria-hidden /> Send receipt
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
                    toast(`${open.number} cancelled, stock put back`);
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
        <div className="flex flex-wrap items-center gap-3 border-b border-line bg-sunk px-5 py-3 text-body">
          <StatusPill status={d.status} />
          {d.pod ? (
            <span>
              Signed by <span className="font-semibold">{d.pod.receivedBy}</span> at {dateTime(d.pod.at)}
            </span>
          ) : d.eta ? (
            <span>Expected {dateTime(d.eta)}</span>
          ) : (
            <span className="text-ink-2">{d.riderId ? `By rider, ${maps.rider.get(d.riderId)?.name}` : `Stop ${d.seq} on ${maps.route.get(d.routeId)?.name}`}</span>
          )}
        </div>
      )}
      <Invoice order={order} client={c} delivery={d} route={maps.route.get(c.routeId)} rider={d?.riderId ? maps.rider.get(d.riderId) : undefined} products={maps.product} />
    </div>
  );
}
