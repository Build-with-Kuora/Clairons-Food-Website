"use client";

import { Boxes, Building2, Factory, Gauge, ReceiptText, RotateCcw, ScanBarcode, Smartphone, Truck } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { clock, dayLong, tempBare } from "@/lib/format";
import { useNow } from "@/lib/hooks";
import { ZONES, ZONE_ORDER } from "@/lib/logic";
import { STORAGE_KEY, useStore, useUi } from "@/lib/store";
import { Logo } from "./Logo";
import { Toaster, cx } from "./ui";

const NAV = [
  { href: "/", label: "Today", icon: Gauge },
  { href: "/counter", label: "Counter", icon: ScanBarcode },
  { href: "/inventory", label: "Inventory", icon: Boxes },
  { href: "/production", label: "Production", icon: Factory },
  { href: "/dispatch", label: "Dispatch", icon: Truck },
  { href: "/orders", label: "Orders", icon: ReceiptText },
  { href: "/clients", label: "Clients", icon: Building2 },
];

function useBoot() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    Promise.resolve(useStore.persist.rehydrate()).then(() => {
      if (!useStore.getState().products.length) useStore.getState().reset();
      if (alive) setReady(true);
    });
    // Keep tabs in sync: the driver handheld and dispatch board share one store.
    const onStorage = (e: StorageEvent) => e.key === STORAGE_KEY && useStore.persist.rehydrate();
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

function ZoneStrip() {
  const zones = useStore((s) => s.zones);
  return (
    <div className="flex min-w-0 items-stretch overflow-x-auto scroll-thin" aria-label="Freezer temperatures">
      {ZONE_ORDER.map((id) => {
        const z = zones.find((x) => x.id === id);
        if (!z) return null;
        const cur = z.readings.at(-1) ?? z.setPointC;
        const alarm = cur > z.maxC;
        return (
          <Link
            key={id}
            href="/inventory?tab=zones"
            className="group flex items-center gap-2.5 border-l border-line px-4 py-1.5 hover:bg-sunk"
            title={`${z.name}: set ${tempBare(z.setPointC, 0)}C, alarm above ${tempBare(z.maxC, 0)}C`}
          >
            <span className="h-7 w-1 rounded-full" style={{ background: ZONES[id].color }} aria-hidden />
            <span className="leading-tight">
              <span className="block text-[12px] whitespace-nowrap text-ink-3">{z.name}</span>
              <span className={cx("display block text-[21px] font-semibold", alarm ? "text-bad" : "text-ink")}>
                {tempBare(cur)}
                <span className="ml-0.5 text-[13px] font-medium text-ink-3">C</span>
              </span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}

export default function Shell({ children }: { children: ReactNode }) {
  const ready = useBoot();
  const path = usePathname();
  const now = useNow(15_000);
  const reset = useStore((s) => s.reset);
  const toast = useUi((s) => s.toast);

  if (path.startsWith("/driver")) {
    return (
      <>
        {ready ? children : <Boot />}
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
          {NAV.map((n) => {
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
        <div className="mx-4 my-4 border-t border-line" />
        <Link href="/driver" target="_blank" className="mx-2 flex h-10 items-center gap-3 rounded-md px-3 text-[15px] font-semibold text-ink-2 hover:bg-sunk hover:text-ink">
          <Smartphone size={18} aria-hidden />
          Driver handheld
        </Link>
        <p className="mx-5 mt-1 text-[12.5px] leading-snug text-ink-3">Opens in a new tab. Stops you complete there show up on Dispatch.</p>
        <div className="mt-auto border-t border-line p-4">
          <div className="text-[13px] text-ink-3">Signed in at</div>
          <div className="text-[14px] font-semibold">Front counter, Dock 1</div>
          <button
            className="btn btn-quiet btn-sm mt-3 -ml-2.5"
            onClick={() => {
              reset();
              toast("Demo data reset to this morning");
            }}
          >
            <RotateCcw size={14} /> Reset demo data
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="sticky top-0 z-30 border-b border-line bg-panel/95 backdrop-blur">
          <div className="flex items-center justify-between gap-4 pl-4 lg:pl-6">
            <div className="flex shrink-0 items-center gap-3 py-2">
              <Logo height={30} className="lg:hidden" />
              <div className="leading-tight">
                <div className="text-[14px] font-semibold whitespace-nowrap">{dayLong(now)}</div>
                <div className="text-[13px] text-ink-3">{clock(now)}</div>
              </div>
            </div>
            {ready && <ZoneStrip />}
          </div>
          <nav className="flex gap-1 overflow-x-auto border-t border-line px-2 py-1 lg:hidden scroll-thin">
            {NAV.map((n) => {
              const active = n.href === "/" ? path === "/" : path.startsWith(n.href);
              return (
                <Link key={n.href} href={n.href} className={cx("rounded px-3 py-1.5 text-[14px] font-semibold whitespace-nowrap", active ? "bg-ink text-white" : "text-ink-2")}>
                  {n.label}
                </Link>
              );
            })}
            <Link href="/driver" className="rounded px-3 py-1.5 text-[14px] font-semibold whitespace-nowrap text-ink-2">
              Driver
            </Link>
          </nav>
        </div>
        <main className="min-w-0 flex-1 px-4 py-6 lg:px-6">{ready ? children : <Boot />}</main>
      </div>
      <Toaster />
    </div>
  );
}

function Boot() {
  return <div className="p-10 text-[14px] text-ink-3">Loading this morning&rsquo;s stock and routes…</div>;
}
