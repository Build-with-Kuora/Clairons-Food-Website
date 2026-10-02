"use client";

import { useMaps } from "@/lib/hooks";
import { ASSIGNABLE, carrierOf } from "@/lib/logic";
import { useStore, useUi } from "@/lib/store";
import type { Delivery } from "@/lib/types";
import { cx } from "./ui";

const BY = "Dispatch";

/** Who takes a stop: the van on its route or a rider. Locked once the stop has left. */
export function AssignCarrier({ delivery: d, className }: { delivery: Delivery; className?: string }) {
  const maps = useMaps();
  const riders = useStore((s) => s.riders);
  const assign = useStore((s) => s.assignDelivery);
  const toast = useUi((s) => s.toast);
  const route = maps.route.get(d.routeId);

  if (!ASSIGNABLE.includes(d.status)) return <span className={className}>{carrierOf(d, maps.route, maps.rider).label}</span>;

  return (
    <select
      className={cx("input h-8 w-auto py-0 text-[13.5px]", className)}
      aria-label="Who delivers this stop"
      value={d.riderId ?? ""}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => {
        const r = assign(d.id, e.target.value || null, BY);
        if (!r.ok) return toast(r.error, "warn");
        const rider = e.target.value ? maps.rider.get(e.target.value) : undefined;
        toast(rider ? `${maps.client.get(d.clientId)?.name} goes with ${rider.name}` : `${maps.client.get(d.clientId)?.name} back on ${route?.truck}`);
      }}
    >
      <option value="">
        Van: {route?.driver}, {route?.truck}
      </option>
      <optgroup label="Riders">
        {riders
          .filter((r) => r.active || r.id === d.riderId)
          .map((r) => (
            <option key={r.id} value={r.id}>
              Rider: {r.name}
            </option>
          ))}
      </optgroup>
    </select>
  );
}
