"use client";

import { AlertTriangle, ArrowUpRight, CalendarClock, Eye, PackageCheck, PackageSearch, PauseCircle, TrendingDown, Truck, Wallet } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { AttentionList } from "@/components/AttentionList";
import { CATEGORY_ICON, CategoryTile } from "@/components/CategoryTile";
import { SortableBlocks } from "@/components/SortableBlocks";
import { ProductGrid } from "@/components/ProductGrid";
import { RoutesPanel } from "@/components/RoutesPanel";
import { StaffToday } from "@/components/StaffToday";
import { AreaTrend, Donut } from "@/components/trendCharts";
import { Badge, Delta, Empty, Panel, Segmented, Stat, cx } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { DAY, ago, clock, count, dateKey, daysUntil, money, money0, pesoK, plural, startOfDay, units } from "@/lib/format";
import { useMaps, useSales, useStock, useToday } from "@/lib/hooks";
import { STATUS_LABEL, buyerName, runKey, soldBySku } from "@/lib/logic";
import type { Category } from "@/lib/types";
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
  const belowReorder = active.filter((r) => r.available < r.product.reorderPoint).sort((a, b) => a.available / a.product.reorderPoint - b.available / b.product.reorderPoint);
  const expiring = lots.filter((l) => l.qty > 0 && daysUntil(l.bestBy, now) <= 30).sort((a, b) => a.bestBy - b.bestBy);
  const held = lots.filter((l) => l.qty > 0 && l.status === "HOLD");
  const overCredit = clients.filter((c) => c.pastDue > 0 || (c.creditLimit > 0 && c.balance > c.creditLimit * 0.9));

  return (
    <div className="space-y-6">
      <SortableBlocks
        storageKey="coldline-owner-blocks"
        className="flex flex-col gap-6"
        blocks={[
          {
            id: "stats",
            label: "Today's numbers",
            node: (
              <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3 xl:grid-cols-5">
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
            ),
          },
          {
            id: "sales",
            label: "Sales and deliveries",
            node: (
              <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-[minmax(0,2.5fr)_minmax(0,1fr)_minmax(0,1fr)]">
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
                  className="lg:col-span-2 xl:col-span-1"
                >
                  <AreaTrend data={daily} format={pesoK} height={330} label={`Sales, last ${days} days`} />
                  <p className="mt-1 text-[12.5px] text-ink-3">Order value including fees. Deliveries count once delivered, walk-ins when paid.</p>
                </Panel>

                <RoutesSummary today={today} />
                <StockHealth healthy={healthy} low={low.length} out={out.length} pct={healthyPct} expiring={expiring.length} />
              </div>
            ),
          },
          {
            id: "orders",
            label: "Orders and products",
            node: (
              <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)_minmax(0,1fr)]">
                <RecentOrders className="lg:col-span-2 xl:col-span-1" />
                <BestSeller now={now} />
                <JustProduced now={now} />
              </div>
            ),
          },
          { id: "products", label: "Product groups", node: <ProductGrid now={now} /> },
          { id: "routes", label: "Routes", node: <RoutesPanel today={today} /> },
          {
            id: "attention",
            label: "Needs attention",
            node: (
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
            ),
          },
        ]}
      />
      <p className="text-[13px] text-ink-3">
        Data refreshes every 30 seconds. Last reading {clock(now)}, {dateKey(now)}.
      </p>
    </div>
  );
}

/**
 * Today's deliveries, laid out like the reference's map card: a dark board with each van as a line of
 * stops (red once delivered), then the day's progress and a button to the delivery board.
 */
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
        list: stops.filter((d) => d.routeId === r.id && !d.riderId).sort((a, b) => a.seq - b.seq),
        state: run?.returnedAt ? "Back" : run?.departedAt ? "On the road" : "Not left",
      };
    }),
    { id: "riders", name: "Riders", list: stops.filter((d) => d.riderId), state: "Motorbikes" },
  ];
  const delivered = stops.filter((d) => d.status === "DELIVERED").length;
  const pct = stops.length ? Math.round((delivered / stops.length) * 100) : 0;
  const busiest = [...lanes].sort((a, b) => b.list.length - a.list.length)[0];

  return (
    <Panel title="Deliveries by route" bodyClass="flex flex-1 flex-col px-5 pt-1 pb-5" className="flex flex-col">
      <div className="rounded-2xl bg-ink p-4 text-white">
        <ul className="space-y-3.5">
          {lanes.map((l) => (
            <li key={l.id}>
              <div className="flex items-baseline justify-between gap-2 text-[13px]">
                <span className="truncate font-semibold">{l.name}</span>
                <span className="shrink-0 text-white/60">{l.state}</span>
              </div>
              <div
                className="mt-1.5 flex flex-wrap items-center gap-1"
                role="img"
                aria-label={`${l.name}: ${l.list.filter((d) => d.status === "DELIVERED").length} of ${l.list.length} stops delivered`}
              >
                {l.list.length === 0 && <span className="text-[12px] text-white/50">No stops today</span>}
                {l.list.map((d) => (
                  <span
                    key={d.id}
                    className={cx(
                      "h-3 w-3 rounded-full",
                      d.status === "DELIVERED"
                        ? "bg-brand"
                        : d.status === "EXCEPTION"
                          ? "bg-warn-bg ring-2 ring-brand"
                          : d.status === "EN_ROUTE" || d.status === "ARRIVED"
                            ? "bg-white"
                            : "bg-white/25",
                    )}
                  />
                ))}
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex flex-wrap gap-x-3 gap-y-1 border-t border-white/10 pt-3 text-[11.5px] text-white/60">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-brand" /> Delivered
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-white" /> On the way
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-white/25" /> Waiting
          </span>
        </div>
      </div>

      <div className="mt-4 mb-5">
        <div className="flex items-baseline justify-between gap-2 text-[14px]">
          <span className="truncate font-semibold">{busiest ? `${plural(stops.length, "stop")} today` : "No stops today"}</span>
          <span className="font-semibold">{pct}%</span>
        </div>
        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-brand-bg" aria-hidden>
          <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-1 text-[12.5px] text-ink-3">{delivered} delivered so far</div>
      </div>

      <Link href="/dispatch" className="btn btn-dark btn-lg mt-auto w-full text-[15px]">
        See all
      </Link>
    </Panel>
  );
}

/** Share of active products that are fine, low or out, and how many lots are near best-by. Like the reference's capacity guide. */
function StockHealth({ healthy, low, out, pct, expiring }: { healthy: number; low: number; out: number; pct: number; expiring: number }) {
  const total = healthy + low + out;
  const share = (n: number) => (total ? Math.round((n / total) * 100) : 0);
  const parts = [
    { label: "Healthy", value: healthy, color: "var(--color-ink)" },
    { label: "Below reorder point", value: low, color: "var(--color-brand-soft)" },
    { label: "Out of stock", value: out, color: "var(--color-brand)" },
  ];
  return (
    <Panel title="Stock health" sub="Free-to-sell stock against reorder points" className="flex flex-col" bodyClass="flex flex-1 flex-col px-5 pt-2 pb-5">
      <div className="mb-5 flex items-center gap-4">
        <Donut parts={parts} size={140} thickness={20} label={`${pct}% of products healthy`}>
          <div>
            <div className="display text-[28px] leading-none font-semibold">{pct}%</div>
            <div className="text-[11.5px] leading-tight text-ink-3">
              products
              <br />
              healthy
            </div>
          </div>
        </Donut>
        <ul className="min-w-0 flex-1 space-y-3">
          <li>
            <div className="text-[15px] font-semibold text-brand-hover">{share(low)}%</div>
            <div className="text-[13px] leading-snug text-ink-2">Products below reorder point</div>
          </li>
          <li>
            <div className="text-[15px] font-semibold text-brand">{share(out)}%</div>
            <div className="text-[13px] leading-snug text-ink-2">Products out of stock</div>
          </li>
        </ul>
      </div>
      <div className="mt-auto border-t border-line pt-4">
        <div className="text-[14.5px] text-ink-2">Short-dated lots</div>
        <div className="display mt-2 text-[30px] leading-none font-semibold">{plural(expiring, "lot")}</div>
        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="text-[12.5px] text-ink-3">Best-by within 30 days</span>
          <Link href="/inventory?tab=lots" className="btn btn-ghost btn-sm">
            Sell first <ArrowUpRight size={14} />
          </Link>
        </div>
      </div>
    </Panel>
  );
}

const STATUS_TEXT: Record<string, string> = {
  DELIVERED: "text-good",
  EXCEPTION: "text-bad",
  EN_ROUTE: "text-warn",
  ARRIVED: "text-warn",
};

/** Latest orders as a table, like the reference's Sales & Order: buyer, order, amount, status in color, and an action. */
function RecentOrders({ className }: { className?: string }) {
  const orders = useStore((s) => s.orders);
  const deliveries = useStore((s) => s.deliveries);
  const maps = useMaps();
  const byId = useMemo(() => new Map(deliveries.map((d) => [d.id, d])), [deliveries]);
  const recent = useMemo(() => [...orders].sort((a, b) => b.createdAt - a.createdAt).slice(0, 6), [orders]);

  return (
    <Panel
      title="Sales & orders"
      className={className}
      actions={
        <Link href="/orders" className="btn btn-ghost btn-sm h-9 rounded-full px-3.5">
          All orders <ArrowUpRight size={14} />
        </Link>
      }
      bodyClass="overflow-x-auto pb-2 scroll-thin"
    >
      {recent.length ? (
        <table className="tbl min-w-[620px]">
          <thead>
            <tr>
              <th className="pl-5">Order details</th>
              <th>Order ID</th>
              <th className="r">Amount</th>
              <th>Delivery status</th>
              <th className="r pr-5">Actions</th>
            </tr>
          </thead>
          <tbody>
            {recent.map((o) => {
              const d = o.deliveryId ? byId.get(o.deliveryId) : undefined;
              const first = maps.product.get(o.lines[0]?.sku ?? "");
              const status = o.status === "CANCELLED" ? "Cancelled" : d ? STATUS_LABEL[d.status] : "Sold at counter";
              const tone = o.status === "CANCELLED" ? "text-ink-3" : d ? (STATUS_TEXT[d.status] ?? "text-ink-2") : "text-good";
              return (
                <tr key={o.id}>
                  <td className="pl-5">
                    <div className="flex items-center gap-3">
                      {first ? <CategoryTile category={first.category} size="md" /> : null}
                      <div className="min-w-0">
                        <div className="truncate font-semibold">{buyerName(o, maps.client.get(o.clientId))}</div>
                        <div className="text-[12.5px] text-ink-3">
                          {o.fulfillment === "PICKUP" ? "Walk-in" : o.channel === "ONLINE" ? "Online" : "Delivery"}, {plural(o.lines.length, "item")}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="code text-ink-2">#{o.number}</td>
                  <td className="r font-semibold">{money(o.total)}</td>
                  <td className={cx("font-semibold", tone)}>{status}</td>
                  <td className="r pr-5">
                    <Link href={`/orders?id=${o.id}`} className="btn btn-quiet btn-sm px-2" aria-label={`Open ${o.number}`}>
                      <Eye size={17} />
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

/** The product that sold the most in the last 7 days, against what is free to sell. Like the reference's best-selling card. */
function BestSeller({ now }: { now: number }) {
  const sales = useSales();
  const maps = useMaps();
  const { rows } = useStock();
  const sold = useMemo(() => soldBySku(sales, startOfDay(now) - 6 * DAY), [sales, now]);
  const top = [...sold.entries()].sort((a, b) => b[1] - a[1])[0];
  const p = top ? maps.product.get(top[0]) : undefined;
  const row = p ? rows.get(p.sku) : undefined;

  return (
    <Panel title="Best selling product" className="flex flex-col" bodyClass="flex flex-1 flex-col px-5 pt-2 pb-5">
      {p && top ? (
        <div className="relative flex flex-1 flex-col">
          {/* Stacked cards behind, as in the reference */}
          <div className="absolute inset-x-6 -top-1 h-6 rounded-2xl bg-sunk" aria-hidden />
          <div className="relative flex flex-1 flex-col rounded-2xl border border-line bg-sunk p-3 shadow-card">
            <BestSellerArt category={p.category} />
            <div className="mt-3 flex items-end justify-between gap-3 px-1">
              <div className="min-w-0">
                <div className="truncate text-[15.5px] font-semibold">{p.name}</div>
                <div className="mt-0.5 text-[12.5px] text-ink-3">
                  Sold <span className="font-semibold text-ink-2">{count(top[1])}</span>
                  <span className="mx-2">
                    Free <span className="font-semibold text-ink-2">{count(row?.available ?? 0)}</span>
                  </span>
                </div>
              </div>
              <Link href={`/production?sku=${p.sku}`} className="btn btn-dark shrink-0 rounded-xl">
                Make more
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

/** Latest production batches as a small table, like the reference's newly arrived stock. */
function JustProduced({ now }: { now: number }) {
  const batches = useStore((s) => s.batches);
  const maps = useMaps();
  const latest = useMemo(() => [...batches].sort((a, b) => b.madeAt - a.madeAt).slice(0, 5), [batches]);
  return (
    <Panel title="Newly produced stock">
      {latest.length ? (
        <table className="w-full text-[14px]">
          <thead>
            <tr className="text-left text-[13px] text-ink-3">
              <th className="pb-2 font-medium">Products</th>
              <th className="pb-2 text-right font-medium">Qty</th>
              <th className="pb-2 text-right font-medium">Made</th>
            </tr>
          </thead>
          <tbody>
            {latest.map((b) => {
              const p = maps.product.get(b.sku);
              return (
                <tr key={b.id}>
                  <td className="py-2">
                    <Link href={`/inventory?sku=${b.sku}`} className="flex items-center gap-3 hover:underline">
                      {p && <CategoryTile category={p.category} size="md" className="rounded-full" />}
                      <span className="min-w-0">
                        <span className="code block text-[11.5px] text-ink-3">{b.sku}</span>
                        <span className="block max-w-[150px] truncate font-semibold">{p?.name ?? b.sku}</span>
                      </span>
                    </Link>
                  </td>
                  <td className="py-2 text-right font-semibold">{count(b.qty)}</td>
                  <td className="py-2 text-right text-[13px] whitespace-nowrap text-ink-3">{ago(b.madeAt, now)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <Empty title="No batches yet">Record a batch on Production.</Empty>
      )}
    </Panel>
  );
}

/** The best seller's picture: its category icon large on a black panel, standing in for a product photo. */
function BestSellerArt({ category }: { category: Category }) {
  const Icon = CATEGORY_ICON[category];
  return (
    <div className="grid min-h-36 flex-1 place-items-center rounded-xl bg-ink text-white" aria-hidden>
      <Icon size={56} strokeWidth={1.4} />
    </div>
  );
}
