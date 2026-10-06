"use client";

import { Printer, Search, Send } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Invoice } from "@/components/Invoice";
import { SendReceipt } from "@/components/SendReceipt";
import { Badge, Drawer, Empty, PageHead, Pager, Panel, StatusPill } from "@/components/ui";
import { useIsAdmin } from "@/lib/auth";
import { dateTime, dayShort, invoiceNumber, keyToTs, money, money0, startOfDay } from "@/lib/format";
import { useMaps, useNow } from "@/lib/hooks";
import { PAY_LABEL, buyerName } from "@/lib/logic";
import { useStore, useUi } from "@/lib/store";
import type { Order } from "@/lib/types";

type Filter = "all" | "today" | "unpaid" | "cancelled";

/** Orders per page. */
const PAGE = 20;

export default function Orders() {
  const orders = useStore((s) => s.orders);
  const deliveries = useStore((s) => s.deliveries);
  const cancelOrder = useStore((s) => s.cancelOrder);
  const toast = useUi((s) => s.toast);
  const maps = useMaps();
  const now = useNow();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const params = useSearchParams();
  const [openId, setOpenId] = useState<string | null>(() => params.get("id"));
  const [sending, setSending] = useState(false);
  const [page, setPage] = useState(0);

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
  const pages = Math.max(1, Math.ceil(list.length / PAGE));
  const at = Math.min(page, pages - 1);
  const shown = list.slice(at * PAGE, at * PAGE + PAGE);

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
            <input className="input pl-11" placeholder="Customer name, order or invoice number" value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(0);
              }}
              aria-label="Search orders"
            />
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
              <button
                key={k}
                onClick={() => {
                  setFilter(k);
                  setPage(0);
                }}
                aria-pressed={filter === k}
                className="chip"
              >
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
              {shown.map((o) => {
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
                      {o.refund && !o.refund.at && (
                        <Badge tone="warn" className="ml-1.5">
                          Refund owed {money(o.refund.amount)}
                        </Badge>
                      )}
                    </td>
                    <td className="r pr-5 text-lead font-semibold sm:pr-6">{money(o.total)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {list.length === 0 && <Empty title="No orders match">Try another filter or search term.</Empty>}
        </div>
        <Pager page={at} pages={pages} onChange={setPage} />
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
      {order.refund && <RefundBar order={order} />}
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

/** Money owed back for refused cases on a paid order. Only the owner marks it handed back. */
function RefundBar({ order }: { order: Order }) {
  const markRefunded = useStore((s) => s.markRefunded);
  const toast = useUi((s) => s.toast);
  const isAdmin = useIsAdmin();
  const r = order.refund!;
  if (r.at)
    return (
      <div className="border-b border-line bg-sunk px-5 py-3 text-body">
        Refunded <span className="font-semibold">{money(r.amount)}</span> for refused cases on {dateTime(r.at)} by {r.by}.
      </div>
    );
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-line bg-warn-bg px-5 py-3 text-body">
      <span className="flex-1">
        <span className="font-semibold">Refund owed {money(r.amount)}</span> for cases refused at the door. {isAdmin ? "Mark it once the money is handed back." : "The owner marks it once the money is handed back."}
      </span>
      {isAdmin && (
        <button
          className="btn btn-dark btn-sm"
          onClick={() => {
            const res = markRefunded(order.id, "Owner");
            toast(res.ok ? `${order.number}: ${money(r.amount)} refunded` : res.error);
          }}
        >
          Mark refunded
        </button>
      )}
    </div>
  );
}
