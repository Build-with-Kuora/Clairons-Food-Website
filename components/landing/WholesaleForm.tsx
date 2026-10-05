"use client";

import { Check } from "lucide-react";
import { useState, type FormEvent } from "react";
import { SERVICE_AREAS } from "@/lib/logic";

const TYPES = ["Carinderia or restaurant", "Food cart or kiosk", "School or hospital canteen", "Caterer", "Supermarket or store", "Something else"];
const CITIES = Object.keys(SERVICE_AREAS);

type Fields = { name: string; business: string; type: string; phone: string; city: string; message: string };
const EMPTY: Fields = { name: "", business: "", type: "", phone: "", city: "", message: "" };

function errorsOf(f: Fields) {
  const e: Partial<Record<keyof Fields, string>> = {};
  if (!f.name.trim()) e.name = "Enter your name.";
  if (!f.business.trim()) e.business = "Enter your business name.";
  if (!f.type) e.type = "Pick what kind of business it is.";
  if (!/^(\+?63|0)9\d{9}$/.test(f.phone.replace(/[\s-]/g, ""))) e.phone = "Enter a mobile number like 0917 555 1234.";
  if (!f.city) e.city = "Pick the city we would deliver to.";
  return e;
}

export function WholesaleForm() {
  const [f, setF] = useState<Fields>(EMPTY);
  const [tried, setTried] = useState(false);
  const [sent, setSent] = useState<Fields | null>(null);
  const errors = tried ? errorsOf(f) : {};

  const set = (k: keyof Fields) => (e: { target: { value: string } }) => setF((s) => ({ ...s, [k]: e.target.value }));

  function submit(e: FormEvent) {
    e.preventDefault();
    setTried(true);
    if (Object.keys(errorsOf(f)).length) return;
    setSent(f);
    setF(EMPTY);
    setTried(false);
  }

  if (sent) {
    return (
      <div className="lp-label p-6" role="status">
        <div className="lp-mark lp-mark-red mb-4">
          <Check size={22} strokeWidth={2.5} aria-hidden />
        </div>
        <h3 className="lp-display lp-h3">Inquiry sent</h3>
        <p className="lp-body mt-2">
          Thanks, {sent.name.trim().split(" ")[0]}. Clairon&rsquo;s will get back to {sent.business} on {sent.phone}.
        </p>
        <p className="mt-3 text-[0.9rem] text-[var(--lp-ink-2)]">Prototype: this form does not send anything yet.</p>
        <button type="button" className="lp-btn lp-btn-ink lp-btn-sm mt-5" onClick={() => setSent(null)}>
          Send another
        </button>
      </div>
    );
  }

  const field = (k: keyof Fields) => ({
    id: `wf-${k}`,
    value: f[k],
    onChange: set(k),
    "aria-invalid": errors[k] ? true : undefined,
    "aria-describedby": errors[k] ? `wf-${k}-err` : undefined,
  });
  const err = (k: keyof Fields) =>
    errors[k] && (
      <p id={`wf-${k}-err`} className="lp-error">
        {errors[k]}
      </p>
    );

  return (
    <form onSubmit={submit} noValidate className="lp-label grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
      <div>
        <label htmlFor="wf-name" className="lp-flabel">
          Your name
        </label>
        <input className="lp-input" autoComplete="name" {...field("name")} />
        {err("name")}
      </div>
      <div>
        <label htmlFor="wf-phone" className="lp-flabel">
          Mobile number
        </label>
        <input className="lp-input" type="tel" inputMode="tel" autoComplete="tel" placeholder="0917 555 1234" {...field("phone")} />
        {err("phone")}
      </div>
      <div>
        <label htmlFor="wf-business" className="lp-flabel">
          Business name
        </label>
        <input className="lp-input" autoComplete="organization" {...field("business")} />
        {err("business")}
      </div>
      <div>
        <label htmlFor="wf-type" className="lp-flabel">
          Kind of business
        </label>
        <select className="lp-input" {...field("type")}>
          <option value="">Choose one</option>
          {TYPES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        {err("type")}
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="wf-city" className="lp-flabel">
          Deliver to
        </label>
        <select className="lp-input" {...field("city")}>
          <option value="">Choose a city</option>
          {CITIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        {err("city")}
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="wf-message" className="lp-flabel">
          What do you need? <span className="font-normal text-[var(--lp-ink-2)]">(optional)</span>
        </label>
        <textarea className="lp-input" rows={3} placeholder="For example: 10 cases of siomai and 5 of fishballs every week" {...field("message")} />
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 sm:col-span-2">
        <button type="submit" className="lp-btn lp-btn-red">
          Send inquiry
        </button>
        <span className="text-[0.9rem] text-[var(--lp-ink-2)]">Prototype: nothing is sent yet.</span>
      </div>
    </form>
  );
}
