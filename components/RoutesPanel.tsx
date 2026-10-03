"use client";

import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clock, tempBare } from "@/lib/format";
import { useMaps } from "@/lib/hooks";
import { TRUCK_LIMIT_C, runKey } from "@/lib/logic";
import { useStore } from "@/lib/store";
import { RouteLine } from "./RouteLine";
import { Panel, cx } from "./ui";

/** Today's van routes as lines of stops, with the latest box temperature. */
export function RoutesPanel({ today }: { today: string }) {
  const router = useRouter();
  const deliveries = useStore((s) => s.deliveries);
  const runs = useStore((s) => s.runs);
  const routes = useStore((s) => s.routes);
  const maps = useMaps();
  const stopsToday = deliveries.filter((d) => d.date === today);

  return (
    <Panel
      title="Routes"
      className="mb-5"
      actions={<Link href="/dispatch" className="btn btn-quiet btn-sm">Dispatch board <ArrowUpRight size={14} /></Link>}
      bodyClass="divide-y divide-line"
    >
      {routes.map((r) => {
        const stops = stopsToday.filter((d) => d.routeId === r.id && !d.riderId);
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
  );
}
