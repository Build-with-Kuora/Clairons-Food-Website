"use client";

import { Truck } from "lucide-react";
import { useMemo, useState } from "react";
import { DeliveryDetail } from "@/components/DeliveryDetail";
import { DeliveryTable } from "@/components/DeliveryTable";
import { RiderList } from "@/components/RiderList";
import { RouteLine } from "@/components/RouteLine";
import { Badge, Empty, PageHead, Panel, StatusPill, Tabs, cx } from "@/components/ui";
import { clock, dateKey, dayShort, keyToTs, tempBare } from "@/lib/format";
import { queryParam, useMaps, useNow } from "@/lib/hooks";
import { TRUCK_LIMIT_C, runKey } from "@/lib/logic";
import { useStore, useUi } from "@/lib/store";

type View = "routes" | "table" | "riders";

export default function Dispatch() {
  const deliveries = useStore((s) => s.deliveries);
  const routes = useStore((s) => s.routes);
  const runs = useStore((s) => s.runs);
  const dispatchRoute = useStore((s) => s.dispatchRoute);
  const toast = useUi((s) => s.toast);
  const maps = useMaps();
  const now = useNow(20_000);
  const today = dateKey(now);

  const dates = useMemo(() => {
    const ds = [...new Set(deliveries.map((d) => d.date))].filter((d) => d >= today).sort();
    return ds.length ? ds : [today];
  }, [deliveries, today]);
  const [init] = useState(() => {
    const all = useStore.getState().deliveries;
    const day = dateKey(Date.now());
    const stop = all.find((x) => x.id === queryParam("stop"));
    if (stop) return { date: stop.date, sel: stop.id };
    const route = queryParam("route");
    const first = all.filter((x) => x.routeId === route && x.date === day).sort((a, b) => a.seq - b.seq)[0];
    return { date: day, sel: first?.id };
  });
  const [view, setView] = useState<View>(() => (queryParam("view") as View | null) ?? "routes");
  const [date, setDate] = useState(init.date);
  const [sel, setSel] = useState<string | undefined>(init.sel);

  const stops = deliveries.filter((d) => d.date === date);
  const riderStops = stops.filter((d) => d.riderId);
  const selected = deliveries.find((d) => d.id === sel) ?? stops.find((d) => d.status === "EXCEPTION") ?? stops.find((d) => d.status === "ARRIVED") ?? stops[0];
  const counts = {
    done: stops.filter((d) => d.status === "DELIVERED").length,
    road: stops.filter((d) => d.status === "EN_ROUTE" || d.status === "ARRIVED").length,
    dock: stops.filter((d) => ["SCHEDULED", "PICKING", "LOADED"].includes(d.status)).length,
    exc: stops.filter((d) => d.status === "EXCEPTION").length,
  };

  return (
    <div className="mx-auto max-w-[1600px]">
      <PageHead
        title="Delivery"
        sub={
          <>
            {stops.length} stops: {counts.done} delivered, {counts.road} on the road, {counts.dock} still at the dock
            {counts.exc > 0 && <span className="font-semibold text-bad">, {counts.exc} exception{counts.exc > 1 ? "s" : ""}</span>}.
          </>
        }
        actions={
          <div className="flex gap-1 rounded-md border border-line bg-panel p-0.5" role="radiogroup" aria-label="Delivery day">
            {dates.slice(0, 5).map((d) => (
              <button
                key={d}
                role="radio"
                aria-checked={date === d}
                onClick={() => {
                  setDate(d);
                  setSel(undefined);
                }}
                className={cx("h-8 cursor-pointer rounded px-3 text-[13.5px] font-semibold", date === d ? "bg-ink text-white" : "text-ink-2 hover:bg-sunk")}
              >
                {d === today ? "Today" : dayShort(keyToTs(d)).replace(/,.*/, "") + " " + new Date(keyToTs(d)).getDate()}
              </button>
            ))}
          </div>
        }
      />

      <div className="mb-4">
        <Tabs<View>
          value={view}
          onChange={setView}
          tabs={[
            { id: "routes", label: "Routes" },
            { id: "table", label: "Table", count: stops.length || undefined },
            { id: "riders", label: "Riders" },
          ]}
        />
      </div>

      <div className="grid items-start gap-5 2xl:grid-cols-[minmax(0,1fr)_620px] xl:grid-cols-[minmax(0,1fr)_540px]">
        <div className="space-y-5">
          {view === "table" && (
            <Panel title="Deliveries" bodyClass="p-0">
              <DeliveryTable stops={stops} selectedId={selected?.id} onSelect={setSel} />
            </Panel>
          )}
          {view === "riders" && <RiderList />}
          {view === "routes" && riderStops.length > 0 && (
            <Panel title="Rider drops" actions={<span className="text-[13px] text-ink-3">Motorbike, no temperature log</span>} bodyClass="p-0">
              <DeliveryTable stops={riderStops} selectedId={selected?.id} onSelect={setSel} />
            </Panel>
          )}
          {view === "routes" && routes.map((r) => {
            const rs = stops.filter((d) => d.routeId === r.id && !d.riderId).sort((a, b) => a.seq - b.seq);
            const run = runs[runKey(r.id, date)];
            const last = run?.temps.at(-1);
            const loaded = rs.filter((d) => d.status === "LOADED").length;
            const notLoaded = rs.filter((d) => d.status === "SCHEDULED" || d.status === "PICKING").length;
            const cases = rs.reduce((s, d) => s + (maps.order.get(d.orderId)?.lines.reduce((t, l) => t + l.qty, 0) ?? 0), 0);
            return (
              <Panel
                key={r.id}
                title={
                  <span className="flex items-center gap-3">
                    {r.name}
                    <span className="text-[14px] font-medium text-ink-3">
                      {r.truck}, {r.driver}
                    </span>
                  </span>
                }
                actions={
                  <>
                    {last && date === today && (
                      <span className={cx("text-[13px] font-semibold whitespace-nowrap", last.c > TRUCK_LIMIT_C ? "text-bad" : "text-ink-2")}>
                        Box {tempBare(last.c)}C
                      </span>
                    )}
                    {!run?.departedAt && loaded > 0 && date === today && (
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => {
                          dispatchRoute(r.id, date, "Dispatch");
                          toast(`${r.truck} dispatched with ${loaded} stops${notLoaded ? `, ${notLoaded} left at dock` : ""}`);
                        }}
                      >
                        <Truck size={14} /> Dispatch truck
                      </button>
                    )}
                    {run?.departedAt && <Badge tone="accent">Out since {clock(run.departedAt)}</Badge>}
                  </>
                }
                bodyClass=""
              >
                {rs.length === 0 ? (
                  <Empty title="No stops on this route">Orders for {r.name} clients will land here.</Empty>
                ) : (
                  <>
                    <div className="px-3 pt-3 pb-1">
                      <RouteLine stops={rs} run={run} clients={maps.client} selectedId={selected?.id} onSelect={setSel} />
                    </div>
                    <div className="overflow-x-auto scroll-thin">
                      <table className="tbl min-w-[620px]">
                        <thead>
                          <tr>
                            <th className="w-10">Stop</th>
                            <th>Client</th>
                            <th>Window</th>
                            <th>Status</th>
                            <th>Time</th>
                            <th className="r">Cases</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rs.map((d) => {
                            const c = maps.client.get(d.clientId)!;
                            const o = maps.order.get(d.orderId);
                            const at = d.pod?.at ?? d.exception?.at;
                            return (
                              <tr key={d.id} className={cx("clickable", selected?.id === d.id && "selected")} onClick={() => setSel(d.id)}>
                                <td className="font-semibold text-ink-3">{d.seq}</td>
                                <td>
                                  <div className="font-semibold">{c.name}</div>
                                  <div className="text-[12.5px] text-ink-3">{c.city}</div>
                                </td>
                                <td className="text-ink-2">{c.window}</td>
                                <td>
                                  <StatusPill status={d.status} />
                                </td>
                                <td className="text-ink-2">{at ? clock(at) : d.eta ? `ETA ${clock(d.eta)}` : "–"}</td>
                                <td className="r">{o?.lines.reduce((s, l) => s + l.qty, 0)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <div className="border-t border-line px-4 py-2 text-[12.5px] text-ink-3">
                      {cases} cases on this route.{" "}
                      {run && !run.departedAt && `Planned departure ${clock(run.plannedDepart)}.`}
                      {notLoaded > 0 && !run?.departedAt && ` ${notLoaded} stop${notLoaded > 1 ? "s" : ""} still being picked.`}
                    </div>
                  </>
                )}
              </Panel>
            );
          })}
        </div>

        <aside className="xl:sticky xl:top-[84px]">
          <Panel bodyClass="p-5 max-h-[calc(100vh-110px)] overflow-y-auto scroll-thin">
            {selected ? <DeliveryDetail key={selected.id} delivery={selected} /> : <Empty title="No stops for this day">Place an order on the Counter to schedule one.</Empty>}
          </Panel>
        </aside>
      </div>
    </div>
  );
}
