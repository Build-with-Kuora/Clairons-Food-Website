"use client";

import { ChevronLeft, LogOut, MapPin, Navigation, Phone, Thermometer } from "lucide-react";
import { useState } from "react";
import { ExceptionForm, PodForm } from "@/components/Pod";
import { Logo } from "@/components/Logo";
import { StatusPill, cx } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { clock, dateKey, tempBare, units } from "@/lib/format";
import { useMaps, useNow } from "@/lib/hooks";
import { TRUCK_LIMIT_C, commonUnit, runKey } from "@/lib/logic";
import { useStore, useUi } from "@/lib/store";

const KEY = "coldline-driver-route";

export default function Driver() {
  const routes = useStore((s) => s.routes);
  const riders = useStore((s) => s.riders);
  const deliveries = useStore((s) => s.deliveries);
  const runs = useStore((s) => s.runs);
  const advance = useStore((s) => s.advance);
  const dispatchRoute = useStore((s) => s.dispatchRoute);
  const toast = useUi((s) => s.toast);
  const maps = useMaps();
  const now = useNow(15_000);
  const today = dateKey(now);
  const [routeId, setRouteId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(KEY);
    } catch {
      return null;
    }
  });
  const [mode, setMode] = useState<"list" | "pod" | "problem">("list");

  function chooseRoute(id: string | null) {
    setRouteId(id);
    try {
      if (id) localStorage.setItem(KEY, id);
      else localStorage.removeItem(KEY);
    } catch {}
  }

  const route = routes.find((r) => r.id === routeId);
  const rider = riders.find((r) => r.id === routeId);

  if (!route && !rider) {
    return (
      <Frame>
        <h1 className="display mt-6 text-figure font-semibold">Who are you driving as?</h1>
        <p className="mt-1 text-body text-ink-2">Pick your van route or your name to see today&rsquo;s stops.</p>
        <h2 className="mt-5 text-small font-semibold text-ink-3">Ref vans</h2>
        <ul className="mt-2 space-y-3">
          {routes.map((r) => {
            const n = deliveries.filter((d) => d.routeId === r.id && !d.riderId && d.date === today).length;
            return (
              <li key={r.id}>
                <button onClick={() => chooseRoute(r.id)} className="w-full cursor-pointer rounded-xl border border-line bg-panel p-4 text-left hover:border-ink-3">
                  <div className="display text-title font-semibold">{r.name}</div>
                  <div className="text-body text-ink-2">
                    {r.truck}, {r.driver}, {n} stops
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
        <h2 className="mt-6 text-small font-semibold text-ink-3">Motorbike riders</h2>
        <ul className="mt-2 mb-10 space-y-3">
          {riders
            .filter((r) => r.active)
            .map((r) => {
              const n = deliveries.filter((d) => d.riderId === r.id && d.date === today).length;
              return (
                <li key={r.id}>
                  <button onClick={() => chooseRoute(r.id)} className="w-full cursor-pointer rounded-xl border border-line bg-panel p-4 text-left hover:border-ink-3">
                    <div className="display text-title font-semibold">{r.name}</div>
                    <div className="text-body text-ink-2">
                      {r.bike}, {n} stops
                    </div>
                  </button>
                </li>
              );
            })}
        </ul>
      </Frame>
    );
  }

  const me = route ? route.driver : rider!.name;
  const run = route ? runs[runKey(route.id, today)] : undefined;
  const stops = deliveries
    .filter((d) => d.date === today && (route ? d.routeId === route.id && !d.riderId : d.riderId === rider!.id))
    .sort((a, b) => a.seq - b.seq);
  const current = stops.find((d) => d.status === "ARRIVED") ?? stops.find((d) => d.status === "EN_ROUTE");
  const loaded = stops.filter((d) => d.status === "LOADED").length;
  const done = stops.filter((d) => d.status === "DELIVERED" || d.status === "EXCEPTION");
  const box = run?.temps.at(-1);
  const c = current ? maps.client.get(current.clientId) : undefined;
  const o = current ? maps.order.get(current.orderId) : undefined;

  return (
    <Frame>
      <div className="flex items-center justify-between gap-2 py-3">
        <button className="btn btn-quiet btn-sm -ml-2" onClick={() => chooseRoute(null)}>
          <ChevronLeft size={16} /> Routes
        </button>
        {route && box && (
          <span className={cx("flex items-center gap-1 text-body font-semibold", box.c > TRUCK_LIMIT_C ? "text-bad" : "text-ink")}>
            <Thermometer size={16} /> Box {tempBare(box.c)}C
          </span>
        )}
      </div>
      <h1 className="display text-heading leading-tight font-semibold">{route ? route.name : rider!.name}</h1>
      <p className="text-body text-ink-2">
        {route ? route.truck : rider!.bike}. {done.length} of {stops.length} stops done.
      </p>

      {rider && loaded > 0 && (
        <div className="mt-4 rounded-xl border border-line bg-panel p-4">
          <p className="text-body">{loaded === 1 ? "1 stop is packed and waiting for you." : `${loaded} stops are packed and waiting for you.`}</p>
          <button
            className="btn btn-primary btn-lg mt-3 w-full"
            onClick={() => {
              for (const d of stops) if (d.status === "LOADED") advance(d.id, "EN_ROUTE", me);
              toast("Picked up. Dispatch can see you.");
            }}
          >
            Pick up and go
          </button>
        </div>
      )}

      {route && !run?.departedAt && (
        <div className="mt-4 rounded-xl border border-line bg-panel p-4">
          <p className="text-body">
            {loaded} of {stops.length} stops are loaded. {stops.length - loaded > 0 && "The rest are still being picked."}
          </p>
          <button
            className="btn btn-primary btn-lg mt-3 w-full"
            disabled={loaded === 0}
            onClick={() => {
              dispatchRoute(route.id, today, me);
              toast("Route started. Dispatch can see you.");
            }}
          >
            Start route
          </button>
        </div>
      )}

      {current && c && o && mode === "list" && (
        <div className="mt-4 overflow-hidden rounded-xl border-2 border-ink bg-white">
          <div className="bg-ink px-4 py-2 text-small font-semibold text-white">
            {current.status === "ARRIVED" ? "You are here" : `Next stop, ${current.eta ? `expected ${clock(current.eta)}` : "en route"}`}
          </div>
          <div className="p-4">
            <div className="text-caption text-ink-3">Stop {current.seq}</div>
            <div className="display text-heading leading-tight font-semibold">{c.name}</div>
            <div className="mt-1 flex items-start gap-1.5 text-body">
              <MapPin size={18} className="mt-0.5 shrink-0 text-ink-3" />
              {c.address}, {c.city}
            </div>
            <div className="mt-1 text-body text-ink-2">Window {c.window}. {units(o.lines.reduce((s, l) => s + l.qty, 0), commonUnit(o.lines.map((l) => maps.product.get(l.sku))))}.</div>
            {current.note && <p className="mt-3 rounded-lg border-2 border-ink p-3 text-body"><span className="font-semibold">From dispatch:</span> {current.note}</p>}
            <p className="mt-3 rounded-lg bg-sunk p-3 text-body">{c.dockNote}</p>
            {o.payMethod === "COD" && !o.paid && <p className="mt-2 rounded-lg bg-warn-bg p-3 text-body font-semibold text-warn">Collect payment before unloading.</p>}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <a className="btn btn-ghost btn-lg" href={`tel:${c.phone.replace(/\D/g, "")}`}>
                <Phone size={18} /> Call
              </a>
              <a className="btn btn-ghost btn-lg" href={`https://maps.google.com/?q=${encodeURIComponent(`${c.address}, ${c.city}`)}`} target="_blank" rel="noreferrer">
                <Navigation size={18} /> Directions
              </a>
            </div>
            {current.status === "EN_ROUTE" ? (
              <button className="btn btn-primary btn-lg mt-2 w-full" onClick={() => advance(current.id, "ARRIVED", me)}>
                I&rsquo;ve arrived
              </button>
            ) : (
              <button className="btn btn-primary btn-lg mt-2 w-full" onClick={() => setMode("pod")}>
                Unload and get signature
              </button>
            )}
            <button className="btn btn-quiet mt-2 w-full text-bad" onClick={() => setMode("problem")}>
              Report a problem
            </button>
          </div>
        </div>
      )}

      {current && c && o && mode === "pod" && (
        <div className="mt-4 rounded-xl border border-line bg-panel p-4">
          <h2 className="display mb-3 text-heading font-semibold">{c.name}</h2>
          <PodForm big delivery={current} order={o} by={me} onDone={() => setMode("list")} onCancel={() => setMode("list")} />
        </div>
      )}

      {current && c && mode === "problem" && (
        <div className="mt-4 rounded-xl border border-line bg-panel p-4">
          <h2 className="display mb-3 text-heading font-semibold">Problem at {c.name}</h2>
          <ExceptionForm delivery={current} by={me} onDone={() => setMode("list")} onCancel={() => setMode("list")} />
        </div>
      )}

      {!current && (run?.departedAt || (rider && stops.length > 0 && loaded === 0)) && (
        <div className="mt-4 rounded-xl border border-line bg-panel p-5 text-center">
          <div className="display text-heading font-semibold">{done.length === stops.length ? "Route complete" : "No stop in progress"}</div>
          <p className="mt-1 text-body text-ink-2">{done.length === stops.length ? route ? "Head back to the dock and plug in the ref van." : "Head back to the dock." : "Ask dispatch to release your next stop."}</p>
        </div>
      )}

      <h2 className="mt-6 mb-2 text-body font-semibold text-ink-2">All stops</h2>
      <ol className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-panel">
        {stops.map((d) => {
          const cl = maps.client.get(d.clientId)!;
          const at = d.pod?.at ?? d.exception?.at;
          return (
            <li key={d.id} className={cx("flex items-center gap-3 px-4 py-3", current?.id === d.id && "bg-accent-bg/60")}>
              <span className="display w-6 text-title font-semibold text-ink-3">{d.seq}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-body font-semibold">{cl.name}</div>
                <div className="text-small text-ink-3">{at ? `Done ${clock(at)}` : cl.window}</div>
              </div>
              <StatusPill status={d.status} />
            </li>
          );
        })}
      </ol>
      <p className="mt-4 mb-10 text-center text-caption text-ink-3">Updates sync to the dispatch board as you go.</p>
    </Frame>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  const logOut = useAuth((s) => s.logOut);
  return (
    <div className="min-h-screen bg-page">
      <div className="sticky top-0 z-10 border-b border-line bg-panel">
        <div className="mx-auto flex max-w-md items-center gap-2.5 px-4 py-2.5">
          <Logo height={26} />

          <span className="text-small text-ink-3">Driver</span>
          <button className="btn btn-quiet btn-sm ml-auto" onClick={logOut}>
            <LogOut size={14} aria-hidden /> Log out
          </button>
        </div>
      </div>
      <div className="mx-auto max-w-md px-4">{children}</div>
    </div>
  );
}
