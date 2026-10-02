"use client";

import { money } from "@/lib/format";
import { useMaps } from "@/lib/hooks";
import { carrierOf, simpleStatus, type SimpleStatus } from "@/lib/logic";
import type { Delivery } from "@/lib/types";
import { AssignCarrier } from "./AssignCarrier";
import { Badge, Empty, cx } from "./ui";

const TONE: Record<SimpleStatus, "neutral" | "accent" | "good" | "bad"> = {
  Pending: "neutral",
  "Out for delivery": "accent",
  Delivered: "good",
  Problem: "bad",
};

/** Every stop for a day as one flat list: who carries it, the customer, and the order amount. */
export function DeliveryTable({ stops, selectedId, onSelect }: { stops: Delivery[]; selectedId?: string; onSelect: (id: string) => void }) {
  const maps = useMaps();
  const rows = stops
    .map((d) => ({ d, carrier: carrierOf(d, maps.route, maps.rider), o: maps.order.get(d.orderId) }))
    .sort((a, b) => a.carrier.person.localeCompare(b.carrier.person) || a.d.seq - b.d.seq);
  const total = rows.reduce((t, r) => t + (r.o?.total ?? 0), 0);

  if (!rows.length) return <Empty title="No deliveries this day">Place a delivery order on the Counter to schedule one.</Empty>;

  return (
    <div className="overflow-x-auto scroll-thin">
      <table className="tbl min-w-[640px]">
        <thead>
          <tr>
            <th>Rider or driver</th>
            <th>Customer</th>
            <th className="r">Amount</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ d, o }) => {
            const c = maps.client.get(d.clientId);
            const st = simpleStatus(d.status);
            return (
              <tr key={d.id} className={cx("clickable", selectedId === d.id && "selected")} onClick={() => onSelect(d.id)}>
                <td>
                  <AssignCarrier delivery={d} className="font-semibold" />
                </td>
                <td>
                  <div className="font-semibold">{c?.name}</div>
                  <div className="text-[12.5px] text-ink-3">
                    {c?.city}, {o?.number}
                  </div>
                  {d.note && <div className="max-w-[280px] truncate text-[12.5px] text-ink-2">Note: {d.note}</div>}
                </td>
                <td className="r font-semibold">{o ? money(o.total) : "–"}</td>
                <td>
                  <Badge tone={TONE[st]}>{st}</Badge>
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={2} className="font-semibold">
              {rows.length} {rows.length === 1 ? "delivery" : "deliveries"}
            </td>
            <td className="r font-semibold">{money(total)}</td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
