"use client";

import { Boxes, ChartColumn, Factory, LayoutDashboard, LogOut, PanelLeftClose, PanelLeftOpen, Plus, ReceiptText, RotateCcw, ScanBarcode, Search, Sun, Truck, Users } from "lucide-react";
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
  const [collapsed, setCollapsed] = useCollapsed();
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

  // The public landing and contact pages read no store data, so they render without waiting for boot.
  if (path.startsWith("/landing") || path.startsWith("/contact")) return <>{children}</>;

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

  function search(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const term = new FormData(e.currentTarget).get("q")?.toString().trim();
    if (!term) return;
    // Inventory starts its table from this search, and restarts it when a new one comes in.
    useUi.getState().searchInventory(term);
    router.push(`/inventory?q=${encodeURIComponent(term)}`);
  }

  return (
    // The frame is the sidebar's black; the content sits on it as a light panel with a curved left edge.
    <div className="flex min-h-screen bg-page lg:bg-side">
      <aside className={cx("sticky top-0 hidden h-screen shrink-0 flex-col bg-side text-side-ink transition-[width] duration-200 lg:flex", collapsed ? "w-[92px]" : "w-[264px]")}>
        <div className={cx("flex items-center gap-2 border-b border-white/10 py-5", collapsed ? "flex-col px-3" : "justify-between px-5")}>
          <Link href="/" className="block rounded-xl bg-white px-2.5 py-2" aria-label="Clairon's Food Coldline, go to the dashboard">
            <Logo height={collapsed ? 22 : 38} />
          </Link>
          <button
            className="grid h-9 w-9 cursor-pointer place-items-center rounded-lg text-side-ink-2 transition-colors hover:bg-white/10 hover:text-white"
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? "Expand the sidebar" : "Collapse the sidebar"}
            aria-pressed={collapsed}
          >
            {collapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
          </button>
        </div>

        <div className={cx("pt-6 pb-2 text-[13px] font-semibold tracking-[0.08em] text-side-ink-2 uppercase", collapsed ? "text-center" : "px-7")}>Menu</div>
        <nav aria-label="Main" className="flex flex-col gap-0.5 overflow-y-auto px-3 scroll-thin">
          {tabs.map((n) => {
            const active = isActive(path, n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? "page" : undefined}
                title={collapsed ? n.label : undefined}
                className={cx(
                  "flex h-12 items-center gap-3.5 rounded-xl text-[16.5px] font-medium transition-colors focus-visible:outline-white",
                  collapsed ? "justify-center" : "px-4",
                  active ? "text-brand" : "text-side-ink-2 hover:bg-white/5 hover:text-white",
                )}
              >
                <n.icon size={22} strokeWidth={active ? 2.2 : 1.8} aria-hidden />
                {!collapsed && n.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto">
          <div className={cx("flex items-center gap-3 border-t border-white/10 py-4", collapsed ? "flex-col px-3" : "px-5")}>
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand text-[16px] font-bold text-white uppercase" aria-hidden title={user?.email}>
              {user?.email.charAt(0)}
            </span>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15px] font-semibold" title={user?.email}>
                  {user?.email}
                </div>
                <div className="text-[13px] text-side-ink-2">{user && ROLE_LABEL[user.role]}</div>
              </div>
            )}
            <button
              className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-lg text-side-ink-2 transition-colors hover:bg-white/10 hover:text-white"
              onClick={logOut}
              aria-label="Log out"
              title="Log out"
            >
              <LogOut size={18} />
            </button>
          </div>
          {user?.role === "admin" && !collapsed && (
            <button
              className="mx-5 mb-4 -mt-1 flex cursor-pointer items-center gap-1.5 text-[12.5px] text-side-ink-2 hover:text-white"
              onClick={() => {
                reset();
                toast("Demo data reset to this morning");
              }}
            >
              <RotateCcw size={13} /> Reset demo data
            </button>
          )}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col bg-page lg:rounded-l-[36px]">
        <header className="sticky top-0 z-30 border-b border-line bg-panel lg:rounded-tl-[36px]">
          <div className="flex min-h-[72px] items-center justify-between gap-4 px-4 lg:min-h-[96px] lg:px-9">
            <div className="flex min-w-0 items-center gap-3 py-2">
              <Logo height={30} className="lg:hidden" />
              {home ? (
                <div className="flex min-w-0 items-center gap-3">
                  <Sun size={30} className="hidden shrink-0 text-brand sm:block" aria-hidden />
                  <div className="min-w-0 leading-tight">
                    <div className="display truncate text-[24px] font-semibold lg:text-[34px]">Hello, {user ? ROLE_LABEL[user.role] : "there"}</div>
                    <div className="text-[13.5px] text-ink-3" suppressHydrationWarning>
                      {dayLong(now)}, {clock(now)}
                    </div>
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
                  <div className="display truncate text-[22px] font-semibold lg:text-[28px]">{here?.label}</div>
                </div>
              )}
            </div>

            <form onSubmit={search} role="search" className="relative mx-4 hidden max-w-[520px] flex-1 xl:block">
              <Search size={20} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-ink-3" aria-hidden />
              <input name="q" className="input h-12 rounded-xl border-line bg-sunk/60 pl-12 text-[15px]" placeholder="Search products by name or SKU" aria-label="Search products" />
            </form>

            <div className="flex shrink-0 items-center gap-4">
              {!home && (
                <div className="hidden text-right leading-tight md:block xl:hidden 2xl:block">
                  <div className="text-[14px] font-semibold whitespace-nowrap" suppressHydrationWarning>
                    {dayLong(now)}
                  </div>
                  <div className="text-[13px] text-ink-3" suppressHydrationWarning>
                    {clock(now)}
                  </div>
                </div>
              )}
              {canSell && path !== "/counter" && (
                <Link href="/counter" className="flex h-11 items-center gap-2.5 rounded-xl border border-line bg-sunk/60 pr-2 pl-4 text-[15px] font-semibold transition-colors hover:border-line-2 hover:bg-sunk lg:h-12 lg:pl-5">
                  <span className="hidden sm:inline">New order</span>
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-brand text-white" aria-hidden>
                    <Plus size={17} strokeWidth={2.6} />
                  </span>
                  <span className="sr-only sm:hidden">New order</span>
                </Link>
              )}
            </div>
          </div>
        </header>
        <main className="min-w-0 flex-1 px-4 pt-6 pb-[calc(88px+env(safe-area-inset-bottom))] lg:px-9 lg:pt-7 lg:pb-9">{show ? children : <Boot />}</main>
      </div>
      <BottomNav />
      <Toaster aboveNav />
    </div>
  );
}

const COLLAPSE_KEY = "coldline-sidebar";

/** Whether the desktop sidebar is folded to icons. Remembered per browser; a convenience, so failures are ignored. */
function useCollapsed() {
  const [collapsed, setState] = useState(false);
  useEffect(() => {
    let alive = true;
    Promise.resolve().then(() => {
      try {
        if (alive && localStorage.getItem(COLLAPSE_KEY) === "1") setState(true);
      } catch {}
    });
    return () => {
      alive = false;
    };
  }, []);
  const setCollapsed = (v: boolean) => {
    setState(v);
    try {
      localStorage.setItem(COLLAPSE_KEY, v ? "1" : "0");
    } catch {}
  };
  return [collapsed, setCollapsed] as const;
}

function Boot() {
  return <div className="p-10 text-[14px] text-ink-3">Loading this morning&rsquo;s stock and routes…</div>;
}
