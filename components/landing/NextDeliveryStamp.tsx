"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { dayShort, keyToTs } from "@/lib/format";
import { deliveryDays } from "@/lib/logic";

const noSubscribe = () => () => {};
const nextDelivery = () => dayShort(keyToTs(deliveryDays(Date.now(), 1)[0]));

/** The first day checkout would offer, stamped on when it scrolls into view. Client-only so the date is the visitor's today. */
export function NextDeliveryStamp() {
  const day = useSyncExternalStore(noSubscribe, nextDelivery, () => null);
  const ref = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setSeen(true);
          io.disconnect();
        }
      },
      { threshold: 0.6 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className="lp-stamp shrink-0" data-on={day && seen ? "true" : "false"} aria-hidden={!day}>
      <div className="text-[0.72rem] font-bold tracking-[0.12em] uppercase">Order now, delivered</div>
      <div className="lp-display text-[1.7rem] leading-none">{day ?? " "}</div>
    </div>
  );
}
