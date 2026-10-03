"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export const CART_KEY = "coldline-cart";

/** Most a shopper can put in the cart of one product; bigger buyers order through the counter. */
export const CART_MAX = 20;

export interface CartLine {
  sku: string;
  qty: number;
}

interface Cart {
  lines: CartLine[];
  add(sku: string, qty?: number): void;
  setQty(sku: string, qty: number): void;
  clear(): void;
}

/** The online store's cart. Kept in this browser until checkout places the order. */
export const useCart = create<Cart>()(
  persist(
    (set) => ({
      lines: [],
      add: (sku, qty = 1) =>
        set((s) => {
          const have = s.lines.find((l) => l.sku === sku)?.qty ?? 0;
          const next = Math.min(CART_MAX, have + qty);
          return { lines: have ? s.lines.map((l) => (l.sku === sku ? { ...l, qty: next } : l)) : [...s.lines, { sku, qty: next }] };
        }),
      setQty: (sku, qty) =>
        set((s) => ({
          lines: qty <= 0 ? s.lines.filter((l) => l.sku !== sku) : s.lines.map((l) => (l.sku === sku ? { ...l, qty: Math.min(CART_MAX, qty) } : l)),
        })),
      clear: () => set({ lines: [] }),
    }),
    {
      name: CART_KEY,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
    },
  ),
);
