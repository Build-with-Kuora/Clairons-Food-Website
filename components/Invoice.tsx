"use client";

import { dateTime, dayShort, keyToTs, money } from "@/lib/format";
import { PAY_LABEL, TERMS_LABEL } from "@/lib/logic";
import type { Client, Delivery, Order, Product, Route } from "@/lib/types";
import { Mark } from "./Shell";

/** Invoice / pick ticket. Doubles as the printed copy that rides with the load. */
export function Invoice({
  order,
  client,
  delivery,
  route,
  products,
}: {
  order: Order;
  client: Client;
  delivery?: Delivery;
  route?: Route;
  products: Map<string, Product>;
}) {
  const cases = order.lines.reduce((s, l) => s + l.qty, 0);
  const kg = order.lines.reduce((s, l) => s + (l.estKg ?? (products.get(l.sku)?.caseKg ?? 0) * l.qty), 0);
  return (
    <div className="print-area bg-white p-6 text-[13.5px] text-ink">
      <div className="flex items-start justify-between gap-6 border-b-2 border-ink pb-4">
        <div className="flex items-center gap-3">
          <Mark size={36} />
          <div>
            <div className="display text-[24px] leading-none font-bold">Clairon&rsquo;s Foods</div>
            <div className="text-[12.5px] text-ink-3">Frozen dimsum, streetfood and meats. 88 Sto. Cristo St, Binondo, Manila</div>
          </div>
        </div>
        <div className="text-right">
          <div className="display text-[26px] leading-none font-semibold">{order.fulfillment === "PICKUP" ? "Will-call receipt" : "Invoice"}</div>
          <div className="code mt-1 text-[14px] font-medium">{order.number}</div>
          <div className="text-[12.5px] text-ink-3">{dateTime(order.createdAt)}</div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 border-b border-line py-3">
        <div>
          <div className="text-[12px] text-ink-3">Bill to</div>
          <div className="font-semibold">{client.name}</div>
          <div>{client.address}</div>
          <div>{client.city}</div>
        </div>
        <div>
          <div className="text-[12px] text-ink-3">{order.fulfillment === "PICKUP" ? "Picked up" : "Ship to"}</div>
          {order.fulfillment === "PICKUP" ? (
            <div className="font-semibold">At dock, will-call</div>
          ) : (
            <>
              <div className="font-semibold">{delivery ? dayShort(keyToTs(delivery.date)) : ""}, {client.window}</div>
              <div>
                {route?.name}, stop {delivery?.seq}
              </div>
              <div className="text-ink-3">{route?.truck}</div>
            </>
          )}
        </div>
        <div>
          <div className="text-[12px] text-ink-3">Terms</div>
          <div className="font-semibold">{TERMS_LABEL[client.terms]}, price tier {client.tier}</div>
          <div>Paid by: {PAY_LABEL[order.payMethod]}</div>
          {order.clientPo && <div>Client PO {order.clientPo}</div>}
        </div>
      </div>

      <table className="mt-2 w-full text-[13px]">
        <thead>
          <tr className="border-b border-line text-left text-[12px] text-ink-3">
            <th className="py-1.5 pr-2 font-semibold">Item</th>
            <th className="py-1.5 pr-2 font-semibold">Lots (FEFO)</th>
            <th className="py-1.5 pr-2 text-right font-semibold">Cases</th>
            <th className="py-1.5 pr-2 text-right font-semibold">Price</th>
            <th className="py-1.5 text-right font-semibold">Amount</th>
          </tr>
        </thead>
        <tbody>
          {order.lines.map((l) => (
            <tr key={l.sku} className="border-b border-line/60 align-top">
              <td className="py-1.5 pr-2">
                <div className="font-semibold">{l.name}</div>
                <div className="text-ink-3">
                  <span className="code">{l.sku}</span> {products.get(l.sku)?.pack}
                  {l.catchWeight && `, est. ${l.estKg} kg, billed at actual weight`}
                </div>
              </td>
              <td className="code py-1.5 pr-2 text-ink-2">{l.allocs.map((a) => `${a.lotCode}×${a.qty}`).join(" ")}</td>
              <td className="py-1.5 pr-2 text-right">{l.qty}</td>
              <td className="py-1.5 pr-2 text-right">
                {money(l.unitPrice)}
                <span className="text-ink-3">/{l.catchWeight ? "kg" : "cs"}</span>
              </td>
              <td className="py-1.5 text-right font-semibold">{money(l.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-3 flex items-start justify-between gap-6">
        <div className="text-[12.5px] text-ink-3">
          {cases} cases, about {Math.round(kg)} kg. Keep frozen at −18°C or colder.
          <br />
          Claims for shortage or temperature must be noted on the delivery receipt.
          {order.notes && (
            <div className="mt-2 text-ink">
              <span className="font-semibold">Note:</span> {order.notes}
            </div>
          )}
        </div>
        <dl className="w-60 shrink-0 text-[13.5px]">
          <div className="flex justify-between py-0.5">
            <dt>Subtotal</dt>
            <dd>{money(order.subtotal)}</dd>
          </div>
          {order.dropFee > 0 && (
            <div className="flex justify-between py-0.5">
              <dt>Small-drop fee</dt>
              <dd>{money(order.dropFee)}</dd>
            </div>
          )}
          {order.fuel > 0 && (
            <div className="flex justify-between py-0.5">
              <dt>Fuel surcharge</dt>
              <dd>{money(order.fuel)}</dd>
            </div>
          )}
          <div className="flex justify-between py-0.5 text-[12.5px] text-ink-3">
            <dt>VATable sales</dt>
            <dd>{money(order.total / 1.12)}</dd>
          </div>
          <div className="flex justify-between py-0.5 text-[12.5px] text-ink-3">
            <dt>VAT 12%, included</dt>
            <dd>{money(order.total - order.total / 1.12)}</dd>
          </div>
          <div className="mt-1 flex justify-between border-t-2 border-ink pt-1.5 text-[16px] font-bold">
            <dt>Total</dt>
            <dd>{money(order.total)}</dd>
          </div>
          <div className="mt-0.5 text-right text-[12.5px] text-ink-3">{order.paid ? "Paid" : order.payMethod === "COD" ? "Driver collects on delivery" : "Charged to account"}</div>
        </dl>
      </div>
    </div>
  );
}
