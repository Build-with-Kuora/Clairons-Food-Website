"use client";

import { AlertTriangle } from "lucide-react";
import { useMemo, useState } from "react";
import { DAY, dateKey, keyToTs, temp } from "@/lib/format";
import { ZONES, receiveLimitC, zoneOfBin } from "@/lib/logic";
import { useStore, useUi } from "@/lib/store";
import type { Lot, PurchaseOrder } from "@/lib/types";
import { Field, Modal } from "./ui";

const BY = "Inventory";

export function ReceiveModal({ open, onClose, sku: initialSku }: { open: boolean; onClose: () => void; sku?: string }) {
  const products = useStore((s) => s.products);
  const receive = useStore((s) => s.receive);
  const toast = useUi((s) => s.toast);
  const [sku, setSku] = useState(initialSku ?? products[0]?.sku ?? "");
  const p = products.find((x) => x.sku === sku);
  const [qty, setQty] = useState("10");
  const [tempC, setTempC] = useState("-19");
  const [bestBy, setBestBy] = useState(() => dateKey(Date.now() + (p?.shelfDays ?? 365) * DAY));
  const [bin, setBin] = useState(p?.bin ?? "");
  const [po, setPo] = useState("");

  const t = parseFloat(tempC);
  const limit = p ? receiveLimitC(p.zone) : 0;
  const warm = !Number.isNaN(t) && t > limit;
  const n = parseInt(qty, 10) || 0;

  function pickSku(v: string) {
    setSku(v);
    const np = products.find((x) => x.sku === v);
    if (np) {
      setBin(np.bin);
      setBestBy(dateKey(Date.now() + np.shelfDays * DAY));
      setTempC(np.zone === "COOL" ? "3" : "-19");
    }
  }

  function save() {
    if (!p || n <= 0 || Number.isNaN(t)) return;
    const lot = receive({ sku, qty: n, tempC: t, bestBy: keyToTs(bestBy), bin: bin.toUpperCase(), po: po || undefined, by: "Receiving" });
    toast(lot.status === "HOLD" ? `Lot ${lot.code} received and placed on QA hold` : `Received ${n} cs as lot ${lot.code}`, lot.status === "HOLD" ? "warn" : "ok");
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Receive stock"
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={!p || n <= 0 || Number.isNaN(t)}>
            Receive {n > 0 ? `${n} cs` : ""}
          </button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Product" className="sm:col-span-2">
          <select className="input" value={sku} onChange={(e) => pickSku(e.target.value)}>
            {products.map((x) => (
              <option key={x.sku} value={x.sku}>
                {x.sku}, {x.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Cases received">
          <input className="input" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value.replace(/\D/g, ""))} />
        </Field>
        <Field label="Product temp at dock (°C)" hint={p ? `Accept at ${limit}°C or colder.` : undefined}>
          <input className="input" inputMode="decimal" value={tempC} onChange={(e) => setTempC(e.target.value)} />
        </Field>
        <Field label="Best-by date" hint="From the case label.">
          <input type="date" className="input" value={bestBy} onChange={(e) => setBestBy(e.target.value)} />
        </Field>
        <Field label="Put-away bin" hint={bin ? `${ZONES[zoneOfBin(bin)].name}. Use B-01-xx to blast-freeze first.` : undefined}>
          <input className="input uppercase" value={bin} onChange={(e) => setBin(e.target.value)} />
        </Field>
        <Field label="PO or BOL number" className="sm:col-span-2">
          <input className="input" value={po} onChange={(e) => setPo(e.target.value)} placeholder="Optional" />
        </Field>
      </div>
      {warm && (
        <div className="mt-3 flex gap-2 rounded-md border border-bad/30 bg-bad-bg p-3 text-[13.5px] text-bad">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>
            {temp(t)} is above the {limit}°C receiving limit. The lot will be placed on QA hold and cannot be sold until released.
          </span>
        </div>
      )}
    </Modal>
  );
}

export function AdjustModal({ lot, onClose }: { lot: Lot | null; onClose: () => void }) {
  const adjust = useStore((s) => s.adjust);
  const toast = useUi((s) => s.toast);
  const [mode, setMode] = useState<"COUNT" | "WASTE">("COUNT");
  const [val, setVal] = useState("");
  const [note, setNote] = useState("");
  if (!lot) return null;
  const n = parseInt(val, 10);
  const delta = Number.isNaN(n) ? 0 : mode === "COUNT" ? n - lot.qty : -Math.min(n, lot.qty);

  function save() {
    if (!lot || delta === 0) return;
    adjust(lot.id, delta, mode === "COUNT" ? "ADJUST" : "WASTE", note || (mode === "COUNT" ? "Cycle count" : "Damaged"), BY);
    toast(`Lot ${lot.code} ${delta > 0 ? "+" : ""}${delta} cs`);
    setVal("");
    setNote("");
    onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Adjust lot ${lot.code}`}
      width={480}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={delta === 0}>
            Save adjustment
          </button>
        </>
      }
    >
      <div className="mb-3 grid grid-cols-2 gap-1 rounded-md border border-line bg-white p-0.5">
        {(["COUNT", "WASTE"] as const).map((m) => (
          <button key={m} onClick={() => setMode(m)} className={`h-8 cursor-pointer rounded text-[13.5px] font-semibold ${mode === m ? "bg-ink text-white" : "text-ink-2"}`}>
            {m === "COUNT" ? "Cycle count" : "Write off damage"}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label={mode === "COUNT" ? "Cases counted in bin" : "Cases to write off"} hint={`System shows ${lot.qty} cs in ${lot.bin}.`}>
          <input className="input" inputMode="numeric" value={val} onChange={(e) => setVal(e.target.value.replace(/\D/g, ""))} autoFocus />
        </Field>
        <div className="pt-6 text-[14px]">
          Change: <span className={`font-semibold ${delta < 0 ? "text-bad" : delta > 0 ? "text-good" : ""}`}>{delta > 0 ? "+" : ""}{delta} cs</span>
        </div>
        <Field label="Reason" className="col-span-2">
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder={mode === "COUNT" ? "Cycle count" : "Crushed case, freezer burn, thawed…"} />
        </Field>
      </div>
    </Modal>
  );
}

export function MoveModal({ lot, onClose }: { lot: Lot | null; onClose: () => void }) {
  const moveLot = useStore((s) => s.moveLot);
  const toast = useUi((s) => s.toast);
  const [bin, setBin] = useState("");
  if (!lot) return null;
  const target = bin.trim().toUpperCase();
  return (
    <Modal
      open
      onClose={onClose}
      title={`Move lot ${lot.code}`}
      width={440}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            disabled={!/^[BDFC]-\d{2}-[A-Z]\d$/.test(target)}
            onClick={() => {
              moveLot(lot.id, target, BY);
              toast(`Moved ${lot.code} to ${target}`);
              setBin("");
              onClose();
            }}
          >
            Move {lot.qty} cs
          </button>
        </>
      }
    >
      <p className="mb-3 text-[14px] text-ink-2">
        Now in <span className="code font-medium text-ink">{lot.bin}</span>, {ZONES[zoneOfBin(lot.bin)].name}.
      </p>
      <Field label="New bin" hint={/^[BDFC]-\d{2}-[A-Z]\d$/.test(target) ? `${ZONES[zoneOfBin(target)].name}` : "Format: zone letter, aisle, rack and level. F-03-A2"}>
        <input className="input uppercase" value={bin} onChange={(e) => setBin(e.target.value)} placeholder="F-03-A2" autoFocus />
      </Field>
    </Modal>
  );
}

export function HoldModal({ lot, onClose }: { lot: Lot | null; onClose: () => void }) {
  const setHold = useStore((s) => s.setHold);
  const toast = useUi((s) => s.toast);
  const [reason, setReason] = useState("");
  if (!lot) return null;
  const releasing = lot.status === "HOLD";
  return (
    <Modal
      open
      onClose={onClose}
      title={releasing ? `Release lot ${lot.code}` : `Hold lot ${lot.code}`}
      width={480}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button
            className={releasing ? "btn btn-primary" : "btn btn-danger"}
            disabled={!reason.trim()}
            onClick={() => {
              setHold(lot.id, !releasing, reason.trim(), "QA");
              toast(releasing ? `Lot ${lot.code} released for sale` : `Lot ${lot.code} on hold`);
              setReason("");
              onClose();
            }}
          >
            {releasing ? "Release for sale" : "Place on hold"}
          </button>
        </>
      }
    >
      {releasing && lot.holdReason && <p className="mb-3 rounded-md bg-sunk p-2.5 text-[13.5px] text-ink-2">{lot.holdReason}</p>}
      <Field label={releasing ? "QA finding" : "Why is this lot on hold?"}>
        <textarea
          className="input"
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={releasing ? "Core temp −17°C on 3 cases, no ice crystals. OK to sell." : "Supplier recall notice, damaged pallet…"}
          autoFocus
        />
      </Field>
    </Modal>
  );
}

export function ReceivePOModal({ po, onClose }: { po: PurchaseOrder | null; onClose: () => void }) {
  const receivePO = useStore((s) => s.receivePO);
  const products = useStore((s) => s.products);
  const toast = useUi((s) => s.toast);
  const initial = useMemo(
    () => Object.fromEntries((po?.lines ?? []).map((l) => [l.sku, { qty: String(l.qty), temp: products.find((p) => p.sku === l.sku)?.zone === "COOL" ? "3" : "-19" }])),
    [po, products],
  );
  const [vals, setVals] = useState<Record<string, { qty: string; temp: string }>>(initial);
  if (!po) return null;
  const v = (sku: string) => vals[sku] ?? initial[sku];
  return (
    <Modal
      open
      onClose={onClose}
      title={`Receive ${po.number}`}
      width={640}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={() => {
              receivePO(
                po.id,
                po.lines.map((l) => ({ sku: l.sku, qty: parseInt(v(l.sku).qty, 10) || 0, tempC: parseFloat(v(l.sku).temp) })),
                "Receiving",
              );
              toast(`${po.number} received into stock`);
              onClose();
            }}
          >
            Receive into stock
          </button>
        </>
      }
    >
      <table className="tbl">
        <thead>
          <tr>
            <th>Product</th>
            <th className="r">Ordered</th>
            <th className="r">Received</th>
            <th className="r">Temp °C</th>
          </tr>
        </thead>
        <tbody>
          {po.lines.map((l) => {
            const p = products.find((x) => x.sku === l.sku)!;
            const t = parseFloat(v(l.sku).temp);
            const warm = t > receiveLimitC(p.zone);
            return (
              <tr key={l.sku}>
                <td>
                  <div className="font-semibold">{p.name}</div>
                  <div className="code text-ink-3">{p.sku}</div>
                </td>
                <td className="r">{l.qty}</td>
                <td className="r">
                  <input className="input ml-auto h-8 w-20 text-right" value={v(l.sku).qty} onChange={(e) => setVals({ ...vals, [l.sku]: { ...v(l.sku), qty: e.target.value.replace(/\D/g, "") } })} />
                </td>
                <td className="r">
                  <input className={`input ml-auto h-8 w-20 text-right ${warm ? "border-bad text-bad" : ""}`} value={v(l.sku).temp} onChange={(e) => setVals({ ...vals, [l.sku]: { ...v(l.sku), temp: e.target.value } })} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-3 text-[13px] text-ink-3">Each line becomes a new lot in its home bin with a best-by from the product&rsquo;s shelf life. Warm lines go on QA hold automatically.</p>
    </Modal>
  );
}
