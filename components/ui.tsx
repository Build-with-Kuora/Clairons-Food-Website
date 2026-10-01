"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  MapPin,
  PackageCheck,
  PackageSearch,
  Truck,
  X,
} from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { STATUS_LABEL, ZONES } from "@/lib/logic";
import { tempBare } from "@/lib/format";
import type { DeliveryStatus, ZoneId } from "@/lib/types";
import { useUi } from "@/lib/store";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

export function PageHead({ title, sub, actions }: { title: string; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="display text-[34px] leading-none font-semibold">{title}</h1>
        {sub && <p className="mt-1.5 text-[14.5px] text-ink-2">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Panel({
  title,
  actions,
  children,
  className,
  bodyClass,
  edge,
}: {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClass?: string;
  /** A colored left edge: used only when the panel belongs to a storage zone. */
  edge?: string;
}) {
  return (
    <section
      className={cx("relative min-w-0 rounded-[10px] border border-line bg-panel", className)}
      style={edge ? { boxShadow: `inset 4px 0 0 ${edge}` } : undefined}
    >
      {title && (
        <div className="flex min-h-12 items-center justify-between gap-3 border-b border-line px-4 py-2">
          <h2 className="display text-[19px] font-semibold">{title}</h2>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={bodyClass ?? "p-4"}>{children}</div>
    </section>
  );
}

type Tone = "neutral" | "good" | "warn" | "bad" | "cyan" | "ink";

const toneClass: Record<Tone, string> = {
  neutral: "bg-sunk text-ink-2 border-line",
  good: "bg-good-bg text-good border-good/25",
  warn: "bg-warn-bg text-warn border-warn/25",
  bad: "bg-bad-bg text-bad border-bad/25",
  cyan: "bg-cyan-bg text-cyan border-cyan/25",
  ink: "bg-ink text-white border-ink",
};

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cx(
        "inline-flex h-[22px] items-center gap-1 rounded border px-1.5 text-[12.5px] font-semibold whitespace-nowrap",
        toneClass[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

const STATUS_ICON: Record<DeliveryStatus, typeof Truck> = {
  SCHEDULED: Clock3,
  PICKING: PackageSearch,
  LOADED: PackageCheck,
  EN_ROUTE: Truck,
  ARRIVED: MapPin,
  DELIVERED: CheckCircle2,
  EXCEPTION: AlertTriangle,
};

const STATUS_TONE: Record<DeliveryStatus, Tone> = {
  SCHEDULED: "neutral",
  PICKING: "neutral",
  LOADED: "neutral",
  EN_ROUTE: "cyan",
  ARRIVED: "cyan",
  DELIVERED: "good",
  EXCEPTION: "bad",
};

export function StatusPill({ status }: { status: DeliveryStatus }) {
  const Icon = STATUS_ICON[status];
  return (
    <Badge tone={STATUS_TONE[status]}>
      <Icon size={13} strokeWidth={2.4} aria-hidden />
      {STATUS_LABEL[status]}
    </Badge>
  );
}

export function ZoneTag({ zone, temp = true }: { zone: ZoneId; temp?: boolean }) {
  const z = ZONES[zone];
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] whitespace-nowrap text-ink-2">
      <span className="h-2.5 w-2.5 rounded-[2px]" style={{ background: z.color }} aria-hidden />
      {z.name}
      {temp && <span className="text-ink-3">{tempBare(z.setPointC, 0)}</span>}
    </span>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  width = 560,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const first = ref.current?.querySelector<HTMLElement>("[autofocus], input, select, textarea, button:not([data-close])");
    first?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      prev?.focus?.();
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/45 p-4 pt-[8vh]" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        className="rise w-full rounded-xl border border-line bg-panel shadow-[0_24px_60px_-20px_rgba(15,37,52,0.45)]"
        style={{ maxWidth: width }}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <h2 className="display text-[22px] font-semibold">{title}</h2>
          <button className="btn btn-quiet btn-sm" onClick={onClose} aria-label="Close" data-close>
            <X size={16} />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4 scroll-thin">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

export function Drawer({ open, onClose, title, sub, children, footer }: { open: boolean; onClose: () => void; title: ReactNode; sub?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-ink/30" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside role="dialog" aria-modal="true" className="rise flex h-full w-full max-w-[700px] flex-col border-l border-line bg-panel shadow-[-20px_0_50px_-30px_rgba(15,37,52,0.5)]">
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h2 className="display text-[24px] leading-tight font-semibold">{title}</h2>
            {sub && <div className="mt-1 text-[14px] text-ink-2">{sub}</div>}
          </div>
          <button className="btn btn-quiet btn-sm" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 scroll-thin">{children}</div>
        {footer && <div className="flex flex-wrap items-center gap-2 border-t border-line px-5 py-3">{footer}</div>}
      </aside>
    </div>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: string; count?: number }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-line scroll-thin">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={value === t.id}
          onClick={() => onChange(t.id)}
          className={cx(
            "relative -mb-px flex h-10 cursor-pointer items-center gap-2 border-b-2 px-3 text-[14.5px] font-semibold whitespace-nowrap",
            value === t.id ? "border-ink text-ink" : "border-transparent text-ink-3 hover:text-ink",
          )}
        >
          {t.label}
          {t.count !== undefined && (
            <span className={cx("rounded px-1.5 text-[12px]", value === t.id ? "bg-ink text-white" : "bg-sunk text-ink-3")}>{t.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

export function Field({ label, hint, children, className }: { label: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cx("block", className)}>
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[12.5px] text-ink-3">{hint}</span>}
    </label>
  );
}

/** Stock level against reorder point and par: the bar fills to on-hand, ticks mark the thresholds. */
export function LevelBar({ value, reorder, par, width = 96 }: { value: number; reorder: number; par: number; width?: number }) {
  const max = Math.max(par * 1.15, value, 1);
  const pct = (n: number) => `${Math.min(100, (n / max) * 100)}%`;
  const tone = value <= 0 ? "var(--color-bad)" : value < reorder ? "var(--color-warn)" : "var(--color-ink-2)";
  return (
    <span className="relative inline-block h-2 rounded-full bg-sunk align-middle" style={{ width }} title={`On hand ${value}, reorder at ${reorder}, par ${par}`}>
      <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: pct(value), background: tone }} />
      <span className="absolute -top-0.5 h-3 w-px bg-warn" style={{ left: pct(reorder) }} />
      <span className="absolute -top-0.5 h-3 w-px bg-ink-3" style={{ left: pct(par) }} />
    </span>
  );
}

export function Signature({ value, className }: { value?: string; className?: string }) {
  if (!value) return <span className="text-[13px] text-ink-3">No signature</span>;
  if (value.startsWith("svg:"))
    return (
      <svg viewBox="0 0 220 60" className={cx("h-14 w-full max-w-[240px]", className)} aria-label="Signature">
        <path d={value.slice(4)} fill="none" stroke="var(--color-ink)" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={value} alt="Signature" className={cx("h-14 w-auto max-w-[240px]", className)} />;
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
      <p className="text-[15px] font-semibold">{title}</p>
      {children && <div className="text-[14px] text-ink-3">{children}</div>}
    </div>
  );
}

export function Toaster() {
  const toasts = useUi((s) => s.toasts);
  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-[60] flex flex-col items-end gap-2" aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cx(
            "rise pointer-events-auto max-w-sm rounded-lg border px-4 py-2.5 text-[14px] font-medium shadow-lg",
            t.tone === "ok" ? "border-ink bg-ink text-white" : "border-warn/40 bg-warn-bg text-warn",
          )}
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded border border-line-2 bg-white px-1 font-mono text-[11px] text-ink-2">{children}</kbd>;
}
