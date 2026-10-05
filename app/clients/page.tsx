"use client";

import { Phone, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge, Drawer, PageHead, Panel, Signature, StatusPill, cx } from "@/components/ui";
import { DAY, dateTime, day, dayShort, keyToTs, money, money0, temp } from "@/lib/format";
import { queryParam, useMaps, useNow } from "@/lib/hooks";
import { TERMS_LABEL, TRUCK_LIMIT_C, isWalkIn } from "@/lib/logic";
import { useStore, useUi } from "@/lib/store";
import type { Client } from "@/lib/types";

export default function Clients() {
  const clients = useStore((s) => s.clients);
  const orders = useStore((s) => s.orders);
  const deliveries = useStore((s) => s.deliveries);
  const maps = useMaps();
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(() => queryParam("id"));

  const list = clients.filter((c) => !isWalkIn(c) && (!q || c.name.toLowerCase().includes(q.toLowerCase()) || c.city.toLowerCase().includes(q.toLowerCase())));
  const totalAR = clients.reduce((s, c) => s + c.balance, 0);
  const pastDue = clients.reduce((s, c) => s + c.pastDue, 0);
  const open = clients.find((c) => c.id === openId);

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHead title="Clients" sub={`${clients.length} accounts. ${money0(totalAR)} receivable, ${money0(pastDue)} past due.`} />
      <Panel bodyClass="">
        <div className="border-b border-line p-3">
          <div className="relative max-w-sm">
            <Search size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-3" />
            <input className="input pl-8" placeholder="Search name or city" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
        <div className="overflow-x-auto scroll-thin">
          <table className="tbl min-w-[1040px]">
            <thead>
              <tr>
                <th>Account</th>
                <th>Route</th>
                <th>Terms</th>
                <th>Balance vs limit</th>
                <th className="r">Past due</th>
                <th>Last delivery</th>
                <th>Next delivery</th>
              </tr>
            </thead>
            <tbody>
              {list.map((c) => {
                const ds = deliveries.filter((d) => d.clientId === c.id);
                const last = ds.filter((d) => d.pod).sort((a, b) => b.pod!.at - a.pod!.at)[0];
                const next = ds.filter((d) => !["DELIVERED", "EXCEPTION"].includes(d.status)).sort((a, b) => a.date.localeCompare(b.date))[0];
                return (
                  <tr key={c.id} className="clickable" onClick={() => setOpenId(c.id)}>
                    <td>
                      <div className="font-semibold">{c.name}</div>
                      <div className="text-[12.5px] text-ink-3">
                        {c.type}, {c.city}
                      </div>
                    </td>
                    <td className="text-ink-2">{maps.route.get(c.routeId)?.name}</td>
                    <td>
                      <span className="text-ink-2">{TERMS_LABEL[c.terms]}</span> <Badge>Tier {c.tier}</Badge>
                    </td>
                    <td>
                      {c.creditLimit > 0 ? (
                        <div className="w-44">
                          <div className="flex justify-between text-[13px]">
                            <span className="font-semibold">{money0(c.balance)}</span>
                            <span className="text-ink-3">of {money0(c.creditLimit)}</span>
                          </div>
                          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-sunk">
                            <div className={cx("h-full rounded-full", c.balance > c.creditLimit ? "bg-bad" : c.balance / c.creditLimit > 0.8 ? "bg-warn" : "bg-ink-2")} style={{ width: `${Math.min(100, (c.balance / c.creditLimit) * 100)}%` }} />
                          </div>
                        </div>
                      ) : (
                        <span className="text-[13px] text-ink-3">Cash account</span>
                      )}
                    </td>
                    <td className={cx("r", c.pastDue > 0 ? "font-semibold text-bad" : "text-ink-3")}>{c.pastDue > 0 ? money(c.pastDue) : "–"}</td>
                    <td className="text-ink-2">
                      {last ? (
                        <>
                          {day(last.pod!.at)} <span className="text-[12.5px] text-ink-3">signed {last.pod!.receivedBy}</span>
                        </>
                      ) : (
                        "–"
                      )}
                    </td>
                    <td>{next ? <span className="flex items-center gap-2"><StatusPill status={next.status} /><span className="text-[13px] text-ink-3">{dayShort(keyToTs(next.date)).replace(/,.*/, "")}</span></span> : <span className="text-ink-3">–</span>}</td>
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
            <Phone size={15} /> {c.phone}
          </a>
        </>
      }
    >
      <div className="grid grid-cols-3 overflow-hidden rounded-lg border border-line">
        {[
          ["Balance", money0(c.balance)],
          ["Past due", c.pastDue ? money0(c.pastDue) : "None"],
          ["Last 30 days", money0(spend30)],
        ].map(([l, v], i) => (
          <div key={l} className={cx("px-3 py-2", i > 0 && "border-l border-line")}>
            <div className="text-[12.5px] text-ink-3">{l}</div>
            <div className={cx("display text-[26px] leading-none font-semibold", l === "Past due" && c.pastDue > 0 && "text-bad")}>{v}</div>
          </div>
        ))}
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-[14px]">
        <div>
          <dt className="text-[12.5px] text-ink-3">Terms and pricing</dt>
          <dd>
            {TERMS_LABEL[c.terms]}, tier {c.tier}
            {c.creditLimit > 0 && `, ${money0(c.creditLimit)} limit`}
          </dd>
        </div>
        <div>
          <dt className="text-[12.5px] text-ink-3">Route and window</dt>
          <dd>
            {maps.route.get(c.routeId)?.name}, {c.window}
          </dd>
        </div>
        <div>
          <dt className="text-[12.5px] text-ink-3">Contact</dt>
          <dd>
            {c.contact}
            {c.email && <div className="text-ink-2">{c.email}</div>}
          </dd>
        </div>
        <div>
          <dt className="text-[12.5px] text-ink-3">TIN</dt>
          <dd>{c.tin ?? <span className="text-ink-3">None on file</span>}</dd>
        </div>
        <div>
          <dt className="text-[12.5px] text-ink-3">Deliveries signed</dt>
          <dd>{onTime} on record</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-[12.5px] text-ink-3">Dock note</dt>
          <dd>{c.dockNote}</dd>
        </div>
      </dl>

      <h3 className="display mt-6 mb-2 text-[19px] font-semibold">Deliveries</h3>
      <ul className="divide-y divide-line rounded-lg border border-line">
        {ds.length === 0 && <li className="p-3 text-[14px] text-ink-3">No deliveries yet.</li>}
        {ds.map((d) => {
          const o = maps.order.get(d.orderId);
          return (
            <li key={d.id}>
              <Link href={`/dispatch?stop=${d.id}`} className="flex items-center gap-3 px-3 py-2.5 hover:bg-sunk">
                <div className="w-24 shrink-0 text-[13.5px]">
                  <div className="font-semibold">{dayShort(keyToTs(d.date)).replace(/^\w+, /, "")}</div>
                  <div className="code text-ink-3">{o?.number}</div>
                </div>
                <div className="min-w-0 flex-1 text-[13.5px]">
                  {d.pod ? (
                    <>
                      <div>
                        Signed by <span className="font-semibold">{d.pod.receivedBy}</span> at {dateTime(d.pod.at).split(", ")[1]}
                      </div>
                      <div className={cx("text-[12.5px]", d.pod.productTempC > TRUCK_LIMIT_C ? "font-semibold text-bad" : "text-ink-3")}>
                        Product at {temp(d.pod.productTempC)}
                        {d.pod.shorts.length > 0 && `, ${d.pod.shorts.reduce((s, x) => s + x.qty, 0)} returned`}
                      </div>
                    </>
                  ) : d.exception ? (
                    <div className="font-semibold text-bad">{d.exception.reason}</div>
                  ) : (
                    <div className="text-ink-3">{d.eta ? `ETA ${dateTime(d.eta).split(", ")[1]}` : `Stop ${d.seq}`}</div>
                  )}
                </div>
                {d.pod?.signature && <Signature value={d.pod.signature} className="hidden h-9 w-24 sm:block" />}
                <StatusPill status={d.status} />
              </Link>
            </li>
          );
        })}
      </ul>

      <h3 className="display mt-6 mb-2 text-[19px] font-semibold">Orders</h3>
      <ul className="divide-y divide-line rounded-lg border border-line">
        {[...orders]
          .sort((a, b) => b.createdAt - a.createdAt)
          .map((o) => (
            <li key={o.id}>
              <Link href={`/orders?id=${o.id}`} className="flex items-center gap-3 px-3 py-2 text-[13.5px] hover:bg-sunk">
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
