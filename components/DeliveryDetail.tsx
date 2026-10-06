"use client";

import { Check, Phone } from "lucide-react";
import { useState } from "react";
import { MIN, clock, dateKey, dateTime, day, money, temp, tempBare, units } from "@/lib/format";
import { useMaps, useNow } from "@/lib/hooks";
import { STATUS_FLOW, STATUS_LABEL, TRUCK_LIMIT_C, carrierOf, commonUnit, deliveryTrace, nextAction, runKey, statusAt } from "@/lib/logic";
import { useStore } from "@/lib/store";
import type { Delivery } from "@/lib/types";
import { TempTrace } from "./charts";
import { AssignCarrier } from "./AssignCarrier";
import { StopPlan } from "./StopPlan";
import { ExceptionForm, PodForm } from "./Pod";
import { Badge, Modal, Signature, StatusPill, cx } from "./ui";

const BY = "Dispatch";

export function DeliveryDetail({ delivery: d }: { delivery: Delivery }) {
  const maps = useMaps();
  const runs = useStore((s) => s.runs);
  const advance = useStore((s) => s.advance);
  const now = useNow(20_000);
  const [pod, setPod] = useState(false);
  const [exc, setExc] = useState(false);
  const c = maps.client.get(d.clientId)!;
  const o = maps.order.get(d.orderId)!;
  const route = maps.route.get(d.routeId)!;
  const carrier = carrierOf(d, maps.route, maps.rider);
  const van = carrier.kind === "VAN";
  const run = van ? runs[runKey(d.routeId, d.date)] : undefined;
  const trace = deliveryTrace(d, run, now);
  const peak = trace.reduce((m, t) => Math.max(m, t.c), -Infinity);
  let minutesOver = 0;
  for (let i = 1; i < trace.length; i++) if (trace[i].c > TRUCK_LIMIT_C) minutesOver += (trace[i].at - trace[i - 1].at) / MIN;
  const act = nextAction(d);
  const when = (ts: number) => (dateKey(ts) === d.date ? clock(ts) : day(ts));
  const canGo = d.status === "LOADED" && run?.departedAt;
  const final = d.status === "DELIVERED" || d.status === "EXCEPTION";
  const cases = o.lines.reduce((s, l) => s + l.qty, 0);
  const unit = commonUnit(o.lines.map((l) => maps.product.get(l.sku)));

  const marks = [
    { at: statusAt(d, "LOADED"), label: "Loaded" },
    { at: statusAt(d, "ARRIVED"), label: "Arrived" },
    { at: d.pod?.at ?? d.exception?.at, label: d.status === "EXCEPTION" ? "Problem" : "Signed" },
  ].filter((m): m is { at: number; label: string } => !!m.at && trace.length > 0 && m.at >= trace[0].at);

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <StatusPill status={d.status} />
            <span className="code text-ink-3">{o.number}</span>
          </div>
          <h2 className="display mt-1.5 text-heading leading-tight font-semibold">{c.name}</h2>
          <div className="text-small text-ink-2">
            {c.address}, {c.city}
          </div>
          <div className="mt-0.5 text-small text-ink-3">
            {van ? `Stop ${d.seq} on ${route.name}` : `Rider drop, ${carrier.person} (${carrier.vehicle})`}, window {c.window}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {act && (
            <button className="btn btn-primary" onClick={() => advance(d.id, act.to, BY)}>
              {act.label}
            </button>
          )}
          {canGo && (
            <button className="btn btn-primary" onClick={() => advance(d.id, "EN_ROUTE", BY)}>
              Mark en route
            </button>
          )}
          {d.status === "ARRIVED" && (
            <button className="btn btn-primary" onClick={() => setPod(true)}>
              Capture proof of delivery
            </button>
          )}
          {!final && (
            <button className="btn btn-danger" onClick={() => setExc(true)}>
              Report problem
            </button>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-small">
        <span className="text-ink-3">Delivered by</span>
        <AssignCarrier delivery={d} className="font-semibold" />
      </div>

      <StopPlan key={`${d.id}|${d.note ?? ""}`} delivery={d} />

      <div className="mt-3 rounded-md bg-sunk px-3 py-2 text-small text-ink-2">
        <span className="font-semibold text-ink">Dock note:</span> {c.dockNote}
        <span className="ml-3 inline-flex items-center gap-1 whitespace-nowrap text-ink-3">
          <Phone size={12} /> {c.contact}, {c.phone}
        </span>
      </div>

      {/* Status ladder: a real sequence, so it gets step order */}
      <ol className="mt-5 grid grid-cols-3 gap-x-2 gap-y-4">
        {STATUS_FLOW.map((s, i) => {
          const at = statusAt(d, s);
          const cur = d.status === s;
          const failed = d.status === "EXCEPTION" && s === "DELIVERED";
          return (
            <li key={s} className="min-w-0">
              <div className={cx("h-1.5 rounded-full", failed ? "bg-bad" : at ? "bg-ink" : "bg-line")} />
              <div className={cx("mt-1.5 flex items-center gap-1 text-caption font-semibold", cur ? "text-ink" : at ? "text-ink-2" : "text-ink-3")}>
                {at && !cur && <Check size={14} strokeWidth={3} aria-hidden />}
                <span>{failed ? "Problem" : STATUS_LABEL[s]}</span>
              </div>
              <div className="text-caption text-ink-3">{failed ? when(d.exception!.at) : at ? when(at) : i === 4 && d.eta ? `Expected ${clock(d.eta)}` : ""}</div>
            </li>
          );
        })}
      </ol>

      {d.exception && (
        <div className="mt-4 rounded-md border border-bad/30 bg-bad-bg p-3 text-small text-bad">
          <div className="font-semibold">
            {d.exception.reason}, {clock(d.exception.at)}
          </div>
          {d.exception.note && <p className="mt-0.5 text-ink">{d.exception.note}</p>}
        </div>
      )}

      {van && <section className="mt-6">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="display text-title font-semibold">Cold chain</h3>
          <div className="text-caption text-ink-3">
            {route.truck}, set {tempBare(route.setPointC, 0)}C.{" "}
            {trace.length > 0 && (
              <>
                Peak <span className={cx("font-semibold", peak > TRUCK_LIMIT_C ? "text-bad" : "text-ink")}>{temp(peak)}</span>
                {minutesOver > 0 && <span className="font-semibold text-bad">, {Math.round(minutesOver)} min above limit</span>}
              </>
            )}
          </div>
        </div>
        <TempTrace temps={trace} limit={TRUCK_LIMIT_C} marks={marks} />
      </section>}

      {d.pod && (
        <section className="mt-6">
          <h3 className="display mb-2 text-title font-semibold">Proof of delivery</h3>
          <div className="grid gap-4 rounded-lg border border-line bg-white p-4 sm:grid-cols-[1fr_auto]">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-small">
              <div>
                <dt className="text-caption text-ink-3">Signed by</dt>
                <dd className="font-semibold">{d.pod.receivedBy}</dd>
              </div>
              <div>
                <dt className="text-caption text-ink-3">Hand-off</dt>
                <dd className="font-semibold">{dateTime(d.pod.at)}</dd>
              </div>
              <div>
                <dt className="text-caption text-ink-3">Product temp</dt>
                <dd className={cx("font-semibold", d.pod.productTempC > TRUCK_LIMIT_C && "text-bad")}>{temp(d.pod.productTempC)}</dd>
              </div>
              <div>
                <dt className="text-caption text-ink-3">Delivered</dt>
                <dd className="font-semibold">
                  {cases - d.pod.shorts.reduce((s, x) => s + x.qty, 0)} of {units(cases, unit)}
                </dd>
              </div>
              {d.pod.collected !== undefined && (
                <div>
                  <dt className="text-caption text-ink-3">Collected</dt>
                  <dd className="font-semibold">{money(d.pod.collected)}</dd>
                </div>
              )}
              {d.pod.notes && (
                <div className="col-span-2">
                  <dt className="text-caption text-ink-3">Notes</dt>
                  <dd>{d.pod.notes}</dd>
                </div>
              )}
            </dl>
            <div className="border-line sm:border-l sm:pl-4">
              <div className="text-caption text-ink-3">Signature</div>
              <Signature value={d.pod.signature} />
            </div>
          </div>
          {d.pod.shorts.length > 0 && (
            <ul className="mt-2 space-y-1">
              {d.pod.shorts.map((s) => (
                <li key={s.sku} className="flex items-center gap-2 text-small">
                  <Badge tone="warn">−{units(s.qty, maps.product.get(s.sku)?.unit ?? "unit")}</Badge>
                  {maps.product.get(s.sku)?.name}, <span className="text-ink-3">{s.reason}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="mt-6">
        <h3 className="display mb-2 text-title font-semibold">On this stop, {units(cases, unit)}</h3>
        <table className="tbl rounded-lg border border-line">
          <thead>
            <tr>
              <th>Product</th>
              <th>Lots</th>
              <th className="r">Qty</th>
            </tr>
          </thead>
          <tbody>
            {o.lines.map((l) => (
              <tr key={l.sku}>
                <td>
                  <div className="font-semibold">{l.name}</div>
                  <div className="code text-ink-3">{l.sku}</div>
                </td>
                <td className="code text-ink-2">{l.allocs.map((a) => `${a.lotCode}×${a.qty}`).join(" ")}</td>
                <td className="r font-semibold whitespace-nowrap">
                  {l.qty} <span className="text-caption font-normal text-ink-3">{maps.product.get(l.sku)?.unit}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {o.notes && <p className="mt-2 text-small"><span className="font-semibold">Order note:</span> {o.notes}</p>}
      </section>

      <section className="mt-6">
        <h3 className="display mb-2 text-title font-semibold">Activity</h3>
        <ol className="relative ml-1.5 border-l border-line">
          {[...d.events].reverse().map((e, i) => (
            <li key={i} className="relative pb-3 pl-4 text-small">
              <span className={cx("absolute top-1.5 -left-[5px] h-2.5 w-2.5 rounded-full border-2 border-panel", e.status === "EXCEPTION" ? "bg-bad" : i === 0 ? "bg-ink" : "bg-line-2")} />
              <span className="font-semibold">{STATUS_LABEL[e.status]}</span>
              <span className="text-ink-3">
                {" "}
                {dateTime(e.at)}, {e.by}
              </span>
              {e.note && <div className="text-ink-2">{e.note}</div>}
            </li>
          ))}
        </ol>
      </section>

      <Modal open={pod} onClose={() => setPod(false)} title={`Proof of delivery, ${c.name}`} width={600}>
        <PodForm delivery={d} order={o} by={carrier.person} onDone={() => setPod(false)} onCancel={() => setPod(false)} />
      </Modal>
      <Modal open={exc} onClose={() => setExc(false)} title="Report a delivery problem" width={480}>
        <ExceptionForm delivery={d} by={BY} onDone={() => setExc(false)} onCancel={() => setExc(false)} />
      </Modal>
    </div>
  );
}
