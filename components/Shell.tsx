"use client";

import { Boxes, ChartColumn, Factory, LayoutDashboard, LogOut, Plus, ReceiptText, RotateCcw, ScanBarcode, Truck, Users } from "lucide-react";
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

/** The main tabs, in the client's order. Routes keep their original names; only the labels changed. */
export const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/counter", label: "POS", icon: ScanBarcode },
  { href: "/inventory", label: "Inventory", icon: Boxes },
  { href: "/dispatch", label: "Delivery", icon: Truck },
  { href: "/sales", label: "Sales", icon: ChartColumn },
  { href: "/orders", label: "Orders", icon: ReceiptText },
  { href: "/clients", label: "Customers", icon: Users },
  { href: "/production", label: "Production", icon: Factory },
];

const isActive = (path: string, href: string) => (href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`));

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

  const tabs = NAV.filter((n) => user && canOpen(user.role, n.href));
  const here = NAV.find((n) => isActive(path, n.href));
  const home = path === "/";
  const canSell = !!user && canOpen(user.role, "/counter");

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-[248px] shrink-0 flex-col bg-side text-side-ink lg:flex">
        <Link href="/" className="mx-4 mt-5 mb-6 block rounded-2xl bg-white px-4 py-3" aria-label="Clairon's Food Coldline, go to the dashboard">
          <Logo height={46} />
          <div className="mt-1 text-[12px] font-semibold tracking-[0.12em] text-ink-3 uppercase">Coldline</div>
        </Link>
        <div className="px-6 pb-2 text-[12px] font-semibold tracking-[0.1em] text-side-ink-2 uppercase">Menu</div>
        <nav aria-label="Main" className="flex flex-col gap-1 overflow-y-auto px-3 scroll-thin">
          {tabs.map((n) => {
            const active = isActive(path, n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "flex h-11 items-center gap-3 rounded-xl px-3.5 text-[15.5px] font-semibold transition-colors focus-visible:outline-white",
                  active ? "bg-brand text-white" : "text-side-ink-2 hover:bg-side-2 hover:text-white",
                )}
              >
                <n.icon size={19} strokeWidth={2} aria-hidden />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="mx-3 mt-auto mb-4 rounded-2xl bg-side-2 p-4">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand text-[15px] font-bold text-white uppercase" aria-hidden>
              {user?.email.charAt(0)}
            </span>
            <div className="min-w-0">
              <div className="truncate text-[14px] font-semibold" title={user?.email}>
                {user?.email}
              </div>
              <div className="text-[13px] text-side-ink-2">{user && ROLE_LABEL[user.role]}</div>
            </div>
          </div>
          <div className="mt-3 flex flex-col items-start gap-0.5">
            <button className="btn btn-sm -ml-2.5 border-transparent bg-transparent text-side-ink-2 hover:bg-white/10 hover:text-white" onClick={logOut}>
              <LogOut size={14} /> Log out
            </button>
            {user?.role === "admin" && (
              <button
                className="btn btn-sm -ml-2.5 border-transparent bg-transparent text-side-ink-2 hover:bg-white/10 hover:text-white"
                onClick={() => {
                  reset();
                  toast("Demo data reset to this morning");
                }}
              >
                <RotateCcw size={14} /> Reset demo data
              </button>
            )}
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-line bg-panel/95 backdrop-blur">
          <div className="flex min-h-[68px] items-center justify-between gap-4 px-4 lg:px-7">
            <div className="flex min-w-0 items-center gap-3 py-2">
              <Logo height={30} className="lg:hidden" />
              {home ? (
                <div className="min-w-0 leading-tight">
                  <div className="display truncate text-[24px] font-semibold lg:text-[28px]">Hello, {user ? ROLE_LABEL[user.role] : "there"}</div>
                  <div className="text-[13.5px] text-ink-3" suppressHydrationWarning>
                    {dayLong(now)}, {clock(now)}
                  </div>
                </div>
              ) : (
                <div className="min-w-0 leading-tight">
                  <nav aria-label="Breadcrumb" className="hidden text-[13px] text-ink-3 sm:block">
                    <Link href="/" className="hover:text-ink">
                      Home
                    </Link>
                    <span className="mx-1.5" aria-hidden>
                      /
                    </span>
                    <span className="text-ink-2">{here?.label}</span>
                  </nav>
                  <div className="display truncate text-[22px] font-semibold">{here?.label}</div>
                </div>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-4">
              {!home && (
                <div className="hidden text-right leading-tight md:block">
                  <div className="text-[14px] font-semibold whitespace-nowrap" suppressHydrationWarning>
                    {dayLong(now)}
                  </div>
                  <div className="text-[13px] text-ink-3" suppressHydrationWarning>
                    {clock(now)}
                  </div>
                </div>
              )}
              {canSell && path !== "/counter" && (
                <Link href="/counter" className="btn btn-primary h-10 rounded-xl px-4">
                  <Plus size={17} strokeWidth={2.4} /> <span className="hidden sm:inline">New order</span>
                </Link>
              )}
            </div>
          </div>
        </header>
        <main className="min-w-0 flex-1 px-4 pt-6 pb-[calc(88px+env(safe-area-inset-bottom))] lg:px-7 lg:pb-8">{show ? children : <Boot />}</main>
      </div>
      <BottomNav />
      <Toaster aboveNav />
    </div>
  );
}

function Boot() {
  return <div className="p-10 text-[14px] text-ink-3">Loading this morning&rsquo;s stock and routes…</div>;
}
