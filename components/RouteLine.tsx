"use client";

import { Check, Truck } from "lucide-react";
import { clock } from "@/lib/format";
import type { Client, Delivery, Run } from "@/lib/types";
import { cx } from "./ui";

const REACHED = new Set(["ARRIVED", "DELIVERED", "EXCEPTION"]);

function shortName(name: string) {
  return name.replace(/^The /, "").split(/,| SD| University| Medical| Senior| Bowl/)[0];
}

/**
 * A route drawn like a transit line: depot, then stops in delivery order.
 * Solid track = the truck has been there. The truck sits on the leg it is driving now.
 */
export function RouteLine({
  stops,
  run,
  clients,
  selectedId,
  onSelect,
}: {
  stops: Delivery[];
  run?: Run;
  clients: Map<string, Client>;
  selectedId?: string;
  onSelect?: (id: string) => void;
}) {
  const sorted = [...stops].sort((a, b) => a.seq - b.seq);
  const departed = !!run?.departedAt;
  const nextIdx = departed ? sorted.findIndex((d) => !REACHED.has(d.status)) : -1;
  const arrivedIdx = sorted.findIndex((d) => d.status === "ARRIVED");

  return (
    <div className="flex w-full overflow-x-auto pb-1 scroll-thin" role="list">
      <div className="relative flex min-w-[64px] flex-1 flex-col items-center" role="listitem">
        <div className="relative flex h-8 w-full items-center justify-center">
          <span className={cx("z-[1] grid h-6 w-6 place-items-center rounded-[5px] border-2", departed ? "border-ink bg-ink" : "border-ink bg-white")} aria-hidden>
            <span className={cx("h-1.5 w-1.5 rounded-full", departed ? "bg-white" : "bg-ink")} />
          </span>
        </div>
        <div className="mt-1 text-center text-[12.5px] leading-tight">
          <div className="font-semibold">Dock</div>
          <div className="text-ink-3">{run?.departedAt ? `Out ${clock(run.departedAt)}` : run ? `Departs ${clock(run.plannedDepart)}` : "Not planned"}</div>
        </div>
      </div>

      {sorted.map((d, i) => {
        const c = clients.get(d.clientId);
        const reached = REACHED.has(d.status);
        const driving = i === nextIdx && arrivedIdx === -1;
        const selected = selectedId === d.id;
        const deliveredAt = d.pod?.at ?? d.exception?.at;
        const sub =
          d.status === "DELIVERED" ? `Done ${clock(deliveredAt!)}` :
          d.status === "EXCEPTION" ? "Exception" :
          d.status === "ARRIVED" ? "On site" :
          d.eta ? `ETA ${clock(d.eta)}` :
          d.status === "LOADED" ? "On truck" :
          d.status === "PICKING" ? "Picking" : "Not picked";
        return (
          <button
            key={d.id}
            role="listitem"
            onClick={() => onSelect?.(d.id)}
            className={cx("group relative flex min-w-[92px] flex-1 cursor-pointer flex-col items-center rounded-md pb-1", selected && "bg-accent-bg/70")}
            aria-label={`Stop ${d.seq}, ${c?.name}, ${sub}`}
          >
            <div className="relative flex h-8 w-full items-center justify-center">
              <span
                className={cx(
                  "absolute top-1/2 right-1/2 left-[-50%] -translate-y-1/2",
                  reached ? "h-[3px] bg-ink" : driving ? "h-0 border-t-[3px] border-dashed border-accent" : "h-0 border-t-2 border-dashed border-line-2",
                )}
                aria-hidden
              />
              {driving && (
                <span className="absolute top-1/2 left-0 z-[2] grid h-6 w-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-accent text-white" aria-hidden>
                  <Truck size={13} strokeWidth={2.4} />
                </span>
              )}
              <span className="relative z-[1] grid place-items-center" aria-hidden>
                {d.status === "ARRIVED" && <span className="ping-ring absolute h-5 w-5 rounded-full bg-accent" />}
                <span
                  className={cx(
                    "relative grid h-5 w-5 place-items-center rounded-full border-2 text-[11px] font-bold",
                    d.status === "DELIVERED" && "border-ink bg-ink text-white",
                    d.status === "EXCEPTION" && "border-bad bg-bad text-white",
                    d.status === "ARRIVED" && "border-accent bg-accent text-white",
                    d.status === "EN_ROUTE" && (driving ? "border-accent bg-white" : "border-ink-3 bg-white"),
                    d.status === "LOADED" && "border-ink-3 bg-white",
                    (d.status === "PICKING" || d.status === "SCHEDULED") && "border-dashed border-line-2 bg-white",
                  )}
                >
                  {d.status === "DELIVERED" ? <Check size={11} strokeWidth={3.5} /> : d.status === "EXCEPTION" ? "!" : null}
                </span>
              </span>
            </div>
            <div className="mt-1 w-full px-1 text-center text-[12.5px] leading-tight">
              <div className={cx("truncate font-semibold", selected ? "text-ink" : "text-ink group-hover:underline")}>
                <span className="text-ink-3">{d.seq}</span> {c ? shortName(c.name) : "?"}
              </div>
              <div className={cx("truncate", d.status === "EXCEPTION" ? "font-semibold text-bad" : "text-ink-3")}>{sub}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
