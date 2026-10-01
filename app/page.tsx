"use client";

import { AlertTriangle, ArrowUpRight, CalendarClock, PauseCircle, TrendingDown } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { DailyBars, Sparkline } from "@/components/charts";
import { RouteLine } from "@/components/RouteLine";
import { Badge, PageHead, Panel, cx } from "@/components/ui";
import { DAY, clock, count, dateKey, daysUntil, money, money0, pesoK, startOfDay, tempBare } from "@/lib/format";
import { useMaps, useStock, useToday } from "@/lib/hooks";
import { TRUCK_LIMIT_C, ZONES, runKey } from "@/lib/logic";
import { useStore } from "@/lib/store";

export default function Today() {
  const { now, today } = useToday();
  const router = useRouter();
  const orders = useStore((s) => s.orders);
  const deliveries = useStore((s) => s.deliveries);
  const runs = useStore((s) => s.runs);
  const routes = useStore((s) => s.routes);
  const zones = useStore((s) => s.zones);
  const lots = useStore((s) => s.lots);
  const clients = useStore((s) => s.clients);
  const maps = useMaps();
  const { rows } = useStock();

  const dayStart = startOfDay(now);
  const todays = orders.filter((o) => o.createdAt >= dayStart && o.status !== "CANCELLED");
  const sales = todays.reduce((s, o) => s + o.total, 0);
  const stopsToday = deliveries.filter((d) => d.date === today);
  const done = stopsToday.filter((d) => d.status === "DELIVERED").length;
  const exceptions = stopsToday.filter((d) => d.status === "EXCEPTION");
  const toPick = deliveries.filter((d) => d.status === "SCHEDULED" || d.status === "PICKING").length;
  const trucksOut = routes.filter((r) => runs[runKey(r.id, today)]?.departedAt && !runs[runKey(r.id, today)]?.returnedAt).length;

  const daily = useMemo(() => {
    const out: { label: string; sub: string; value: number; note: string }[] = [];
    for (let i = 13; i >= 0; i--) {
      const s = startOfDay(dayStart - i * DAY + 2 * 3_600_000);
      const e = s + DAY;
      const os = orders.filter((o) => o.createdAt >= s && o.createdAt < e && o.status !== "CANCELLED");
      out.push({
        label: i === 0 ? "Today" : String(new Date(s).getDate()),
        sub: new Date(s).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
        value: os.reduce((t, o) => t + o.total, 0),
        note: `${os.length} orders`,
      });
    }
    return out;
  }, [orders, dayStart]);

  const avg = daily.slice(0, -1).filter((d) => d.value > 0);
  const avgSales = avg.length ? avg.reduce((s, d) => s + d.value, 0) / avg.length : 0;

  const low = [...rows.values()].filter((r) => r.available < r.product.reorderPoint).sort((a, b) => a.available / a.product.reorderPoint - b.available / b.product.reorderPoint);
  const expiring = lots.filter((l) => l.qty > 0 && daysUntil(l.bestBy, now) <= 30).sort((a, b) => a.bestBy - b.bestBy);
  const held = lots.filter((l) => l.qty > 0 && l.status === "HOLD");
  const overCredit = clients.filter((c) => c.pastDue > 0 || (c.creditLimit > 0 && c.balance > c.creditLimit * 0.9));

  const figures = [
    { label: "Sold today", value: money0(sales), sub: `${todays.length} orders, 14-day avg ${money0(avgSales)}` },
    { label: "Stops delivered", value: `${done} of ${stopsToday.length}`, sub: exceptions.length ? `${exceptions.length} with an exception` : "No exceptions" , alert: exceptions.length > 0 },
    { label: "Trucks out", value: `${trucksOut} of ${routes.length}`, sub: "Ref vans on the road now" },
    { label: "Orders to pick", value: count(toPick), sub: "Scheduled or picking" },
  ];

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHead
        title="Today"
        sub="Everything moving through the building and on the road."
        actions={
          <>
            <Link href="/dispatch" className="btn btn-ghost">Open dispatch</Link>
            <Link href="/counter" className="btn btn-primary">New order</Link>
          </>
        }
      />

      <div className="mb-5 grid grid-cols-2 overflow-hidden rounded-[10px] border border-line bg-panel md:grid-cols-4">
        {figures.map((f, i) => (
          <div key={f.label} className={cx("px-4 py-3", i > 0 && "md:border-l", i % 2 === 1 && "border-l", i > 1 && "border-t md:border-t-0", "border-line")}>
            <div className="text-[13px] text-ink-3">{f.label}</div>
            <div className="display mt-0.5 text-[34px] leading-none font-semibold">{f.value}</div>
            <div className={cx("mt-1 text-[13px]", f.alert ? "font-semibold text-bad" : "text-ink-3")}>{f.sub}</div>
          </div>
        ))}
      </div>

      <Panel
        title="Routes"
        className="mb-5"
        actions={<Link href="/dispatch" className="btn btn-quiet btn-sm">Dispatch board <ArrowUpRight size={14} /></Link>}
        bodyClass="divide-y divide-line"
      >
        {routes.map((r) => {
          const stops = stopsToday.filter((d) => d.routeId === r.id);
          const run = runs[runKey(r.id, today)];
          const last = run?.temps.at(-1);
          return (
            <div key={r.id} className="grid gap-3 px-4 py-3 md:grid-cols-[200px_1fr]">
              <div>
                <div className="display text-[19px] leading-tight font-semibold">{r.name}</div>
                <div className="text-[13px] text-ink-3">
                  {r.truck}, {r.driver}
                </div>
                {last && (
                  <div className={cx("mt-1 text-[13px] font-semibold", last.c > TRUCK_LIMIT_C ? "text-bad" : "text-ink-2")}>
                    Box {tempBare(last.c)}C <span className="font-normal text-ink-3">at {clock(last.at)}</span>
                  </div>
                )}
              </div>
              <RouteLine stops={stops} run={run} clients={maps.client} onSelect={(id) => router.push(`/dispatch?stop=${id}`)} />
            </div>
          );
        })}
      </Panel>

      <div className="grid gap-5 xl:grid-cols-[1.35fr_1fr]">
        <Panel title="Sales, last 14 days" actions={<span className="text-[13px] text-ink-3">Order value incl. fees</span>}>
          <DailyBars data={daily} format={pesoK} />
        </Panel>

        <Panel title="Freezers" bodyClass="divide-y divide-line" actions={<Link href="/inventory?tab=zones" className="btn btn-quiet btn-sm">Zones <ArrowUpRight size={14} /></Link>}>
          {zones.map((z) => {
            const cur = z.readings.at(-1) ?? z.setPointC;
            return (
              <div key={z.id} className="flex items-center gap-4 px-4 py-2.5" style={{ boxShadow: `inset 4px 0 0 ${ZONES[z.id].color}` }}>
                <div className="w-28">
                  <div className="text-[14px] font-semibold">{z.name}</div>
                  <div className="text-[12.5px] text-ink-3">Set {tempBare(z.setPointC, 0)}, alarm {tempBare(z.maxC, 0)}</div>
                </div>
                <div className="flex-1">
                  <Sparkline values={z.readings.slice(-36)} setPoint={z.setPointC} alarm={z.maxC} />
                </div>
                <div className={cx("display w-20 text-right text-[26px] font-semibold", cur > z.maxC && "text-bad")}>{tempBare(cur)}</div>
                <div className="hidden w-24 text-right text-[12.5px] text-ink-3 sm:block">
                  {z.used}/{z.capacity} pallets
                  <div className="mt-1 h-1.5 rounded-full bg-sunk">
                    <div className="h-full rounded-full bg-ink-2" style={{ width: `${(z.used / z.capacity) * 100}%` }} />
                  </div>
                </div>
              </div>
            );
          })}
        </Panel>
      </div>

      <h2 className="display mt-7 mb-3 text-[22px] font-semibold">Needs attention</h2>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <AttentionList
          icon={<AlertTriangle size={16} />}
          tone="bad"
          title="Delivery exceptions"
          empty="All stops clean so far."
          items={exceptions.map((d) => ({
            key: d.id,
            href: `/dispatch?stop=${d.id}`,
            main: maps.client.get(d.clientId)?.name ?? "",
            side: d.exception?.reason ?? "",
          }))}
        />
        <AttentionList
          icon={<TrendingDown size={16} />}
          tone="warn"
          title="Below reorder point"
          empty="Every SKU is above its reorder point."
          items={low.map((r) => ({
            key: r.product.sku,
            href: `/inventory?sku=${r.product.sku}`,
            main: r.product.name,
            side: `${r.available} cs left, reorder at ${r.product.reorderPoint}`,
          }))}
        />
        <AttentionList
          icon={<CalendarClock size={16} />}
          tone="warn"
          title="Best-by within 30 days"
          empty="No short-dated lots."
          items={expiring.map((l) => ({
            key: l.id,
            href: `/inventory?tab=lots`,
            main: maps.product.get(l.sku)?.name ?? l.sku,
            side: `${l.qty} cs, lot ${l.code}, ${daysUntil(l.bestBy, now)} days`,
          }))}
        />
        <AttentionList
          icon={<PauseCircle size={16} />}
          tone="neutral"
          title="Held lots and accounts"
          empty="Nothing on hold."
          items={[
            ...held.map((l) => ({ key: l.id, href: `/inventory?sku=${l.sku}`, main: `${maps.product.get(l.sku)?.name}`, side: `Lot ${l.code} on QA hold` })),
            ...overCredit.map((c) => ({
              key: c.id,
              href: `/clients?id=${c.id}`,
              main: c.name,
              side: c.pastDue > 0 ? `${money(c.pastDue)} past due` : `${Math.round((c.balance / c.creditLimit) * 100)}% of credit used`,
            })),
          ]}
        />
      </div>
      <p className="mt-6 text-[13px] text-ink-3">Data refreshes every 30 seconds. Last reading {clock(now)}, {dateKey(now)}.</p>
    </div>
  );
}

function AttentionList({
  icon,
  tone,
  title,
  items,
  empty,
}: {
  icon: React.ReactNode;
  tone: "bad" | "warn" | "neutral";
  title: string;
  items: { key: string; href: string; main: string; side: string }[];
  empty: string;
}) {
  return (
    <Panel
      title={
        <span className="flex items-center gap-2">
          <span className={cx(tone === "bad" ? "text-bad" : tone === "warn" ? "text-warn" : "text-ink-3")}>{icon}</span>
          {title}
        </span>
      }
      actions={items.length ? <Badge tone={tone === "neutral" ? "neutral" : tone}>{items.length}</Badge> : undefined}
      bodyClass="max-h-[260px] overflow-y-auto scroll-thin"
    >
      {items.length === 0 ? (
        <p className="px-4 py-4 text-[14px] text-ink-3">{empty}</p>
      ) : (
        <ul className="divide-y divide-line/70">
          {items.map((it) => (
            <li key={it.key}>
              <Link href={it.href} className="block px-4 py-2 hover:bg-sunk">
                <div className="truncate text-[14px] font-semibold">{it.main}</div>
                <div className="truncate text-[13px] text-ink-3">{it.side}</div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
