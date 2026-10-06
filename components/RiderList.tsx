"use client";

import { Bike, Pencil, Plus } from "lucide-react";
import { useState } from "react";
import { dateKey } from "@/lib/format";
import { useNow } from "@/lib/hooks";
import { type RiderInput, useStore, useUi } from "@/lib/store";
import type { Rider } from "@/lib/types";
import { Badge, Empty, Field, Modal, Panel, cx } from "./ui";

/** Motorbike riders for small drops: add, edit, or take one off the roster. */
export function RiderList() {
  const riders = useStore((s) => s.riders);
  const deliveries = useStore((s) => s.deliveries);
  const today = dateKey(useNow(60_000));
  const [editing, setEditing] = useState<Rider | "new" | null>(null);

  return (
    <Panel
      title="Riders"
      actions={
        <button className="btn btn-primary btn-sm" onClick={() => setEditing("new")}>
          <Plus size={14} /> Add rider
        </button>
      }
      bodyClass="p-0"
    >
      {riders.length === 0 ? (
        <Empty title="No riders yet">Add a rider to send small drops by motorbike.</Empty>
      ) : (
        <div className="overflow-x-auto scroll-thin">
          <table className="tbl min-w-[560px]">
            <thead>
              <tr>
                <th>Rider</th>
                <th>Motorbike</th>
                <th className="r">Stops today</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {riders.map((r) => {
                const n = deliveries.filter((d) => d.riderId === r.id && d.date === today).length;
                return (
                  <tr key={r.id} className={cx(!r.active && "text-ink-3")}>
                    <td>
                      <div className="font-semibold">{r.name}</div>
                      <div className="text-caption text-ink-3">{r.phone || "No phone"}</div>
                    </td>
                    <td className="text-ink-2">{r.bike || "–"}</td>
                    <td className="r font-semibold">{n || "–"}</td>
                    <td>{r.active ? <Badge tone="good">Active</Badge> : <Badge>Off roster</Badge>}</td>
                    <td className="r">
                      <button className="btn btn-quiet btn-sm" onClick={() => setEditing(r)}>
                        <Pencil size={14} /> Edit
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {editing && <RiderForm key={editing === "new" ? "new" : editing.id} rider={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />}
    </Panel>
  );
}

function RiderForm({ rider, onClose }: { rider?: Rider; onClose: () => void }) {
  const save = useStore((s) => s.saveRider);
  const toast = useUi((s) => s.toast);
  const [v, setV] = useState<RiderInput>(rider ?? { name: "", phone: "", bike: "", active: true });
  const [error, setError] = useState("");
  const set = (k: keyof RiderInput) => (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: k === "active" ? e.target.checked : e.target.value });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const r = save(v);
    if (!r.ok) return setError(r.error);
    toast(rider ? `${r.rider.name} updated` : `${r.rider.name} added to the riders`);
    onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={rider ? `Edit ${rider.name}` : "Add a rider"}
      width={460}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" type="submit" form="rider-form">
            <Bike size={16} /> {rider ? "Save rider" : "Add rider"}
          </button>
        </>
      }
    >
      <form id="rider-form" onSubmit={submit} className="flex flex-col gap-3">
        <Field label="Name">
          <input className="input" value={v.name} onChange={set("name")} autoFocus required />
        </Field>
        <Field label="Phone">
          <input className="input" type="tel" inputMode="tel" value={v.phone} onChange={set("phone")} placeholder="0917 555 0000" />
        </Field>
        <Field label="Motorbike and plate">
          <input className="input" value={v.bike} onChange={set("bike")} placeholder="Honda Click, NBC 4512" />
        </Field>
        <label className="flex cursor-pointer items-center gap-2 text-small">
          <input type="checkbox" checked={v.active} onChange={set("active")} className="accent-ink" />
          On the roster (can be given stops)
        </label>
        {error && <p className="text-small font-semibold text-bad">{error}</p>}
      </form>
    </Modal>
  );
}
