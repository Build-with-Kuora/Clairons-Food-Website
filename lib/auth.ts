"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type Role = "admin" | "staff" | "rider";

export interface Account {
  email: string;
  password: string;
  role: Role;
}

export interface User {
  email: string;
  role: Role;
}

/**
 * Prototype only. There is no database yet (spec 10.2, 10.3), so the demo logins live in the
 * front end and anyone can read them in the page source. Never put real passwords here.
 */
export const DEMO_ACCOUNTS: Account[] = [
  { email: "admin@clairon.com", password: "12345678", role: "admin" },
  { email: "staff@clairon.com", password: "12345678", role: "staff" },
  { email: "rider@clairon.com", password: "12345678", role: "rider" },
];

export const AUTH_KEY = "coldline-auth";
export const PASSWORD_MIN = 8;

export const ROLE_LABEL: Record<Role, string> = { admin: "Admin", staff: "Staff", rider: "Rider" };

/** Where each role lands after logging in. Riders only get the driver handheld. */
export const homeFor = (role: Role) => (role === "rider" ? "/driver" : "/");

/**
 * What each role may open (spec 10.3). Admin is the owner and sees everything. Staff run the counter,
 * warehouse, production and dispatch, but not the sales report. Riders only get the driver handheld.
 */
const STAFF_BLOCKED = ["/sales"];

export function canOpen(role: Role, path: string) {
  const under = (p: string) => path === p || path.startsWith(`${p}/`);
  if (role === "rider") return under("/driver");
  if (role === "staff") return !STAFF_BLOCKED.some(under);
  return true;
}

/** Only the owner sets prices and products, approves orders past a credit hold, and resets the demo. */
export const useIsAdmin = () => useAuth((s) => s.user?.role === "admin");

type Result = { ok: true; user: User } | { ok: false; error: string };

interface Auth {
  user: User | null;
  /** Accounts made with Sign up in this browser. New accounts are staff. */
  accounts: Account[];
  logIn(email: string, password: string): Result;
  signUp(email: string, password: string): Result;
  logOut(): void;
}

const norm = (email: string) => email.trim().toLowerCase();

export const useAuth = create<Auth>()(
  persist(
    (set, get) => ({
      user: null,
      accounts: [],

      logIn: (email, password) => {
        const e = norm(email);
        const acc = [...DEMO_ACCOUNTS, ...get().accounts].find((a) => a.email === e);
        if (!acc || acc.password !== password) return { ok: false, error: "Wrong email or password." };
        const user = { email: acc.email, role: acc.role };
        set({ user });
        return { ok: true, user };
      },

      signUp: (email, password) => {
        const e = norm(email);
        if ([...DEMO_ACCOUNTS, ...get().accounts].some((a) => a.email === e)) return { ok: false, error: "An account with this email already exists. Log in instead." };
        if (password.length < PASSWORD_MIN) return { ok: false, error: `Use at least ${PASSWORD_MIN} characters.` };
        const acc: Account = { email: e, password, role: "staff" };
        const user = { email: e, role: acc.role };
        set((s) => ({ accounts: [...s.accounts, acc], user }));
        return { ok: true, user };
      },

      logOut: () => set({ user: null }),
    }),
    {
      name: AUTH_KEY,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
    },
  ),
);
