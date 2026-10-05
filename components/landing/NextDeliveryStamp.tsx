"use client";

import { useSyncExternalStore } from "react";
import { dayShort, keyToTs } from "@/lib/format";
import { deliveryDays } from "@/lib/logic";

const noSubscribe = () => () => {};
const nextDelivery = () => dayShort(keyToTs(deliveryDays(Date.now(), 1)[0]));

/** The first day checkout would offer, stamped onto the case label. Client-only so the date is the visitor's today. */
export function NextDeliveryStamp() {
  const day = useSyncExternalStore(noSubscribe, nextDelivery, () => null);
  return (
    <div className="lp-stamp" data-on={day ? "true" : "false"} aria-hidden={!day}>
      <div className="text-[0.72rem] font-bold tracking-[0.12em] uppercase">Order now, delivered</div>
      <div className="lp-display text-[1.7rem] leading-none">{day ?? " "}</div>
    </div>
  );
}
