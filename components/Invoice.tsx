"use client";

import { dateTime, dayShort, invoiceNumber, keyToTs, money, units } from "@/lib/format";
import { PAY_LABEL, TERMS_LABEL, buyerName, commonUnit, isWalkIn, vatSplit } from "@/lib/logic";
import { useStore } from "@/lib/store";
import type { Client, Delivery, Order, Product, Rider, Route } from "@/lib/types";
import { Logo } from "./Logo";

/** Sales invoice with the details BIR asks for. Doubles as the printed copy that rides with the load. */
export function Invoice({
  order,
  client,
  delivery,
  route,
  rider,
  products,
}: {
  order: Order;
  client: Client;
  delivery?: Delivery;
  route?: Route;
  rider?: Rider;
  products: Map<string, Product>;
}) {
  const cases = order.lines.reduce((s, l) => s + l.qty, 0);
  const unit = commonUnit(order.lines.map((l) => products.get(l.sku)));
  const kg = order.lines.reduce((s, l) => s + (l.estKg ?? (products.get(l.sku)?.caseKg ?? 0) * l.qty), 0);
  const seller = useStore((s) => s.seller);
  const v = vatSplit(order.total);
  const cancelled = order.status === "CANCELLED";
  return (
    <div className="print-area relative bg-white p-6 text-[13.5px] text-ink">
      {cancelled && (
        <div className="pointer-events-none absolute inset-x-0 top-40 flex justify-center" aria-hidden>
          <span className="-rotate-12 rounded border-4 border-bad px-4 py-1 text-[40px] font-bold tracking-[0.2em] text-bad opacity-60">CANCELLED</span>
        </div>
      )}
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 border-b-2 border-ink pb-4">
        <div className="flex items-start gap-3">
          <Logo height={40} />
          <div className="text-[12.5px] leading-snug">
            <div className="font-semibold">{seller.registeredName}</div>
            <div className="text-ink-2">{seller.address}</div>
            <div className="text-ink-2">VAT Reg. TIN {seller.tin}</div>
            <div className="text-ink-3">
              {seller.phone}, {seller.email}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="display text-[26px] leading-none font-semibold">Sales invoice</div>
          <div className="code mt-1 text-[15px] font-semibold">No. {invoiceNumber(order.invoiceNo)}</div>
          <div className="text-[12.5px] text-ink-3">
            {dateTime(order.createdAt)}, order {order.number}
          </div>
          {cancelled && <div className="text-[12.5px] font-semibold text-bad">Cancelled</div>}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 border-b border-line py-3">
        <div>
          <div className="text-[12px] text-ink-3">Bill to</div>
          <div className="font-semibold">{buyerName(order, client)}</div>
          {client.address && <div>{client.address}</div>}
          {client.city && <div>{client.city}</div>}
          {client.tin && <div>TIN {client.tin}</div>}
        </div>
        <div>
          <div className="text-[12px] text-ink-3">{order.fulfillment === "PICKUP" ? "Picked up" : "Ship to"}</div>
          {order.fulfillment === "PICKUP" ? (
            <div className="font-semibold">Walk-in, at the counter</div>
          ) : (
            <>
              <div className="font-semibold">{delivery ? dayShort(keyToTs(delivery.date)) : ""}, {client.window}</div>
              {rider ? (
                <>
                  <div>Rider drop, {rider.name}</div>
                  <div className="text-ink-3">{rider.bike}</div>
                </>
              ) : (
                <>
                  <div>
                    {route?.name}, stop {delivery?.seq}
                  </div>
                  <div className="text-ink-3">{route?.truck}</div>
                </>
              )}
            </>
          )}
        </div>
        <div>
          <div className="text-[12px] text-ink-3">Terms</div>
          <div className="font-semibold">{isWalkIn(client) ? "Paid at the counter" : `${TERMS_LABEL[client.terms]}, price tier ${client.tier}`}</div>
          <div>Paid by: {PAY_LABEL[order.payMethod]}</div>
          {order.clientPo && <div>Client PO {order.clientPo}</div>}
        </div>
      </div>

      <table className="mt-2 w-full text-[13px]">
        <thead>
          <tr className="border-b border-line text-left text-[12px] text-ink-3">
            <th className="py-1.5 pr-2 font-semibold">Item</th>
            <th className="py-1.5 pr-2 font-semibold">Lots (FEFO)</th>
            <th className="py-1.5 pr-2 text-right font-semibold">Qty</th>
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
                  <span className="code">{l.sku}</span> per {products.get(l.sku)?.unit}, {products.get(l.sku)?.pack}
                  {l.catchWeight && `, est. ${l.estKg} kg, billed at actual weight`}
                </div>
              </td>
              <td className="code py-1.5 pr-2 text-ink-2">{l.allocs.map((a) => `${a.lotCode}×${a.qty}`).join(" ")}</td>
              <td className="py-1.5 pr-2 text-right">{l.qty}</td>
              <td className="py-1.5 pr-2 text-right">
                {money(l.unitPrice)}
                <span className="text-ink-3">/{l.catchWeight ? "kg" : products.get(l.sku)?.unit}</span>
              </td>
              <td className="py-1.5 text-right font-semibold">{money(l.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-3 flex items-start justify-between gap-6">
        <div className="text-[12.5px] text-ink-3">
          {units(cases, unit)}, about {Math.round(kg)} kg. Keep frozen at −18°C or colder.
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
          <div className="mt-1 border-t border-line pt-1 text-[12.5px] text-ink-3">
            <div className="flex justify-between py-0.5">
              <dt>VATable sales</dt>
              <dd>{money(v.net)}</dd>
            </div>
            <div className="flex justify-between py-0.5">
              <dt>VAT-exempt sales</dt>
              <dd>{money(0)}</dd>
            </div>
            <div className="flex justify-between py-0.5">
              <dt>Zero-rated sales</dt>
              <dd>{money(0)}</dd>
            </div>
            <div className="flex justify-between py-0.5">
              <dt>VAT 12%, included</dt>
              <dd>{money(v.vat)}</dd>
            </div>
          </div>
          <div className="mt-1 flex justify-between border-t-2 border-ink pt-1.5 text-[16px] font-bold">
            <dt>Total</dt>
            <dd>{money(order.total)}</dd>
          </div>
          <div className="mt-0.5 text-right text-[12.5px] text-ink-3">{order.paid ? "Paid" : order.payMethod === "COD" ? "Driver collects on delivery" : "Charged to account"}</div>
        </dl>
      </div>

      <div className="mt-4 border-t border-line pt-2 text-[11.5px] leading-snug text-ink-3">
        <div>
          BIR Permit to Use No. {seller.permitNo}, issued {seller.permitDate}. Series {invoiceNumber(seller.seriesFrom)} to {invoiceNumber(seller.seriesTo)}.
        </div>
        {seller.sample && <div className="font-semibold text-warn">Sample seller details for the prototype. Not a valid invoice.</div>}
      </div>
    </div>
  );
}
