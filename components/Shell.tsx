"use client";

import { Boxes, Building2, ChartColumn, Factory, Gauge, LogOut, ReceiptText, RotateCcw, ScanBarcode, Truck } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { AUTH_KEY, ROLE_LABEL, canOpen, homeFor, useAuth, type Role } from "@/lib/auth";
import { useCart } from "@/lib/cart";
import { clock, dayLong } from "@/lib/format";
import { useNow } from "@/lib/hooks";
import { STORAGE_KEY, useStore, useUi } from "@/lib/store";
import { BottomNav } from "./BottomNav";
import { Logo } from "./Logo";
import { Toaster, cx } from "./ui";

const NAV = [
  { href: "/", label: "Today", icon: Gauge },
  { href: "/counter", label: "Counter", icon: ScanBarcode },
  { href: "/inventory", label: "Inventory", icon: Boxes },
  { href: "/production", label: "Production", icon: Factory },
  { href: "/dispatch", label: "Delivery", icon: Truck },
  { href: "/sales", label: "Sales", icon: ChartColumn },
  { href: "/orders", label: "Orders", icon: ReceiptText },
  { href: "/clients", label: "Clients", icon: Building2 },
];

function useBoot() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    Promise.all([useStore.persist.rehydrate(), useAuth.persist.rehydrate(), useCart.persist.rehydrate()]).then(() => {
      if (!useStore.getState().products.length) useStore.getState().reset();
      if (alive) setReady(true);
    });
    // Keep tabs in sync: the driver handheld and dispatch board share one store, and logging out logs out every tab.
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) useStore.persist.rehydrate();
      if (e.key === AUTH_KEY) useAuth.persist.rehydrate();
    };
    window.addEventListener("storage", onStorage);
    const t = setInterval(() => useStore.getState().tick(), 30_000);
    return () => {
      alive = false;
      window.removeEventListener("storage", onStorage);
      clearInterval(t);
    };
  }, []);
  return ready;
}

/**
 * Where to send someone who may not see this path. Logged out goes to /login, and comes back to the
 * store page they were on after logging in. Anyone else goes to their home page.
 */
function redirectFor(path: string, role: Role | undefined) {
  if (!role) return canOpen(role, path) ? null : path.startsWith("/shop") ? `/login?next=${encodeURIComponent(path)}` : "/login";
  if (path.startsWith("/login")) return nextFrom(role) ?? homeFor(role);
  if (!canOpen(role, path)) return homeFor(role);
  return null;
}

/** The ?next= page on /login, when the role may open it. */
function nextFrom(role: Role) {
  const next = new URLSearchParams(window.location.search).get("next");
  return next?.startsWith("/") && canOpen(role, next) ? next : null;
}

export default function Shell({ children }: { children: ReactNode }) {
  const ready = useBoot();
  const path = usePathname();
  const now = useNow(15_000);
  const reset = useStore((s) => s.reset);
  const toast = useUi((s) => s.toast);
  const user = useAuth((s) => s.user);
  const logOut = useAuth((s) => s.logOut);
  const router = useRouter();
  const to = ready ? redirectFor(path, user?.role) : null;
  const show = ready && !to;

  useEffect(() => {
    if (to) router.replace(to);
  }, [to, router]);

  // Login stands alone: no sidebar or header.
  if (path.startsWith("/login")) {
    return (
      <>
        {show && children}
        <Toaster />
      </>
    );
  }

  // The driver handheld and the online store bring their own header.
  if (path.startsWith("/driver") || path.startsWith("/shop")) {
    return (
      <>
        {show ? children : <Boot />}
        <Toaster />
      </>
    );
  }

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-[212px] shrink-0 flex-col border-r border-line bg-panel lg:flex">
        <Link href="/" className="block px-4 pt-5 pb-5" aria-label="Clairon's Food Coldline, go to Today">
          <Logo height={56} />
          <div className="mt-1.5 text-[12.5px] font-semibold tracking-[0.08em] text-ink-3 uppercase">Coldline</div>
        </Link>
        <nav className="flex flex-col gap-0.5 px-2">
          {NAV.filter((n) => user && canOpen(user.role, n.href)).map((n) => {
            const active = n.href === "/" ? path === "/" : path.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={cx(
                  "flex h-10 items-center gap-3 rounded-md px-3 text-[15px] font-semibold",
                  active ? "bg-ink text-white" : "text-ink-2 hover:bg-sunk hover:text-ink",
                )}
              >
                <n.icon size={18} strokeWidth={2} className={active ? "text-brand" : undefined} aria-hidden />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto border-t border-line p-4">
          <div className="text-[13px] text-ink-3">Signed in as {user && ROLE_LABEL[user.role]}</div>
          <div className="truncate text-[14px] font-semibold" title={user?.email}>
            {user?.email}
          </div>
          <button className="btn btn-quiet btn-sm mt-3 -ml-2.5" onClick={logOut}>
            <LogOut size={14} /> Log out
          </button>
          {user?.role === "admin" && (
            <button
              className="btn btn-quiet btn-sm mt-1 -ml-2.5"
              onClick={() => {
                reset();
                toast("Demo data reset to this morning");
              }}
            >
              <RotateCcw size={14} /> Reset demo data
            </button>
          )}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="sticky top-0 z-30 border-b border-line bg-panel/95 backdrop-blur">
          <div className="flex items-center justify-between gap-4 pl-4 lg:pl-6">
            <div className="flex shrink-0 items-center gap-3 py-2">
              <Logo height={30} className="lg:hidden" />
              <div className="leading-tight">
                <div className="text-[14px] font-semibold whitespace-nowrap" suppressHydrationWarning>
                  {dayLong(now)}
                </div>
                <div className="text-[13px] text-ink-3" suppressHydrationWarning>
                  {clock(now)}
                </div>
              </div>
            </div>
          </div>
        </div>
        <main className="min-w-0 flex-1 px-4 pt-6 pb-[calc(88px+env(safe-area-inset-bottom))] lg:px-6 lg:pb-6">{show ? children : <Boot />}</main>
      </div>
      <BottomNav />
      <Toaster aboveNav />
    </div>
  );
}

function Boot() {
  return <div className="p-10 text-[14px] text-ink-3">Loading this morning&rsquo;s stock and routes…</div>;
}
