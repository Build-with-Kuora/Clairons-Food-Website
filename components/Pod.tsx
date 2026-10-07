"use client";

import { Eraser } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { money } from "@/lib/format";
import { FROZEN_LIMIT_C, refusedCredit, refusedSettlement, round2 } from "@/lib/logic";
import { useStore, useUi } from "@/lib/store";
import type { Delivery, Order, Short } from "@/lib/types";
import { Field, cx } from "./ui";

export function SignaturePad({ onChange, height = 150 }: { onChange: (v?: string) => void; height?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const dirty = useRef(false);
  const [empty, setEmpty] = useState(true);

  useEffect(() => {
    const c = ref.current!;
    const ratio = window.devicePixelRatio || 1;
    const w = c.clientWidth;
    c.width = w * ratio;
    c.height = height * ratio;
    const ctx = c.getContext("2d")!;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = getComputedStyle(c).getPropertyValue("--color-ink").trim() || "#000";
  }, [height]);

  const pos = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top] as const;
  };

  return (
    <div>
      <div className="relative">
        <canvas
          ref={ref}
          style={{ height, touchAction: "none" }}
          className="w-full cursor-crosshair rounded-md border border-line bg-white"
          onPointerDown={(e) => {
            try {
              e.currentTarget.setPointerCapture(e.pointerId);
            } catch {
              // Synthetic or already-released pointers can't be captured; drawing still works.
            }
            drawing.current = true;
            const ctx = ref.current!.getContext("2d")!;
            const [x, y] = pos(e);
            ctx.beginPath();
            ctx.moveTo(x, y);
          }}
          onPointerMove={(e) => {
            if (!drawing.current) return;
            const ctx = ref.current!.getContext("2d")!;
            const [x, y] = pos(e);
            ctx.lineTo(x, y);
            ctx.stroke();
            dirty.current = true;
          }}
          onPointerUp={() => {
            drawing.current = false;
            if (dirty.current) {
              setEmpty(false);
              onChange(ref.current!.toDataURL("image/png"));
            }
          }}
          aria-label="Signature pad. Sign with finger or mouse."
        />
        <div className="pointer-events-none absolute right-4 bottom-8 left-4 border-b border-dashed border-line-2" />
        {empty && <span className="pointer-events-none absolute bottom-2 left-4 text-caption text-ink-3">Receiver signs here</span>}
      </div>
      <button
        type="button"
        className="btn btn-quiet btn-sm mt-1 -ml-2.5"
        onClick={() => {
          const c = ref.current!;
          c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
          dirty.current = false;
          setEmpty(true);
          onChange(undefined);
        }}
      >
        <Eraser size={14} /> Clear
      </button>
    </div>
  );
}

const SHORT_REASONS = ["Refused, soft on arrival", "Damaged in transit", "Short-shipped from dock", "Wrong item", "Client did not order"];

/** Proof of delivery: what came off the truck, at what temperature, who signed. */
export function PodForm({ delivery, order, by, onDone, onCancel, big }: { delivery: Delivery; order: Order; by: string; onDone: () => void; onCancel?: () => void; big?: boolean }) {
  const complete = useStore((s) => s.completeDelivery);
  const toast = useUi((s) => s.toast);
  const [receivedBy, setReceivedBy] = useState("");
  const [tempC, setTempC] = useState("-18");
  const [qty, setQty] = useState<Record<string, number>>(() => Object.fromEntries(order.lines.map((l) => [l.sku, l.qty])));
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [sig, setSig] = useState<string>();
  const [notes, setNotes] = useState("");
  const shorts: Short[] = order.lines
    .filter((l) => (qty[l.sku] ?? l.qty) < l.qty)
    .map((l) => ({ sku: l.sku, qty: l.qty - (qty[l.sku] ?? l.qty), reason: reasons[l.sku] ?? SHORT_REASONS[0] }));
  const credit = refusedCredit(order, shorts);
  const settle = refusedSettlement(order);
  const isCod = settle === "COLLECT_LESS";
  const due = round2(order.total - credit);
  // Follows what is due as cases come back, until the driver types a different amount.
  const [typed, setTyped] = useState<string>();
  const collected = typed ?? (isCod ? due.toFixed(2) : "");
  const t = parseFloat(tempC);
  const warm = !Number.isNaN(t) && t > FROZEN_LIMIT_C;
  const ready = receivedBy.trim().length > 1 && !!sig && !Number.isNaN(t);

  function submit() {
    if (!ready) return;
    complete(
      delivery.id,
      { receivedBy: receivedBy.trim(), signature: sig, productTempC: t, notes: notes || undefined, shorts, collected: isCod ? parseFloat(collected) || 0 : undefined },
      by,
    );
    toast(shorts.length ? `Delivered with ${shorts.reduce((s, x) => s + x.qty, 0)} returned` : "Delivered and signed");
    onDone();
  }

  const inputCls = big ? "input h-12 text-lead" : "input";
  return (
    <div className="space-y-4">
      <div>
        <div className="field-label">Delivered</div>
        <ul className="divide-y divide-line rounded-md border border-line bg-white">
          {order.lines.map((l) => {
            const q = qty[l.sku] ?? l.qty;
            const short = q < l.qty;
            return (
              <li key={l.sku} className={cx("px-3 py-2", short && "bg-warn-bg/50")}>
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className={cx("leading-snug font-semibold", big ? "text-body" : "text-small")}>{l.name}</div>
                    <div className="code text-ink-3">{l.sku}</div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button type="button" className={cx("btn btn-ghost px-0", big ? "h-12 w-12" : "h-11 w-11")} onClick={() => setQty({ ...qty, [l.sku]: Math.max(0, q - 1) })} aria-label="One fewer">
                      −
                    </button>
                    <span className={cx("w-14 text-center font-semibold", big ? "text-lead" : "text-small")}>
                      {q}/{l.qty}
                    </span>
                    <button type="button" className={cx("btn btn-ghost px-0", big ? "h-12 w-12" : "h-11 w-11")} onClick={() => setQty({ ...qty, [l.sku]: Math.min(l.qty, q + 1) })} aria-label="One more">
                      +
                    </button>
                  </div>
                </div>
                {short && (
                  <select className="input mt-2" value={reasons[l.sku] ?? SHORT_REASONS[0]} onChange={(e) => setReasons({ ...reasons, [l.sku]: e.target.value })} aria-label="Why some came back">
                    {SHORT_REASONS.map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </select>
                )}
              </li>
            );
          })}
        </ul>
        {shorts.length > 0 && (
          <p className="mt-1 text-caption text-warn">
            Returned stock goes back on the truck and into stock at the dock.{" "}
            {settle === "ACCOUNT"
              ? `${money(credit)} comes off the account.`
              : settle === "REFUND"
                ? `${money(credit)} is owed back to the customer; the office hands it back.`
                : settle === "COLLECT_LESS"
                  ? `Collect ${money(credit)} less.`
                  : ""}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Product temp at hand-off (°C)" hint={warm ? undefined : "Probe one case from the middle of the load."}>
          <input className={cx(inputCls, warm && "border-bad text-bad")} inputMode="decimal" value={tempC} onChange={(e) => setTempC(e.target.value)} />
        </Field>
        <Field label="Received by">
          <input className={inputCls} value={receivedBy} onChange={(e) => setReceivedBy(e.target.value)} placeholder="Name on site" />
        </Field>
      </div>
      {warm && <p className="-mt-2 text-caption font-semibold text-bad">Warmer than −15°C. Note it below and expect the receiver to refuse soft product.</p>}

      {isCod && (
        <Field label={`Collect on delivery, ${money(due)} due`}>
          <input className={inputCls} inputMode="decimal" value={collected} onChange={(e) => setTyped(e.target.value)} />
        </Field>
      )}

      <Field label="Notes">
        <input className={inputCls} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Where it was put, who checked temps…" />
      </Field>

      <div>
        <div className="field-label">Signature</div>
        <SignaturePad onChange={setSig} height={big ? 180 : 140} />
      </div>

      <div className="flex gap-2">
        {onCancel && (
          <button type="button" className={cx("btn btn-ghost", big && "btn-lg")} onClick={onCancel}>
            Cancel
          </button>
        )}
        <button type="button" className={cx("btn btn-primary flex-1", big && "btn-lg")} disabled={!ready} onClick={submit}>
          Complete stop
        </button>
      </div>
      {!ready && <p className="text-caption text-ink-3">Needs the receiver&rsquo;s name and signature.</p>}
    </div>
  );
}

const EXCEPTION_REASONS = ["Client closed", "Refused delivery", "Too warm on arrival", "Damaged load", "Can't access dock", "Truck breakdown", "Other"];

export function ExceptionForm({ delivery, by, onDone, onCancel }: { delivery: Delivery; by: string; onDone: () => void; onCancel: () => void }) {
  const report = useStore((s) => s.reportException);
  const toast = useUi((s) => s.toast);
  const [reason, setReason] = useState(EXCEPTION_REASONS[0]);
  const [note, setNote] = useState("");
  return (
    <div className="space-y-3">
      <Field label="What happened">
        <select className="input" value={reason} onChange={(e) => setReason(e.target.value)}>
          {EXCEPTION_REASONS.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
      </Field>
      <Field label="Details for dispatch">
        <textarea className="input" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Called the contact twice, no answer. Back door locked." />
      </Field>
      <div className="flex justify-end gap-2">
        <button className="btn btn-ghost" onClick={onCancel}>
          Cancel
        </button>
        <button
          className="btn btn-danger"
          onClick={() => {
            report(delivery.id, reason, note, by);
            toast(`Problem reported: ${reason}`, "warn");
            onDone();
          }}
        >
          Report problem
        </button>
      </div>
    </div>
  );
}
