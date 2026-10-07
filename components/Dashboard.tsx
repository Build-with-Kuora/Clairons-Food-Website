"use client";

import { AlertTriangle, CalendarClock, PackageCheck, PackageSearch, PauseCircle, TrendingDown, Wallet } from "lucide-react";
import { useMemo, useState } from "react";
import { AttentionList } from "@/components/AttentionList";
import { SortableBlocks } from "@/components/SortableBlocks";
import { ProductGrid } from "@/components/ProductGrid";
import { RoutesPanel } from "@/components/RoutesPanel";
import { StaffToday } from "@/components/StaffToday";
import { AreaTrend } from "@/components/trendCharts";
import { Badge, Delta, Panel, Segmented, Stat } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { DAY, count, dayShort, daysUntil, keyToTs, money, money0, pesoK, plural, startOfDay, units } from "@/lib/format";
import { useMaps, useSales, useStock, useToday } from "@/lib/hooks";
import { buyerName, openProblems, runKey } from "@/lib/logic";
import { useStore } from "@/lib/store";

/** Home is different per role: the owner gets sales and money, staff get today's work. Riders never land here. */
export function Dashboard() {
  const role = useAuth((s) => s.user?.role);
  return role === "admin" ? <OwnerToday /> : <StaffToday />;
}

const PERIODS = [
  { id: "7", label: "Last 7 days" },
  { id: "14", label: "Last 14 days" },
  { id: "30", label: "Last 30 days" },
] as const;
type PeriodId = (typeof PERIODS)[number]["id"];

function OwnerToday() {
  const { now, today } = useToday();
  const deliveries = useStore((s) => s.deliveries);
  const runs = useStore((s) => s.runs);
  const routes = useStore((s) => s.routes);
  const lots = useStore((s) => s.lots);
  const clients = useStore((s) => s.clients);
  const orders = useStore((s) => s.orders);
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
  const problems = openProblems(deliveries);
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
  const belowReorder = active.filter((r) => r.available < r.product.reorderPoint).sort((a, b) => a.available / a.product.reorderPoint - b.available / b.product.reorderPoint);
  const expiring = lots.filter((l) => l.qty > 0 && daysUntil(l.bestBy, now) <= 30).sort((a, b) => a.bestBy - b.bestBy);
  const held = lots.filter((l) => l.qty > 0 && l.status === "HOLD");
  const refunds = orders.filter((o) => o.refund && !o.refund.at);
  const overCredit = clients.filter((c) => c.pastDue > 0 || (c.creditLimit > 0 && c.balance > c.creditLimit * 0.9));

  return (
    <SortableBlocks
      storageKey="coldline-owner-blocks"
      className="flex flex-col gap-6"
      blocks={[
        {
          id: "stats",
          label: "Today's numbers",
          node: (
            <div className="grid gap-4 sm:grid-cols-2 sm:gap-5 xl:grid-cols-4">
              <Stat
                dark
                icon={<Wallet size={22} />}
                label="Sold today"
                value={money0(soldToday)}
                href="/sales"
                foot={
                  <>
                    <Delta now={soldToday} prev={soldYesterday} onDark /> compared with this time yesterday
                  </>
                }
              />
              <Stat
                icon={<PackageCheck size={22} />}
                label="Deliveries done"
                value={`${done} of ${stopsToday.length}`}
                href="/dispatch"
                foot={
                  <>
                    {exceptions.length ? <Badge tone="bad">{plural(exceptions.length, "problem")}</Badge> : <span>No problems so far.</span>}
                    <span>
                      {trucksOut} of {routes.length} vans on the road
                    </span>
                  </>
                }
              />
              <Stat icon={<PackageSearch size={22} />} label="Orders to pack" value={count(toPick)} href="/dispatch" foot="Waiting to be packed for delivery" />
              <Stat
                tone="bad"
                icon={<AlertTriangle size={22} />}
                label="Running low"
                value={plural(belowReorder.length, "product")}
                href="/inventory?filter=low"
                foot={out.length ? <Badge tone="bad">{count(out.length)} out of stock</Badge> : "None out of stock"}
              />
            </div>
          ),
        },
        { id: "products", label: "Products", node: <ProductGrid now={now} /> },
        {
          id: "sales",
          label: "Sales",
          node: (
            <Panel
              title={
                <span className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                  Sales
                  <span className="display text-heading font-semibold">{money0(periodTotal)}</span>
                  <span className="flex items-center gap-2 font-sans text-small font-normal text-ink-2">
                    <Delta now={periodTotal} prev={prevTotal} /> compared with the {days} days before
                  </span>
                </span>
              }
              actions={<Segmented label="Period" options={[...PERIODS]} value={period} onChange={setPeriod} />}
            >
              <AreaTrend data={daily} format={pesoK} height={320} label={`Sales, last ${days} days`} />
              <p className="mt-2 hint">Includes delivery fees. A delivery counts once it is delivered; a walk-in counts when paid.</p>
            </Panel>
          ),
        },
        { id: "routes", label: "Routes", node: <RoutesPanel today={today} /> },
        {
          id: "attention",
          label: "Needs attention",
          node: (
            <section>
              <h2 className="display mb-4 text-heading font-semibold">Needs attention</h2>
              <div className="grid gap-5 lg:grid-cols-2">
                <AttentionList
                  icon={<AlertTriangle size={20} />}
                  tone="bad"
                  title="Delivery problems"
                  empty="All deliveries are fine so far."
                  items={problems.map((d) => ({
                    key: d.id,
                    href: `/dispatch?stop=${d.id}`,
                    main: maps.client.get(d.clientId)?.name ?? "",
                    side: `${d.exception?.reason ?? "Problem"}${d.date === today ? "" : `, ${dayShort(keyToTs(d.date))}`}. Resolve it on Delivery.`,
                  }))}
                />
                <AttentionList
                  icon={<TrendingDown size={20} />}
                  tone="warn"
                  title="Running low"
                  empty="Every product has enough stock."
                  items={belowReorder.map((r) => ({
                    key: r.product.sku,
                    href: `/inventory?sku=${r.product.sku}`,
                    main: r.product.name,
                    side: `${units(r.available, r.product.unit)} left. Make more when under ${r.product.reorderPoint}.`,
                  }))}
                />
                <AttentionList
                  icon={<CalendarClock size={20} />}
                  tone="warn"
                  title="Sell first, expiring soon"
                  empty="Nothing is close to its best-by date."
                  items={expiring.map((l) => ({
                    key: l.id,
                    href: `/inventory?tab=lots`,
                    main: maps.product.get(l.sku)?.name ?? l.sku,
                    side: `${units(l.qty, maps.product.get(l.sku)?.unit ?? "unit")}, ${plural(daysUntil(l.bestBy, now), "day")} left (batch ${l.code})`,
                  }))}
                />
                <AttentionList
                  icon={<PauseCircle size={20} />}
                  tone="neutral"
                  title="On hold and money to settle"
                  empty="Nothing on hold, no overdue accounts and no refunds owed."
                  items={[
                    ...refunds.map((o) => ({
                      key: o.id,
                      href: `/orders?id=${o.id}`,
                      main: buyerName(o, maps.client.get(o.clientId)),
                      side: `Refund owed ${money(o.refund!.amount)} ${o.status === "CANCELLED" ? "for a cancelled order" : "for refused cases"}`,
                    })),
                    ...held.map((l) => ({ key: l.id, href: `/inventory?sku=${l.sku}`, main: `${maps.product.get(l.sku)?.name}`, side: `Batch ${l.code} held for a quality check` })),
                    ...overCredit.map((c) => ({
                      key: c.id,
                      href: `/clients?id=${c.id}`,
                      main: c.name,
                      side: c.pastDue > 0 ? `${money(c.pastDue)} overdue` : `${Math.round((c.balance / c.creditLimit) * 100)}% of credit limit used`,
                    })),
                  ]}
                />
              </div>
            </section>
          ),
        },
      ]}
    />
  );
}
