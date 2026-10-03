"use client";

import { Boxes, Building2, ChartColumn, Factory, Gauge, LogOut, ReceiptText, ScanBarcode, Truck, Wallet, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { canOpen, useAuth } from "@/lib/auth";
import { cx } from "./ui";

const SIDE = [
  { href: "/inventory", label: "Inventory", icon: Boxes },
  { href: "/production", label: "Production", icon: Factory },
];
const SIDE_RIGHT = [{ href: "/dispatch", label: "Delivery", icon: Truck }];

/** Screens without their own slot live under Sales. */
const SALES = [
  { href: "/sales", label: "Sales", sub: "Sold by product, with VAT", icon: ChartColumn },
  { href: "/counter", label: "Counter", sub: "Take an order", icon: ScanBarcode },
  { href: "/orders", label: "Orders", sub: "Every order and invoice", icon: ReceiptText },
  { href: "/clients", label: "Clients", sub: "Accounts, terms, balances", icon: Building2 },
];

const isActive = (path: string, href: string) => (href === "/" ? path === "/" : path.startsWith(href));

/** Phone navigation: Inventory · Production · Home · Delivery · Sales. Hidden once the sidebar shows. */
export function BottomNav() {
  const path = usePathname();
  const user = useAuth((s) => s.user);
  const logOut = useAuth((s) => s.logOut);
  // The menu belongs to the page it was opened on, so navigating closes it.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === path;
  const setOpen = (v: boolean) => setOpenOn(v ? path : null);
  // Staff do not see the sales report, so the menu is just "More" for them.
  const menu = SALES.filter((s) => user && canOpen(user.role, s.href));
  const menuLabel = menu.some((s) => s.href === "/sales") ? "Sales" : "More";
  const salesActive = menu.some((s) => isActive(path, s.href));

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="lg:hidden">
      {open && (
        <>
          <div className="fixed inset-0 z-40 bg-ink/30" onClick={() => setOpen(false)} aria-hidden />
          <div
            role="dialog"
            aria-label={menuLabel}
            className="rise fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom))] z-40 mx-2 mb-2 rounded-xl border border-line bg-panel p-2 shadow-lg"
          >
            <div className="flex items-center justify-between px-2 pt-1 pb-2">
              <span className="text-[13px] font-semibold tracking-[0.06em] text-ink-3 uppercase">{menuLabel}</span>
              <button className="btn btn-quiet btn-sm px-2" onClick={() => setOpen(false)} aria-label="Close">
                <X size={16} />
              </button>
            </div>
            {menu.map((s) => (
              <Link
                key={s.href}
                href={s.href}
                className={cx("flex items-center gap-3 rounded-lg px-3 py-2.5", isActive(path, s.href) ? "bg-ink text-white" : "hover:bg-sunk")}
              >
                <s.icon size={20} aria-hidden />
                <span className="leading-tight">
                  <span className="block text-[15px] font-semibold">{s.label}</span>
                  <span className={cx("block text-[13px]", isActive(path, s.href) ? "text-white/70" : "text-ink-3")}>{s.sub}</span>
                </span>
              </Link>
            ))}
            <div className="my-1 border-t border-line" />
            <button onClick={logOut} className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-sunk">
              <LogOut size={20} aria-hidden />
              <span className="leading-tight">
                <span className="block text-[15px] font-semibold">Log out</span>
                <span className="block truncate text-[13px] text-ink-3">{user?.email}</span>
              </span>
            </button>
          </div>
        </>
      )}

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-line bg-panel/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
      >
        {SIDE.map((n) => (
          <Tab key={n.href} href={n.href} label={n.label} icon={n.icon} active={isActive(path, n.href)} />
        ))}
        <Link href="/" aria-current={path === "/" ? "page" : undefined} className="flex h-16 flex-col items-center justify-center gap-0.5">
          <span className={cx("-mt-5 flex h-12 w-12 items-center justify-center rounded-full border-4 border-panel shadow-md", path === "/" ? "bg-brand text-white" : "bg-ink text-white")}>
            <Gauge size={22} aria-hidden />
          </span>
          <span className={cx("text-[12px] font-semibold", path === "/" ? "text-ink" : "text-ink-3")}>Home</span>
        </Link>
        {SIDE_RIGHT.map((n) => (
          <Tab key={n.href} href={n.href} label={n.label} icon={n.icon} active={isActive(path, n.href)} />
        ))}
        <button
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-haspopup="dialog"
          className={cx("flex h-16 cursor-pointer flex-col items-center justify-center gap-1", salesActive || open ? "text-ink" : "text-ink-3")}
        >
          <Wallet size={20} aria-hidden className={salesActive ? "text-brand" : undefined} />
          <span className="text-[12px] font-semibold">{menuLabel}</span>
        </button>
      </nav>
    </div>
  );
}

function Tab({ href, label, icon: Icon, active }: { href: string; label: string; icon: typeof Boxes; active: boolean }) {
  return (
    <Link href={href} aria-current={active ? "page" : undefined} className={cx("flex h-16 flex-col items-center justify-center gap-1", active ? "text-ink" : "text-ink-3")}>
      <Icon size={20} aria-hidden className={active ? "text-brand" : undefined} />
      <span className="text-[12px] font-semibold">{label}</span>
    </Link>
  );
}
