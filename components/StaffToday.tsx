"use client";

import { AlertTriangle, CalendarClock, Factory, PackageSearch, PauseCircle, Snowflake } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { clock, dateTime, daysUntil, startOfDay, units } from "@/lib/format";
import { useMaps, useStock, useToday } from "@/lib/hooks";
import { STATUS_LABEL, carrierOf, isFreezing, readyAt, runKey, toMake } from "@/lib/logic";
import { useStore } from "@/lib/store";
import { AttentionList } from "./AttentionList";
import { RoutesPanel } from "./RoutesPanel";
import { PageHead, cx } from "./ui";

/**
 * Home for staff (counter, warehouse, production, dispatch): today's work queue.
 * No sales figures or account balances; those are on the owner's home.
 */
export function StaffToday() {
  const { now, today } = useToday();
  const deliveries = useStore((s) => s.deliveries);
  const runs = useStore((s) => s.runs);
  const routes = useStore((s) => s.routes);
  const lots = useStore((s) => s.lots);
  const maps = useMaps();
  const { rows } = useStock();

  const stopsToday = deliveries.filter((d) => d.date === today);
  const done = stopsToday.filter((d) => d.status === "DELIVERED").length;
  const exceptions = stopsToday.filter((d) => d.status === "EXCEPTION");
  const toLoad = stopsToday.filter((d) => d.status === "SCHEDULED" || d.status === "PICKING" || d.status === "LOADED");
  const trucksOut = routes.filter((r) => runs[runKey(r.id, today)]?.departedAt && !runs[runKey(r.id, today)]?.returnedAt).length;
  const blast = lots.filter((l) => l.qty > 0 && isFreezing(l)).sort((a, b) => readyAt(a) - readyAt(b));
  const frozen = blast.filter((l) => readyAt(l) <= now);
  const make = useMemo(() => toMake(rows.values()), [rows]);
  const expiring = lots.filter((l) => l.qty > 0 && l.status === "AVAILABLE" && daysUntil(l.bestBy, now) <= 30).sort((a, b) => a.bestBy - b.bestBy);
  const held = lots.filter((l) => l.qty > 0 && l.status === "HOLD");
  const name = (sku: string) => maps.product.get(sku)?.name ?? sku;
  const unit = (sku: string) => maps.product.get(sku)?.unit ?? "unit";

  const figures = [
    { label: "To pick and load", value: String(toLoad.length), sub: "Stops leaving today" },
    { label: "Stops delivered", value: `${done} of ${stopsToday.length}`, sub: exceptions.length ? `${exceptions.length} with a problem` : "No problems", alert: exceptions.length > 0 },
    { label: "Trucks out", value: `${trucksOut} of ${routes.length}`, sub: "Ref vans on the road now" },
    { label: "Move to freezer", value: String(frozen.length), sub: `${blast.length - frozen.length} lots still blast freezing` },
  ];

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHead
        title="Today's work"
        sub="What needs doing in the building and on the road."
        actions={
          <>
            <Link href="/production" className="btn btn-ghost">
              <Factory size={16} /> Record batch
            </Link>
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

      <div className="mb-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <AttentionList
          icon={<PackageSearch size={16} />}
          tone="accent"
          title="Pick and load"
          empty="Every stop for today has left."
          items={toLoad.map((d) => ({
            key: d.id,
            href: `/dispatch?stop=${d.id}`,
            main: maps.client.get(d.clientId)?.name ?? "",
            side: `${STATUS_LABEL[d.status]}, ${carrierOf(d, maps.route, maps.rider).label}`,
          }))}
        />
        <AttentionList
          icon={<Snowflake size={16} />}
          tone="warn"
          title="Move out of blast freezer"
          empty="Nothing frozen and waiting."
          items={blast.map((l) => {
            const at = readyAt(l);
            return {
              key: l.id,
              href: `/inventory?sku=${l.sku}`,
              main: name(l.sku),
              side: `${units(l.qty, unit(l.sku))}, lot ${l.code}, ${at <= now ? "frozen, move to freezer" : `ready ${startOfDay(at) === startOfDay(now) ? clock(at) : dateTime(at)}`}`,
            };
          })}
        />
        <AttentionList
          icon={<Factory size={16} />}
          tone="warn"
          title="To make"
          empty="Every product is above its reorder point."
          items={make.map(({ row, qty }) => ({
            key: row.product.sku,
            href: `/production?sku=${row.product.sku}`,
            main: row.product.name,
            side: `${units(row.available, row.product.unit)} left, make ${units(qty, row.product.unit)}`,
          }))}
        />
        <AttentionList
          icon={<AlertTriangle size={16} />}
          tone="bad"
          title="Delivery problems"
          empty="All stops clean so far."
          items={exceptions.map((d) => ({
            key: d.id,
            href: `/dispatch?stop=${d.id}`,
            main: maps.client.get(d.clientId)?.name ?? "",
            side: d.exception?.reason ?? "",
          }))}
        />
        <AttentionList
          icon={<CalendarClock size={16} />}
          tone="warn"
          title="Sell first"
          empty="No lots within 30 days of best-by."
          items={expiring.map((l) => ({
            key: l.id,
            href: `/inventory?sku=${l.sku}`,
            main: name(l.sku),
            side: `${units(l.qty, unit(l.sku))}, lot ${l.code}, best-by in ${daysUntil(l.bestBy, now)} days`,
          }))}
        />
        <AttentionList
          icon={<PauseCircle size={16} />}
          tone="neutral"
          title="QA hold"
          empty="No lots on hold."
          items={held.map((l) => ({
            key: l.id,
            href: `/inventory?sku=${l.sku}`,
            main: name(l.sku),
            side: `Lot ${l.code}${l.holdReason ? `, ${l.holdReason}` : ""}`,
          }))}
        />
      </div>

      <RoutesPanel today={today} />
      <p className="mt-6 text-[13px] text-ink-3">Data refreshes every 30 seconds. Last reading {clock(now)}.</p>
    </div>
  );
}
