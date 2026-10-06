"use client";

import { useState } from "react";
import { dayShort, keyToTs } from "@/lib/format";
import { useToday } from "@/lib/hooks";
import { NOTE_MAX, RESCHEDULABLE } from "@/lib/logic";
import { useStore, useUi } from "@/lib/store";
import type { Delivery } from "@/lib/types";

const BY = "Dispatch";

/** Delivery day and dispatch's note for one stop. The day locks once the stop is loaded; the note once it is closed. */
export function StopPlan({ delivery: d }: { delivery: Delivery }) {
  const reschedule = useStore((s) => s.rescheduleDelivery);
  const setNote = useStore((s) => s.setDeliveryNote);
  const toast = useUi((s) => s.toast);
  const { today } = useToday();
  const [note, setDraft] = useState(d.note ?? "");
  const movable = RESCHEDULABLE.includes(d.status);
  const closed = d.status === "DELIVERED" || d.status === "EXCEPTION";
  const dirty = note.trim() !== (d.note ?? "");

  function saveNote() {
    const r = setNote(d.id, note, BY);
    if (!r.ok) return toast(r.error, "warn");
    toast(note.trim() ? "Note saved, the driver sees it on their phone" : "Note removed");
  }

  return (
    <div className="mt-3 grid gap-3 sm:grid-cols-[auto_1fr]">
      <label className="block">
        <span className="field-label">Delivery day</span>
        {movable ? (
          <input
            className="input w-auto"
            type="date"
            value={d.date}
            min={today}
            onChange={(e) => {
              if (!e.target.value) return;
              const r = reschedule(d.id, e.target.value, BY);
              if (!r.ok) return toast(r.error, "warn");
              toast(`Moved to ${dayShort(keyToTs(e.target.value))}`);
            }}
          />
        ) : (
          <span className="block py-1.5 text-small font-semibold">{dayShort(keyToTs(d.date))}</span>
        )}
        <span className="mt-1 block text-caption text-ink-3">{movable ? "Change before the stop is loaded." : "Locked once loaded."}</span>
      </label>
      <div className="min-w-0">
        <label className="block">
          <span className="field-label">Note for the driver</span>
          {closed ? (
            <span className="block py-1.5 text-small">{d.note ?? <span className="text-ink-3">No note</span>}</span>
          ) : (
            <textarea
              className="input min-h-[38px] py-1.5"
              rows={2}
              maxLength={NOTE_MAX}
              value={note}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Gate code, call ahead, bring the receiving copy…"
            />
          )}
        </label>
        {!closed && dirty && (
          <div className="mt-1.5 flex gap-2">
            <button className="btn btn-primary btn-sm" onClick={saveNote}>
              Save note
            </button>
            <button className="btn btn-quiet btn-sm" onClick={() => setDraft(d.note ?? "")}>
              Undo
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
