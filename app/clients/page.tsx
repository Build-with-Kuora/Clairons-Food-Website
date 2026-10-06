"use client";

import { ChevronRight, Phone, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge, Drawer, PageHead, Panel, Signature, StatusPill, cx } from "@/components/ui";
import { DAY, dateTime, dayShort, keyToTs, money, money0, temp } from "@/lib/format";
import { queryParam, useMaps, useNow } from "@/lib/hooks";
import { TERMS_LABEL, TRUCK_LIMIT_C, isWalkIn } from "@/lib/logic";
import { useStore, useUi } from "@/lib/store";
import type { Client } from "@/lib/types";

export default function Clients() {
  const clients = useStore((s) => s.clients);
  const orders = useStore((s) => s.orders);
  const deliveries = useStore((s) => s.deliveries);
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(() => queryParam("id"));

  // Overdue accounts first: they are the ones to call.
  const list = clients
    .filter((c) => !isWalkIn(c) && (!q || c.name.toLowerCase().includes(q.toLowerCase()) || c.city.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => b.pastDue - a.pastDue);
  const totalAR = clients.reduce((s, c) => s + c.balance, 0);
  const pastDue = clients.reduce((s, c) => s + c.pastDue, 0);
  const open = clients.find((c) => c.id === openId);

  return (
    <div className="mx-auto max-w-[1500px]">
      <PageHead
        sub={
          <>
            {clients.filter((c) => !isWalkIn(c)).length} customer accounts. They owe {money0(totalAR)} in all
            {pastDue > 0 && <span className="font-semibold text-bad">, {money0(pastDue)} of it overdue</span>}.
          </>
        }
      />
      <Panel bodyClass="">
        <div className="border-b border-line p-4 sm:px-6">
          <div className="relative max-w-[420px]">
            <Search size={20} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-3" aria-hidden />
            <input className="input pl-11" placeholder="Search by name or city" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search customers" />
          </div>
        </div>
        <div className="overflow-x-auto scroll-thin">
          <table className="tbl min-w-[900px]">
            <thead>
              <tr>
                <th className="pl-5 sm:pl-6">Customer</th>
                <th className="r">Overdue</th>
                <th>Owes, of credit limit</th>
                <th>Payment terms</th>
                <th>Next delivery</th>
                <th className="pr-5 sm:pr-6">
                  <span className="sr-only">Open</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {list.map((c) => {
                const ds = deliveries.filter((d) => d.clientId === c.id);
                const next = ds.filter((d) => !["DELIVERED", "EXCEPTION"].includes(d.status)).sort((a, b) => a.date.localeCompare(b.date))[0];
                return (
                  <tr key={c.id} className="clickable" onClick={() => setOpenId(c.id)}>
                    <td className="pl-5 sm:pl-6">
                      <div className="font-semibold">{c.name}</div>
                      <div className="hint">
                        {c.type}, {c.city}
                      </div>
                    </td>
                    <td className={cx("r whitespace-nowrap", c.pastDue > 0 ? "font-semibold text-bad" : "text-ink-3")}>{c.pastDue > 0 ? money(c.pastDue) : "None"}</td>
                    <td>
                      {c.creditLimit > 0 ? (
                        <div className="w-52">
                          <div className="flex justify-between gap-2 text-small">
                            <span className="font-semibold">{money0(c.balance)}</span>
                            <span className="text-ink-2">of {money0(c.creditLimit)}</span>
                          </div>
                          <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-sunk">
                            <div className={cx("h-full rounded-full", c.balance > c.creditLimit ? "bg-bad" : c.balance / c.creditLimit > 0.8 ? "bg-warn" : "bg-ink-2")} style={{ width: `${Math.min(100, (c.balance / c.creditLimit) * 100)}%` }} />
                          </div>
                        </div>
                      ) : (
                        <span className="text-ink-2">Pays cash, no credit</span>
                      )}
                    </td>
                    <td>
                      <div className="text-ink-2">{TERMS_LABEL[c.terms]}</div>
                      <div className="hint">Price list {c.tier}</div>
                    </td>
                    <td>
                      {next ? (
                        <span className="flex flex-wrap items-center gap-2">
                          <StatusPill status={next.status} />
                          <span className="text-small text-ink-2">{dayShort(keyToTs(next.date)).replace(/,.*/, "")}</span>
                        </span>
                      ) : (
                        <span className="text-ink-3">None planned</span>
                      )}
                    </td>
                    <td className="r pr-5 sm:pr-6">
                      <span className="inline-flex items-center gap-1 text-small font-semibold text-brand">
                        Open <ChevronRight size={18} aria-hidden />
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
      {open && <ClientDrawer client={open} orders={orders.filter((o) => o.clientId === open.id)} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function ClientDrawer({ client: c, orders, onClose }: { client: Client; orders: ReturnType<typeof useStore.getState>["orders"]; onClose: () => void }) {
  const maps = useMaps();
  const deliveries = useStore((s) => s.deliveries);
  const setCounterClient = useUi((s) => s.setCounterClient);
  const router = useRouter();
  const now = useNow();
  const ds = deliveries.filter((d) => d.clientId === c.id).sort((a, b) => b.date.localeCompare(a.date) || b.seq - a.seq);
  const spend30 = orders.filter((o) => o.createdAt > now - 30 * DAY && o.status !== "CANCELLED").reduce((s, o) => s + o.total, 0);
  const onTime = ds.filter((d) => d.pod).length;

  return (
    <Drawer
      open
      onClose={onClose}
      title={c.name}
      sub={`${c.type}, ${c.address}, ${c.city}`}
      footer={
        <>
          <button
            className="btn btn-primary"
            onClick={() => {
              setCounterClient(c.id);
              router.push("/counter");
            }}
          >
            New order for {c.name.split(" ")[0] === "The" ? c.name.split(" ").slice(0, 3).join(" ") : c.name.split(" ").slice(0, 2).join(" ")}
          </button>
          <a className="btn btn-ghost" href={`tel:${c.phone.replace(/\D/g, "")}`}>
            <Phone size={18} aria-hidden /> {c.phone}
          </a>
        </>
      }
    >
      <div className="grid grid-cols-3 overflow-hidden rounded-lg border border-line">
        {[
          ["Owes", money0(c.balance)],
          ["Overdue", c.pastDue ? money0(c.pastDue) : "None"],
          ["Last 30 days", money0(spend30)],
        ].map(([l, v], i) => (
          <div key={l} className={cx("px-4 py-3", i > 0 && "border-l border-line")}>
            <div className="text-small text-ink-2">{l}</div>
            <div className={cx("display text-heading leading-none font-semibold", l === "Overdue" && c.pastDue > 0 && "text-bad")}>{v}</div>
          </div>
        ))}
      </div>
      <dl className="mt-5 grid grid-cols-2 gap-x-5 gap-y-3 text-body">
        <div>
          <dt className="text-small text-ink-3">Terms and pricing</dt>
          <dd>
            {TERMS_LABEL[c.terms]}, price list {c.tier}
            {c.creditLimit > 0 && `, ${money0(c.creditLimit)} limit`}
          </dd>
        </div>
        <div>
          <dt className="text-small text-ink-3">Route and delivery hours</dt>
          <dd>
            {maps.route.get(c.routeId)?.name}, {c.window}
          </dd>
        </div>
        <div>
          <dt className="text-small text-ink-3">Contact</dt>
          <dd>
            {c.contact}
            {c.email && <div className="text-ink-2">{c.email}</div>}
          </dd>
        </div>
        <div>
          <dt className="text-small text-ink-3">TIN</dt>
          <dd>{c.tin ?? <span className="text-ink-3">None on file</span>}</dd>
        </div>
        <div>
          <dt className="text-small text-ink-3">Deliveries signed</dt>
          <dd>{onTime} on record</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-small text-ink-3">Delivery note</dt>
          <dd>{c.dockNote}</dd>
        </div>
      </dl>

      <h3 className="display mt-7 mb-3 text-title font-semibold">Deliveries</h3>
      <ul className="divide-y divide-line rounded-lg border border-line">
        {ds.length === 0 && <li className="p-3 text-small text-ink-3">No deliveries yet.</li>}
        {ds.map((d) => {
          const o = maps.order.get(d.orderId);
          return (
            <li key={d.id}>
              <Link href={`/dispatch?stop=${d.id}`} className="flex items-center gap-3 px-3 py-2.5 hover:bg-sunk">
                <div className="w-24 shrink-0 text-small">
                  <div className="font-semibold">{dayShort(keyToTs(d.date)).replace(/^\w+, /, "")}</div>
                  <div className="code text-ink-3">{o?.number}</div>
                </div>
                <div className="min-w-0 flex-1 text-small">
                  {d.pod ? (
                    <>
                      <div>
                        Signed by <span className="font-semibold">{d.pod.receivedBy}</span> at {dateTime(d.pod.at).split(", ")[1]}
                      </div>
                      <div className={cx("text-caption", d.pod.productTempC > TRUCK_LIMIT_C ? "font-semibold text-bad" : "text-ink-3")}>
                        Product at {temp(d.pod.productTempC)}
                        {d.pod.shorts.length > 0 && `, ${d.pod.shorts.reduce((s, x) => s + x.qty, 0)} returned`}
                      </div>
                    </>
                  ) : d.exception ? (
                    <div className="font-semibold text-bad">{d.exception.reason}</div>
                  ) : (
                    <div className="text-ink-3">{d.eta ? `Expected ${dateTime(d.eta).split(", ")[1]}` : `Stop ${d.seq}`}</div>
                  )}
                </div>
                {d.pod?.signature && <Signature value={d.pod.signature} className="hidden h-9 w-24 sm:block" />}
                <StatusPill status={d.status} />
              </Link>
            </li>
          );
        })}
      </ul>

      <h3 className="display mt-7 mb-3 text-title font-semibold">Orders</h3>
      <ul className="divide-y divide-line rounded-lg border border-line">
        {[...orders]
          .sort((a, b) => b.createdAt - a.createdAt)
          .map((o) => (
            <li key={o.id}>
              <Link href={`/orders?id=${o.id}`} className="flex items-center gap-3 px-3 py-2 text-small hover:bg-sunk">
                <span className="code w-20 font-medium">{o.number}</span>
                <span className="flex-1 text-ink-2">
                  {dateTime(o.createdAt)}, {o.lines.length} lines
                </span>
                {o.status === "CANCELLED" ? <Badge>Cancelled</Badge> : o.paid ? <Badge tone="good">Paid</Badge> : <Badge>Open invoice</Badge>}
                <span className="w-24 text-right font-semibold">{money(o.total)}</span>
              </Link>
            </li>
          ))}
      </ul>
    </Drawer>
  );
}
