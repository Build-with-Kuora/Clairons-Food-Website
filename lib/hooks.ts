"use client";

import { useEffect, useMemo, useState } from "react";
import { dateKey } from "./format";
import { reservedByLot, stockRows } from "./logic";
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

export function useToday() {
  const now = useNow(60_000);
  return { now, today: dateKey(now) };
}

export function useMaps() {
  const clients = useStore((s) => s.clients);
  const products = useStore((s) => s.products);
  const orders = useStore((s) => s.orders);
  const routes = useStore((s) => s.routes);
  return useMemo(
    () => ({
      client: new Map(clients.map((c) => [c.id, c])),
      product: new Map(products.map((p) => [p.sku, p])),
      order: new Map(orders.map((o) => [o.id, o])),
      route: new Map(routes.map((r) => [r.id, r])),
    }),
    [clients, products, orders, routes],
  );
}

/** Read a query param once. Pages only render on the client (see Shell), so window is available. */
export function queryParam(key: string) {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get(key);
}
