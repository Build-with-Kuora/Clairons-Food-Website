"use client";

import { AlertTriangle, ArrowUpRight, CalendarClock, Eye, Factory, PackageCheck, PackageSearch, PauseCircle, TrendingDown, Truck, Wallet } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { AttentionList } from "@/components/AttentionList";
import { CategoryTile } from "@/components/CategoryTile";
import { ProductGrid } from "@/components/ProductGrid";
import { RoutesPanel } from "@/components/RoutesPanel";
import { StaffToday } from "@/components/StaffToday";
import { AreaTrend, Donut } from "@/components/trendCharts";
import { Badge, Delta, Empty, Panel, Segmented, Stat, StatusPill, cx } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { DAY, ago, clock, count, dateKey, daysUntil, money, money0, pesoK, plural, startOfDay, units } from "@/lib/format";
import { useMaps, useSales, useStock, useToday } from "@/lib/hooks";
import { buyerName, runKey, soldBySku } from "@/lib/logic";
import { useStore } from "@/lib/store";

/** Home is different per role: the owner gets sales and money, staff get today's work. Riders never land here. */
export default function Home() {
  const role = useAuth((s) => s.user?.role);
  return role === "admin" ? <OwnerToday /> : <StaffToday />;
}

const PERIODS = [
  { id: "7", label: "7 days" },
  { id: "14", label: "14 days" },
  { id: "30", label: "30 days" },
] as const;
type PeriodId = (typeof PERIODS)[number]["id"];

function OwnerToday() {
  const { now, today } = useToday();
  const deliveries = useStore((s) => s.deliveries);
  const runs = useStore((s) => s.runs);
  const routes = useStore((s) => s.routes);
  const lots = useStore((s) => s.lots);
  const clients = useStore((s) => s.clients);
  const maps = useMaps();
  const { rows } = useStock();
  const [period, setPeriod] = useState<PeriodId>("14");

  const dayStart = startOfDay(now);
  const sales = useSales();
  const todays = sales.filter((s) => s.at >= dayStart);
  const soldToday = todays.reduce((t, s) => t + s.total, 0);
  // Compare with yesterday up to this time of day, so a morning isn't measured against a whole day.
  const soldYesterday = sales.filter((s) => s.at >= dayStart - DAY && s.at < now - DAY).reduce((t, s) => t + s.total, 0);
  const stopsToday = deliveries.filter((d) => d.date === today);
  const done = stopsToday.filter((d) => d.status === "DELIVERED").length;
  const exceptions = stopsToday.filter((d) => d.status === "EXCEPTION");
  const toPick = deliveries.filter((d) => d.status === "SCHEDULED" || d.status === "PICKING").length;
  const trucksOut = routes.filter((r) => runs[runKey(r.id, today)]?.departedAt && !runs[runKey(r.id, today)]?.returnedAt).length;

  const days = Number(period);
  const daily = useMemo(() => {
    const out: { label: string; sub: string; value: number; note: string }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const s = startOfDay(dayStart - i * DAY + 2 * 3_600_000);
      const e = s + DAY;
      const os = sales.filter((x) => x.at >= s && x.at < e);
      out.push({
        label: i === 0 ? "Today" : new Date(s).toLocaleDateString("en-US", days > 14 ? { month: "short", day: "numeric" } : { weekday: "short", day: "numeric" }),
        sub: new Date(s).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
        value: os.reduce((t, o) => t + o.total, 0),
        note: plural(os.length, "sale"),
      });
    }
    return out;
  }, [sales, dayStart, days]);
  const periodTotal = daily.reduce((t, d) => t + d.value, 0);
  const periodStart = startOfDay(dayStart - (days - 1) * DAY + 2 * 3_600_000);
  const prevTotal = sales.filter((s) => s.at >= periodStart - days * DAY && s.at < periodStart).reduce((t, s) => t + s.total, 0);

  const active = [...rows.values()].filter((r) => r.product.active);
  const out = active.filter((r) => r.available <= 0);
  const low = active.filter((r) => r.available > 0 && r.available < r.product.reorderPoint);
  const healthy = active.length - out.length - low.length;
  const healthyPct = active.length ? Math.round((healthy / active.length) * 100) : 0;
  const belowReorder = active
    .filter((r) => r.available < r.product.reorderPoint)
    .sort((a, b) => a.available / a.product.reorderPoint - b.available / b.product.reorderPoint);
  const expiring = lots.filter((l) => l.qty > 0 && daysUntil(l.bestBy, now) <= 30).sort((a, b) => a.bestBy - b.bestBy);
  const held = lots.filter((l) => l.qty > 0 && l.status === "HOLD");
  const overCredit = clients.filter((c) => c.pastDue > 0 || (c.creditLimit > 0 && c.balance > c.creditLimit * 0.9));

  return (
    <div className="mx-auto max-w-[1500px] space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
        <Stat
          dark
          icon={<Wallet size={20} />}
          label="Sold today"
          value={money0(soldToday)}
          href="/sales"
          foot={
            <>
              <Delta now={soldToday} prev={soldYesterday} onDark /> vs this time yesterday
            </>
          }
        />
        <Stat
          icon={<PackageCheck size={20} />}
          label="Stops delivered"
          value={`${done} of ${stopsToday.length}`}
          href="/dispatch"
          foot={exceptions.length ? <Badge tone="bad">{plural(exceptions.length, "exception")}</Badge> : "No exceptions so far"}
        />
        <Stat icon={<Truck size={20} />} label="Trucks out" value={`${trucksOut} of ${routes.length}`} href="/dispatch" foot="Ref vans on the road now" />
        <Stat icon={<PackageSearch size={20} />} label="Orders to pick" value={count(toPick)} href="/dispatch" foot="Scheduled or picking" />
        <Stat
          tone="bad"
          icon={<AlertTriangle size={20} />}
          label="Below reorder point"
          value={plural(belowReorder.length, "product")}
          href="/inventory?filter=low"
          foot={out.length ? <Badge tone="bad">{count(out.length)} out of stock</Badge> : "None out of stock"}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,330px)] 2xl:grid-cols-[minmax(0,1fr)_330px_330px]">
        <Panel
          title={
            <span className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
              Sales
              <span className="display text-[26px] font-semibold">{money0(periodTotal)}</span>
              <span className="flex items-center gap-1.5 font-sans text-[13px] font-normal text-ink-3">
                <Delta now={periodTotal} prev={prevTotal} /> vs the {days} days before
              </span>
            </span>
          }
          actions={<Segmented label="Period" options={[...PERIODS]} value={period} onChange={setPeriod} />}
          className="xl:row-span-2 2xl:row-span-1"
        >
          <AreaTrend data={daily} format={pesoK} height={270} label={`Sales, last ${days} days`} />
          <p className="mt-1 text-[12.5px] text-ink-3">Order value including fees. Deliveries count once delivered, walk-ins when paid.</p>
        </Panel>

        <RoutesSummary today={today} />
        <StockHealth healthy={healthy} low={low.length} out={out.length} pct={healthyPct} expiring={expiring.length} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,330px)] 2xl:grid-cols-[minmax(0,1fr)_330px_330px]">
        <RecentOrders />
        <BestSeller now={now} />
        <JustProduced now={now} className="xl:col-span-2 2xl:col-span-1" />
      </div>

      <ProductGrid now={now} />

      <RoutesPanel today={today} />

      <section>
        <h2 className="display mb-3 text-[22px] font-semibold">Needs attention</h2>
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
            items={belowReorder.map((r) => ({
              key: r.product.sku,
              href: `/inventory?sku=${r.product.sku}`,
              main: r.product.name,
              side: `${units(r.available, r.product.unit)} left, reorder at ${r.product.reorderPoint}`,
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
              side: `${units(l.qty, maps.product.get(l.sku)?.unit ?? "unit")}, lot ${l.code}, ${daysUntil(l.bestBy, now)} days`,
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
      </section>
      <p className="text-[13px] text-ink-3">
        Data refreshes every 30 seconds. Last reading {clock(now)}, {dateKey(now)}.
      </p>
    </div>
  );
}

/** Today's stops per van route, and the motorbike riders as one more row. */
function RoutesSummary({ today }: { today: string }) {
  const deliveries = useStore((s) => s.deliveries);
  const runs = useStore((s) => s.runs);
  const routes = useStore((s) => s.routes);
  const stops = deliveries.filter((d) => d.date === today);
  const lanes = [
    ...routes.map((r) => {
      const run = runs[runKey(r.id, today)];
      return {
        id: r.id,
        name: r.name,
        sub: r.truck,
        list: stops.filter((d) => d.routeId === r.id && !d.riderId),
        state: run?.returnedAt ? "Back at the plant" : run?.departedAt ? "On the road" : "Not left yet",
      };
    }),
    { id: "riders", name: "Riders", sub: "Motorbike drops", list: stops.filter((d) => d.riderId), state: "" },
  ];
  const all = stops.length;
  const delivered = stops.filter((d) => d.status === "DELIVERED").length;

  return (
    <Panel title="Deliveries by route" sub={`${delivered} of ${plural(all, "stop")} delivered today`} bodyClass="flex flex-col px-5 pt-2 pb-5">
      <ul className="space-y-4">
        {lanes.map((l) => {
          const done = l.list.filter((d) => d.status === "DELIVERED").length;
          const problem = l.list.some((d) => d.status === "EXCEPTION");
          const pct = l.list.length ? Math.round((done / l.list.length) * 100) : 0;
          return (
            <li key={l.id}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-[14.5px] font-semibold">{l.name}</span>
                <span className="text-[13px] whitespace-nowrap text-ink-2">
                  {done} of {l.list.length}
                </span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-sunk" role="img" aria-label={`${l.name}: ${done} of ${l.list.length} stops delivered`}>
                <div className={cx("h-full rounded-full", problem ? "bg-bad" : "bg-brand")} style={{ width: `${pct}%` }} />
              </div>
              <div className="mt-1 text-[12.5px] text-ink-3">
                {[l.sub, l.state, problem && "has an exception"].filter(Boolean).join(", ")}
              </div>
            </li>
          );
        })}
      </ul>
      <Link href="/dispatch" className="btn btn-dark btn-lg mt-5 w-full">
        See all deliveries
      </Link>
    </Panel>
  );
}

/** Share of active products that are fine, low or out, and how many lots are near best-by. */
function StockHealth({ healthy, low, out, pct, expiring }: { healthy: number; low: number; out: number; pct: number; expiring: number }) {
  const parts = [
    { label: "Healthy", value: healthy, color: "var(--color-ink)" },
    { label: "Below reorder point", value: low, color: "var(--color-brand-soft)" },
    { label: "Out of stock", value: out, color: "var(--color-brand)" },
  ];
  return (
    <Panel title="Stock health" sub="Free-to-sell stock against reorder points">
      <div className="flex flex-wrap items-center gap-5">
        <Donut parts={parts} size={150} thickness={20} label={`${pct}% of products healthy`}>
          <div>
            <div className="display text-[30px] leading-none font-semibold">{pct}%</div>
            <div className="text-[12px] text-ink-3">healthy</div>
          </div>
        </Donut>
        <ul className="min-w-0 flex-1 space-y-2 text-[13.5px]">
          {parts.map((p) => (
            <li key={p.label} className="flex items-center gap-2">
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: p.color }} aria-hidden />
              <span className="flex-1 text-ink-2">{p.label}</span>
              <span className="font-semibold">{p.value}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-5 border-t border-line pt-4">
        <div className="text-[14px] text-ink-2">Short-dated lots</div>
        <div className="mt-1 flex items-end justify-between gap-2">
          <div className="display text-[28px] leading-none font-semibold">{plural(expiring, "lot")}</div>
          <Link href="/inventory?tab=lots" className="btn btn-ghost btn-sm">
            View lots <ArrowUpRight size={14} />
          </Link>
        </div>
        <div className="mt-1 text-[12.5px] text-ink-3">Best-by within 30 days. Sell these first.</div>
      </div>
    </Panel>
  );
}

function RecentOrders() {
  const orders = useStore((s) => s.orders);
  const deliveries = useStore((s) => s.deliveries);
  const maps = useMaps();
  const byId = useMemo(() => new Map(deliveries.map((d) => [d.id, d])), [deliveries]);
  const recent = useMemo(() => [...orders].sort((a, b) => b.createdAt - a.createdAt).slice(0, 7), [orders]);

  return (
    <Panel
      title="Recent orders"
      sub="Latest from the counter and the online store"
      actions={
        <Link href="/orders" className="btn btn-ghost btn-sm">
          All orders <ArrowUpRight size={14} />
        </Link>
      }
      bodyClass="overflow-x-auto pb-2 scroll-thin"
    >
      {recent.length ? (
        <table className="tbl min-w-[620px]">
          <thead>
            <tr>
              <th className="pl-5">Customer</th>
              <th>Order</th>
              <th className="r">Amount</th>
              <th>Status</th>
              <th className="r pr-5">
                <span className="sr-only">Open</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {recent.map((o) => {
              const d = o.deliveryId ? byId.get(o.deliveryId) : undefined;
              return (
                <tr key={o.id}>
                  <td className="pl-5">
                    <div className="font-semibold">{buyerName(o, maps.client.get(o.clientId))}</div>
                    <div className="text-[12.5px] text-ink-3">
                      {o.fulfillment === "PICKUP" ? "Walk-in" : o.channel === "ONLINE" ? "Online, delivery" : "Delivery"}, {plural(o.lines.length, "line")}
                    </div>
                  </td>
                  <td className="code text-ink-2">{o.number}</td>
                  <td className="r font-semibold">{money(o.total)}</td>
                  <td>{o.status === "CANCELLED" ? <Badge>Cancelled</Badge> : d ? <StatusPill status={d.status} /> : <Badge tone="good">Sold at counter</Badge>}</td>
                  <td className="r pr-5">
                    <Link href={`/orders?id=${o.id}`} className="btn btn-quiet btn-sm px-2" aria-label={`Open ${o.number}`}>
                      <Eye size={16} />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <Empty title="No orders yet">Orders from the POS and the online store show up here.</Empty>
      )}
    </Panel>
  );
}

/** The product that sold the most cases in the last 7 days, against what is free to sell. */
function BestSeller({ now }: { now: number }) {
  const sales = useSales();
  const maps = useMaps();
  const { rows } = useStock();
  const sold = useMemo(() => soldBySku(sales, startOfDay(now) - 6 * DAY), [sales, now]);
  const top = [...sold.entries()].sort((a, b) => b[1] - a[1])[0];
  const p = top ? maps.product.get(top[0]) : undefined;
  const row = p ? rows.get(p.sku) : undefined;

  return (
    <Panel title="Best seller this week">
      {p && top ? (
        <div>
          <div className="relative overflow-hidden rounded-2xl bg-ink p-5 text-white">
            <CategoryTile category={p.category} size="lg" onDark />
            <div className="mt-4 text-[17px] leading-snug font-semibold">{p.name}</div>
            <div className="text-[13px] text-white/70">
              <span className="code">{p.sku}</span>, {p.category}
            </div>
            <div className="mt-4 flex items-end justify-between gap-3">
              <div className="text-[13px] text-white/75">
                Sold <span className="font-semibold text-white">{units(top[1], p.unit)}</span>
                <br />
                Free to sell <span className="font-semibold text-white">{units(row?.available ?? 0, p.unit)}</span>
              </div>
              <Link href={`/production?sku=${p.sku}`} className="btn btn-primary">
                <Factory size={15} /> Make more
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <Empty title="No sales this week">The top product shows here once something sells.</Empty>
      )}
    </Panel>
  );
}

function JustProduced({ now, className }: { now: number; className?: string }) {
  const batches = useStore((s) => s.batches);
  const maps = useMaps();
  const latest = useMemo(() => [...batches].sort((a, b) => b.madeAt - a.madeAt).slice(0, 5), [batches]);
  return (
    <Panel
      title="Just produced"
      className={className}
      actions={
        <Link href="/production" className="btn btn-ghost btn-sm">
          Production <ArrowUpRight size={14} />
        </Link>
      }
    >
      {latest.length ? (
        <ul className="divide-y divide-line/80">
          {latest.map((b) => {
            const p = maps.product.get(b.sku);
            return (
              <li key={b.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                {p && <CategoryTile category={p.category} size="md" />}
                <div className="min-w-0 flex-1">
                  <div className="code text-[11.5px] text-ink-3">{b.sku}</div>
                  <div className="truncate text-[14px] font-semibold">{p?.name ?? b.sku}</div>
                </div>
                <div className="text-right">
                  <div className="text-[14px] font-semibold">{units(b.qty, p?.unit ?? "case")}</div>
                  <div className="text-[12px] text-ink-3">{ago(b.madeAt, now)}</div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <Empty title="No batches yet">Record a batch on Production.</Empty>
      )}
    </Panel>
  );
}
