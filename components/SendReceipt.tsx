"use client";

import { Mail, MessageSquare } from "lucide-react";
import { useState } from "react";
import { dateTime, invoiceNumber } from "@/lib/format";
import { receiptHref, receiptMessage, receiptToError } from "@/lib/logic";
import { useStore, useUi } from "@/lib/store";
import type { Client, Order, ReceiptChannel } from "@/lib/types";
import { Field, Modal, cx } from "./ui";

/** Mobile numbers only: a landline can't take an SMS. */
const mobileOf = (c: Client) => (/^(\+?63|0)9/.test(c.phone.replace(/[\s()-]/g, "")) ? c.phone : "");

/**
 * Send the buyer a copy of the receipt. The prototype has no SMS or mail server, so this opens the
 * device's own SMS or mail app with the receipt filled in, and logs the send on the order.
 */
export function SendReceipt({ order, client, by, onClose }: { order: Order; client: Client; by: string; onClose: () => void }) {
  const seller = useStore((s) => s.seller);
  const logReceipt = useStore((s) => s.logReceipt);
  const toast = useUi((s) => s.toast);
  const [channel, setChannel] = useState<ReceiptChannel>(client.email ? "EMAIL" : "SMS");
  const [to, setTo] = useState<Record<ReceiptChannel, string>>({ EMAIL: client.email ?? "", SMS: mobileOf(client) });
  const [error, setError] = useState("");
  const msg = receiptMessage(order, client, seller, channel);
  const target = to[channel];

  function send(e: React.MouseEvent) {
    const r = logReceipt(order.id, channel, target, by);
    if (!r.ok) {
      e.preventDefault();
      return setError(r.error);
    }
    toast(`Receipt ${invoiceNumber(order.invoiceNo)} opened in your ${channel === "SMS" ? "messages" : "mail"} app`);
    onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      width={520}
      title={`Send receipt ${invoiceNumber(order.invoiceNo)}`}
      footer={
        <>
          {error && <p className="mr-auto text-small font-semibold text-bad">{error}</p>}
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <a className={cx("btn btn-primary", receiptToError(channel, target) && "opacity-60")} href={receiptHref(channel, target, msg)} onClick={send}>
            {channel === "SMS" ? <MessageSquare size={16} /> : <Mail size={16} />} Open in {channel === "SMS" ? "messages" : "mail"}
          </a>
        </>
      }
    >
      <div className="flex gap-2" role="group" aria-label="Send by">
        {(
          [
            ["EMAIL", "E-mail", Mail],
            ["SMS", "SMS", MessageSquare],
          ] as const
        ).map(([c, label, Icon]) => (
          <button
            key={c}
            onClick={() => {
              setChannel(c);
              setError("");
            }}
            aria-pressed={channel === c}
            className="chip flex-1 justify-center"
          >
            <Icon size={16} aria-hidden /> {label}
          </button>
        ))}
      </div>

      <Field label={channel === "SMS" ? "Mobile number" : "E-mail address"} className="mt-3" hint={channel === "SMS" && !mobileOf(client) ? `${client.name} has no mobile number on file.` : undefined}>
        <input
          className="input"
          type={channel === "SMS" ? "tel" : "email"}
          value={target}
          onChange={(e) => {
            setTo({ ...to, [channel]: e.target.value });
            setError("");
          }}
          placeholder={channel === "SMS" ? "0917 555 1234" : "name@example.com"}
        />
      </Field>

      <div className="mt-3">
        <div className="field-label">Message</div>
        {channel === "EMAIL" && <div className="mb-1 text-caption font-semibold">{msg.subject}</div>}
        <pre className="max-h-56 overflow-auto rounded-md border border-line bg-sunk p-3 font-sans text-caption whitespace-pre-wrap scroll-thin">{msg.body}</pre>
        <p className="mt-1.5 text-caption text-ink-3">Opens your {channel === "SMS" ? "messages" : "mail"} app with this filled in. Press send there.</p>
      </div>

      {(order.receipts?.length ?? 0) > 0 && (
        <div className="mt-3 border-t border-line pt-2 text-caption text-ink-3">
          {order.receipts!.map((r) => (
            <div key={r.at}>
              {r.channel === "SMS" ? "SMS" : "E-mail"} to {r.to}, {dateTime(r.at)}, by {r.by}
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
