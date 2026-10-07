"use client";

import { useState } from "react";
import { dayShort, keyToTs, money, units } from "@/lib/format";
import { useMaps, useToday } from "@/lib/hooks";
import { RETURNED_LABEL, cancelSettlement, commonUnit, deliveryDays, returnedDefault, runKey, stockLeft, type ReturnedStock } from "@/lib/logic";
import { useStore, useUi } from "@/lib/store";
import type { Delivery, Order } from "@/lib/types";

const BY = "Dispatch";

const RETURNED_HINT: Record<ReturnedStock, string> = {
  SHELF: "They are fine to sell again.",
  HOLD: "Kept apart until someone checks them. Release or write them off from Inventory.",
  WRITE_OFF: "Spoiled or damaged. They come out of stock for good.",
};

/**
 * After a problem on a stop: decide what happens to any cases that came back, then send the order again
 * on another day or cancel it. Until this is done the stop stays a problem and its cases are on no shelf.
 */
export function ResolveProblem({ delivery: d, order: o, onDone, onCancel }: { delivery: Delivery; order: Order; onDone: () => void; onCancel: () => void }) {
  const resolve = useStore((s) => s.resolveProblem);
  const runs = useStore((s) => s.runs);
  const toast = useUi((s) => s.toast);
  const maps = useMaps();
  const { now } = useToday();
  const client = maps.client.get(d.clientId);
  const left = stockLeft(d);
  const cases = o.lines.reduce((t, l) => t + l.qty, 0);
  const unit = commonUnit(o.lines.map((l) => maps.product.get(l.sku)));
  const settle = cancelSettlement(o);
  // Today if its van hasn't left (or a rider carries it), then the next delivery days.
  const days = deliveryDays(now, 6, true)
    .filter((k) => d.riderId || !runs[runKey(d.routeId, k)]?.departedAt)
    .slice(0, 5);
  const [stock, setStock] = useState<ReturnedStock>(() => returnedDefault(d.exception?.reason ?? ""));
  const [next, setNext] = useState<"RETRY" | "CANCEL">("RETRY");
  const [date, setDate] = useState(days[0]);

  function submit() {
    const r = resolve(d.id, { stock, next, date }, BY);
    if (!r.ok) return toast(r.error, "warn");
    toast(next === "RETRY" ? `${o.number} goes out again ${dayShort(keyToTs(date))}` : `${o.number} cancelled`);
    onDone();
  }

  return (
    <div className="space-y-5">
      <section>
        <h3 className="field-label">The {units(cases, unit)} on this order</h3>
        {left ? (
          <div className="grid gap-2" role="radiogroup" aria-label="What happens to the returned stock">
            {(["SHELF", "HOLD", "WRITE_OFF"] as const).map((k) => (
              <Choice key={k} name="stock" checked={stock === k} onChange={() => setStock(k)} title={RETURNED_LABEL[k]} hint={RETURNED_HINT[k]} />
            ))}
          </div>
        ) : (
          <p className="rounded-xl bg-sunk px-3.5 py-3 text-body text-ink-2">They never left the building, so there is nothing to put back.</p>
        )}
      </section>

      <section>
        <h3 className="field-label">What next</h3>
        <div className="grid gap-2" role="radiogroup" aria-label="What happens to the order">
          <Choice name="next" checked={next === "RETRY"} onChange={() => setNext("RETRY")} title="Deliver again" hint="Stock is set aside again, earliest best-by first." />
          {next === "RETRY" && (
            <div className="mb-1 flex flex-wrap gap-2 pl-10" role="group" aria-label="Delivery day">
              {days.map((k) => (
                <button key={k} type="button" className="chip" aria-pressed={date === k} onClick={() => setDate(k)}>
                  {dayShort(keyToTs(k)).replace(/,.*/, "")} {new Date(keyToTs(k)).getDate()}
                </button>
              ))}
            </div>
          )}
          <Choice
            name="next"
            checked={next === "CANCEL"}
            onChange={() => setNext("CANCEL")}
            title="Cancel the order"
            hint={
              settle.kind === "ACCOUNT"
                ? `${money(settle.amount)} comes off ${client?.name ?? "the customer"}'s balance.`
                : settle.kind === "REFUND"
                  ? `${money(settle.amount)} was paid, so it is owed back. It shows on Orders until it is handed back.`
                  : "Nothing was paid, so nothing is owed back."
            }
          />
        </div>
      </section>

      <div className="flex justify-end gap-2">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Not now
        </button>
        {next === "RETRY" ? (
          <button type="button" className="btn btn-primary" disabled={!date} onClick={submit}>
            Send again {date ? dayShort(keyToTs(date)) : ""}
          </button>
        ) : (
          <button type="button" className="btn btn-danger" onClick={submit}>
            Cancel {o.number}
          </button>
        )}
      </div>
    </div>
  );
}

function Choice({ name, checked, onChange, title, hint }: { name: string; checked: boolean; onChange: () => void; title: string; hint: string }) {
  return (
    <label className="choice">
      <input type="radio" name={name} checked={checked} onChange={onChange} />
      <span className="min-w-0 flex-1">
        <span className="block text-body font-semibold">{title}</span>
        <span className="block text-small text-ink-2">{hint}</span>
      </span>
    </label>
  );
}
