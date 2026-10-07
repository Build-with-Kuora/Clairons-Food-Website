"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { dateKey } from "./format";
import { reservedByLot, salesOf, stockRows } from "./logic";
import { useStore } from "./store";

/** Re-render on an interval so relative times ("12 min ago", ETAs) stay honest. */
export function useNow(ms = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

/** Whether a media query matches, following changes. False on the server and before the app loads. */
export function useMedia(query: string) {
  const subscribe = useMemo(
    () => (onChange: () => void) => {
      const m = window.matchMedia(query);
      m.addEventListener("change", onChange);
      return () => m.removeEventListener("change", onChange);
    },
    [query],
  );
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, () => false);
}

export function useStock() {
  const products = useStore((s) => s.products);
  const lots = useStore((s) => s.lots);
  const orders = useStore((s) => s.orders);
  const deliveries = useStore((s) => s.deliveries);
  return useMemo(() => {
    const reserved = reservedByLot(orders, deliveries);
    return { reserved, rows: stockRows(products, lots, reserved) };
  }, [products, lots, orders, deliveries]);
}

/** Every order that counts as a sale so far, with when it counted. */
export function useSales() {
  const orders = useStore((s) => s.orders);
  const deliveries = useStore((s) => s.deliveries);
  return useMemo(() => salesOf(orders, deliveries), [orders, deliveries]);
}

export function useToday() {
  const now = useNow(60_000);
  return { now, today: dateKey(now) };
}

export function useMaps() {
  const clients = useStore((s) => s.clients);
  const products = useStore((s) => s.products);
  const orders = useStore((s) => s.orders);
  const routes = useStore((s) => s.routes);
  const riders = useStore((s) => s.riders);
  return useMemo(
    () => ({
      client: new Map(clients.map((c) => [c.id, c])),
      product: new Map(products.map((p) => [p.sku, p])),
      order: new Map(orders.map((o) => [o.id, o])),
      route: new Map(routes.map((r) => [r.id, r])),
      rider: new Map(riders.map((r) => [r.id, r])),
    }),
    [clients, products, orders, routes, riders],
  );
}
