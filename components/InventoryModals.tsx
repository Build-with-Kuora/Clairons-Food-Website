"use client";

import { useState } from "react";
import { ZONES, zoneOfBin } from "@/lib/logic";
import { useStore, useUi } from "@/lib/store";
import type { Lot } from "@/lib/types";
import { Field, Modal } from "./ui";

const BY = "Inventory";

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
          placeholder={releasing ? "Core temp −17°C on 3 cases, no ice crystals. OK to sell." : "Metal detector reject, damaged packaging…"}
          autoFocus
        />
      </Field>
    </Modal>
  );
}
