"use client";

import { useState } from "react";
import { unitPlural } from "@/lib/format";
import { CATEGORIES, HOME_ZONES, ZONES, nextSku } from "@/lib/logic";
import { useStore, useUi } from "@/lib/store";
import type { Category, Product, Tier, ZoneId } from "@/lib/types";
import { Field, Modal } from "./ui";

const TIERS: { t: Tier; label: string }[] = [
  { t: "C", label: "Walk-in and online price (C)" },
  { t: "B", label: "Standard price (B)" },
  { t: "A", label: "Contract price (A)" },
];

/** Add a product (no `product`) or edit one. Saving goes through the `saveProduct` store action. */
export function ProductForm({ product, onClose }: { product?: Product; onClose: () => void }) {
  const products = useStore((s) => s.products);
  const saveProduct = useStore((s) => s.saveProduct);
  const toast = useUi((s) => s.toast);
  const [f, setF] = useState(() => ({
    name: product?.name ?? "",
    category: product?.category ?? ("Dimsum" as Category),
    unit: product?.unit ?? "case",
    pack: product?.pack ?? "",
    caseKg: String(product?.caseKg ?? ""),
    catchWeight: product?.catchWeight ?? false,
    zone: product?.zone ?? ("FRZ" as ZoneId),
    bin: product?.bin ?? "",
    cost: String(product?.cost ?? ""),
    A: String(product?.price.A ?? ""),
    B: String(product?.price.B ?? ""),
    C: String(product?.price.C ?? ""),
    reorderPoint: String(product?.reorderPoint ?? ""),
    par: String(product?.par ?? ""),
    shelfDays: String(product?.shelfDays ?? ""),
    active: product?.active ?? true,
  }));
  const [error, setError] = useState("");
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  const unit = f.unit.trim().toLowerCase() || "unit";
  const per = f.catchWeight ? "kg" : unit;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const r = saveProduct({
      sku: product?.sku,
      name: f.name,
      category: f.category,
      unit: f.unit,
      pack: f.pack,
      caseKg: Number(f.caseKg),
      catchWeight: f.catchWeight,
      zone: f.zone,
      bin: f.bin,
      cost: Number(f.cost || 0),
      price: { A: Number(f.A), B: Number(f.B), C: Number(f.C) },
      reorderPoint: Number(f.reorderPoint),
      par: Number(f.par),
      shelfDays: Number(f.shelfDays),
      active: f.active,
    }, "Owner");
    if (!r.ok) return setError(r.error);
    toast(product ? `${r.product.name} saved` : `${r.product.name} added`);
    onClose();
  }

  const num = (k: "caseKg" | "cost" | "A" | "B" | "C" | "reorderPoint" | "par" | "shelfDays", step = "any") => (
    <input className="input" type="number" inputMode="decimal" min={0} step={step} value={f[k]} onChange={(e) => set(k, e.target.value)} />
  );

  return (
    <Modal
      open
      onClose={onClose}
      width={640}
      title={product ? `Edit ${product.sku}` : "Add product"}
      footer={
        <>
          {error && <p className="mr-auto text-small font-semibold text-bad">{error}</p>}
          <button className="btn btn-ghost" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" type="submit" form="product-form">
            {product ? "Save" : "Add product"}
          </button>
        </>
      }
    >
      <form id="product-form" onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
        <Field label="Name" className="sm:col-span-2">
          <input className="input" value={f.name} onChange={(e) => set("name", e.target.value)} autoFocus />
        </Field>
        <Field label="Category" hint={product ? undefined : `Product code will be ${nextSku(products, f.category)}`}>
          <select className="input" value={f.category} onChange={(e) => set("category", e.target.value as Category)} disabled={!!product}>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <label className="flex items-center gap-2 self-end pb-2 text-small">
          <input type="checkbox" className="accent-ink" checked={f.active} onChange={(e) => set("active", e.target.checked)} />
          Active: can be ordered and produced
        </label>

        <h3 className="field-label mt-2 sm:col-span-2">Selling unit</h3>
        <Field label="Unit" hint="Stock, production and sales count in this, e.g. case, pack, tray.">
          <input className="input" value={f.unit} onChange={(e) => set("unit", e.target.value)} />
        </Field>
        <Field label={`Inside one ${unit}`} hint="e.g. 10 × 50 pcs">
          <input className="input" value={f.pack} onChange={(e) => set("pack", e.target.value)} />
        </Field>
        <Field label={`Weight of one ${unit} (kg)`}>{num("caseKg")}</Field>
        <label className="flex items-center gap-2 self-end pb-2 text-small">
          <input type="checkbox" className="accent-ink" checked={f.catchWeight} onChange={(e) => set("catchWeight", e.target.checked)} />
          Sold by weight (priced per kg)
        </label>

        <h3 className="field-label mt-2 sm:col-span-2">Prices per {per}, VAT included</h3>
        {TIERS.map(({ t, label }) => (
          <Field key={t} label={label}>
            {num(t)}
          </Field>
        ))}
        <Field label={`Production cost per ${per}`}>{num("cost")}</Field>

        <h3 className="field-label mt-2 sm:col-span-2">Stock levels, in {unitPlural(unit)}</h3>
        <Field label="Make more when under" hint="“What to make” lists the product once available stock drops below this.">
          {num("reorderPoint", "1")}
        </Field>
        <Field label="Fill back up to" hint="The suggested batch brings available stock back up to this.">
          {num("par", "1")}
        </Field>

        <h3 className="field-label mt-2 sm:col-span-2">Storage</h3>
        <Field label="Stored in">
          <select className="input" value={f.zone} onChange={(e) => set("zone", e.target.value as ZoneId)}>
            {HOME_ZONES.map((z) => (
              <option key={z} value={z}>
                {ZONES[z].name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Storage bin" hint={`Starts with ${ZONES[f.zone].prefix}-, e.g. ${ZONES[f.zone].prefix}-01-A1`}>
          <input className="input uppercase" value={f.bin} onChange={(e) => set("bin", e.target.value)} />
        </Field>
        <Field label="Shelf life (days)">{num("shelfDays", "1")}</Field>
      </form>
    </Modal>
  );
}
