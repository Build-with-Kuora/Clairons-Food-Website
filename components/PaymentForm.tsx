"use client";

import { useState } from "react";
import { money } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import { PAYMENT_LABEL, applyPayment, paymentError, round2 } from "@/lib/logic";
import { useStore, useUi } from "@/lib/store";
import type { Client, PaymentMethod } from "@/lib/types";
import { Field } from "./ui";

const METHODS: PaymentMethod[] = ["CHECK", "BANK", "CASH", "GCASH"];

/** Money an account customer paid. It comes off what they owe, overdue first, and pays their oldest invoices. */
export function PaymentForm({ client: c, onDone, onCancel }: { client: Client; onDone: () => void; onCancel: () => void }) {
  const receive = useStore((s) => s.receivePayment);
  const orders = useStore((s) => s.orders);
  const deliveries = useStore((s) => s.deliveries);
  const toast = useUi((s) => s.toast);
  const by = useAuth((s) => (s.user?.role === "admin" ? "Owner" : "Counter 1"));
  const [amount, setAmount] = useState(() => (c.pastDue > 0 ? c.pastDue : c.balance).toFixed(2));
  const [method, setMethod] = useState<PaymentMethod>("CHECK");
  const [ref, setRef] = useState("");
  const [error, setError] = useState<string | null>(null);

  const n = round2(parseFloat(amount.replace(/[₱,\s]/g, "")) || 0);
  const preview = n > 0 && n <= c.balance ? applyPayment(orders, deliveries, c.id, n) : undefined;
  const invoices = preview?.applied.length ?? 0;
  const quick = [
    ...(c.pastDue > 0 ? [{ label: "Overdue", value: c.pastDue }] : []),
    { label: "Whole balance", value: c.balance },
  ];

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const err = paymentError(c, n, method, ref);
    if (err) return setError(err);
    const r = receive({ clientId: c.id, amount: n, method, ref }, by);
    if (!r.ok) return setError(r.error);
    toast(`${money(n)} received from ${c.name}`);
    onDone();
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <p className="text-body text-ink-2">
        {c.name} owes <span className="font-semibold text-ink">{money(c.balance)}</span>
        {c.pastDue > 0 && (
          <>
            , <span className="font-semibold text-bad">{money(c.pastDue)} overdue</span>
          </>
        )}
        .
      </p>

      <Field
        label="Amount received"
        hint={
          preview &&
          (invoices
            ? `Goes to their oldest ${invoices === 1 ? "invoice" : `${invoices} invoices`} first${preview.rest > 0 ? `, then ${money(preview.rest)} to older balance` : ""}.`
            : "Goes to their older balance.")
        }
      >
        <input
          className="input text-lead font-semibold"
          inputMode="decimal"
          value={amount}
          onChange={(e) => {
            setAmount(e.target.value);
            setError(null);
          }}
          aria-invalid={!!error}
        />
      </Field>
      <div className="-mt-2 flex flex-wrap gap-2">
        {quick.map((q) => (
          <button key={q.label} type="button" className="chip" aria-pressed={n === round2(q.value)} onClick={() => setAmount(q.value.toFixed(2))}>
            {q.label} {money(q.value)}
          </button>
        ))}
      </div>

      <div>
        <div className="field-label">Paid by</div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Paid by">
          {METHODS.map((m) => (
            <button
              key={m}
              type="button"
              className="chip"
              aria-pressed={method === m}
              onClick={() => {
                setMethod(m);
                setError(null);
              }}
            >
              {PAYMENT_LABEL[m]}
            </button>
          ))}
        </div>
      </div>

      {method !== "CASH" && (
        <Field label={method === "CHECK" ? "Check number" : method === "BANK" ? "Transfer reference (optional)" : "GCash reference (optional)"}>
          <input className="input" value={ref} onChange={(e) => setRef(e.target.value)} placeholder={method === "CHECK" ? "e.g. 004512" : "e.g. 1234 5678 9012"} />
        </Field>
      )}

      {error && <p className="text-small font-semibold text-bad">{error}</p>}

      <div className="flex justify-end gap-2">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary">
          Record {n > 0 ? money(n) : "payment"}
        </button>
      </div>
    </form>
  );
}
