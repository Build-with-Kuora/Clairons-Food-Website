"use client";

import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  MapPin,
  PackageCheck,
  PackageSearch,
  TrendingDown,
  TrendingUp,
  Truck,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { STATUS_LABEL, ZONES, isFreezing, pctChange, readyAt } from "@/lib/logic";
import { clock, dateTime, startOfDay, tempBare } from "@/lib/format";
import type { DeliveryStatus, Lot, ZoneId } from "@/lib/types";
import { useUi } from "@/lib/store";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

/**
 * The line under the page header: a one-sentence summary and the page's actions. The page name itself is
 * already the header's title (Shell), so `title` is only for a section heading that differs from it.
 */
export function PageHead({ title, sub, actions }: { title?: string; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
      <div className="min-w-0 max-w-[75ch]">
        {title && <h2 className="display text-heading font-semibold">{title}</h2>}
        {sub && <p className={cx("text-lead text-ink-2", title && "mt-1")}>{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/** White rounded card. Every block on every screen sits in one. */
export function Panel({
  title,
  sub,
  actions,
  children,
  className,
  bodyClass,
  edge,
}: {
  title?: ReactNode;
  sub?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClass?: string;
  /** A colored left edge: used only when the panel belongs to a storage zone. */
  edge?: string;
}) {
  return (
    <section
      className={cx("relative min-w-0 rounded-2xl border border-line/70 bg-panel shadow-card", className)}
      style={edge ? { boxShadow: `inset 4px 0 0 ${edge}, var(--shadow-card)` } : undefined}
    >
      {title && (
        <div className="flex min-h-16 flex-wrap items-center justify-between gap-x-3 gap-y-2 px-5 pt-5 pb-2 sm:px-6">
          <div className="min-w-0">
            <h2 className="display text-title leading-tight font-semibold">{title}</h2>
            {sub && <p className="mt-0.5 hint">{sub}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={bodyClass ?? (title ? "px-5 pt-2 pb-5 sm:px-6 sm:pb-6" : "p-5 sm:p-6")}>{children}</div>
    </section>
  );
}

/** Pill-shaped single choice, e.g. 7 / 14 / 30 days. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
}: {
  options: { id: T; label: ReactNode }[];
  value: T | undefined;
  onChange: (v: T) => void;
  label: string;
  className?: string;
}) {
  return (
    <div role="group" aria-label={label} className={cx("inline-flex flex-wrap gap-2", className)}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={value === o.id}
          onClick={() => onChange(o.id)}
          className="chip"
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Change against an earlier period as a pill: "+12%" up, "−8%" down. Rising is green and falling red
 * unless `invert` (for counts where fewer is better). With no earlier figure it reads "Nothing before".
 */
export function Delta({ now, prev, invert = false, onDark = false }: { now: number; prev: number; invert?: boolean; onDark?: boolean }) {
  const pct = pctChange(now, prev);
  const up = pct === null ? now > 0 : pct > 0;
  const flat = pct === 0 || (pct === null && now === 0);
  const good = flat ? null : up !== invert;
  const Icon = flat ? null : up ? TrendingUp : TrendingDown;
  const text = pct === null ? (now === 0 ? "0%" : "Nothing before") : `${pct > 0 ? "+" : pct < 0 ? "−" : ""}${Math.abs(pct)}%`;
  return (
    <span
      className={cx(
        "inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-caption font-semibold whitespace-nowrap",
        good === null ? (onDark ? "bg-white/10 text-white/80" : "bg-sunk text-ink-2") : good ? (onDark ? "bg-good/25 text-[#7fd8a7]" : "bg-good-bg text-good") : onDark ? "bg-bad/30 text-[#ff9c94]" : "bg-bad-bg text-bad",
      )}
    >
      {text}
      {Icon && <Icon size={15} strokeWidth={2.4} aria-hidden />}
    </span>
  );
}

/**
 * A figure card: icon tile, label, big value, and a footer line (usually a Delta and what it compares to).
 * `dark` makes it the black highlight card. With `href` the whole card is the link, so there is no small
 * target to hunt for, and it says where it goes.
 */
export function Stat({
  icon,
  label,
  value,
  foot,
  dark = false,
  tone = "brand",
  href,
  className,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  foot?: ReactNode;
  dark?: boolean;
  tone?: "brand" | "bad" | "ink";
  href?: string;
  className?: string;
}) {
  const tile = dark ? "bg-white/10 text-white" : tone === "bad" ? "bg-bad-bg text-bad" : tone === "ink" ? "bg-sunk text-ink" : "bg-brand-bg text-brand";
  const body = (
    <>
      <div className="flex items-center gap-3">
        <span className={cx("grid h-11 w-11 shrink-0 place-items-center rounded-full", tile)} aria-hidden>
          {icon}
        </span>
        <span className={cx("min-w-0 text-lead font-semibold", dark ? "text-white" : "text-ink")}>{label}</span>
      </div>
      <div className="display mt-4 truncate text-figure font-semibold xl:text-hero">{value}</div>
      {foot && <div className={cx("mt-3 flex flex-wrap items-center gap-2 text-small", dark ? "text-white/85" : "text-ink-2")}>{foot}</div>}
      {href && (
        <span className={cx("mt-auto flex items-center gap-1 pt-4 text-small font-semibold", dark ? "text-white" : "text-brand")}>
          See details <ArrowUpRight size={16} aria-hidden />
        </span>
      )}
    </>
  );
  const box = cx("relative flex min-w-0 flex-col rounded-2xl border p-5 shadow-card sm:p-6", dark ? "border-ink bg-ink text-white" : "border-line/70 bg-panel", className);
  return href ? (
    <Link href={href} className={cx(box, "transition-shadow hover:shadow-lg", dark ? "hover:bg-ink-hover" : "hover:border-line-2")}>
      {body}
    </Link>
  ) : (
    <section className={box}>{body}</section>
  );
}

type Tone = "neutral" | "good" | "warn" | "bad" | "accent" | "ink";

const toneClass: Record<Tone, string> = {
  neutral: "bg-sunk text-ink-2 border-line",
  good: "bg-good-bg text-good border-good/25",
  warn: "bg-warn-bg text-warn border-warn/25",
  bad: "bg-bad-bg text-bad border-bad/25",
  accent: "bg-accent-bg text-accent border-accent/25",
  ink: "bg-ink text-white border-ink",
};

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cx(
        "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-caption font-semibold whitespace-nowrap",
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
  EN_ROUTE: "accent",
  ARRIVED: "accent",
  DELIVERED: "good",
  EXCEPTION: "bad",
};

export function StatusPill({ status }: { status: DeliveryStatus }) {
  const Icon = STATUS_ICON[status];
  return (
    <Badge tone={STATUS_TONE[status]}>
      <Icon size={15} strokeWidth={2.4} aria-hidden />
      {STATUS_LABEL[status]}
    </Badge>
  );
}

export function ZoneTag({ zone, temp = true }: { zone: ZoneId; temp?: boolean }) {
  const z = ZONES[zone];
  return (
    <span className="inline-flex items-center gap-2 text-small whitespace-nowrap text-ink-2">
      <span className="h-3 w-3 rounded-[3px]" style={{ background: z.color }} aria-hidden />
      {z.name}
      {temp && <span className="text-ink-3">{tempBare(z.setPointC, 0)}</span>}
    </span>
  );
}

/** Whether a lot can be sold: QA hold, still blast freezing (with when it is ready), or sellable. */
export function LotBadge({ lot, now, sellable = "Sellable" }: { lot: Lot; now: number; sellable?: string }) {
  if (lot.status === "HOLD") return <Badge tone="bad">On hold (quality check)</Badge>;
  if (!isFreezing(lot)) return <Badge>{sellable}</Badge>;
  const at = readyAt(lot);
  if (at <= now) return <Badge tone="warn">Frozen, move to freezer</Badge>;
  return <Badge tone="accent">Freezing, ready {startOfDay(at) === startOfDay(now) ? clock(at) : dateTime(at)}</Badge>;
}

/**
 * Overlays render at the end of <body>. Inside a page they would sit in the stacking context of a sticky
 * panel, under the header and under positioned parts of the page next to it.
 */
const toBody = (node: ReactNode) => (typeof document === "undefined" ? node : createPortal(node, document.body));

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
  // Parents pass a new onClose on every render (and the store ticks every 30 s), so keep it in a ref:
  // the effect below runs once per opening and never pulls focus back to the first field mid-typing.
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const first = ref.current?.querySelector<HTMLElement>("[autofocus], input, select, textarea, button:not([data-close])");
    first?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close.current();
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      prev?.focus?.();
    };
  }, [open]);
  if (!open) return null;
  return toBody(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/45 p-4 pt-[8vh]" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        className="rise w-full rounded-xl border border-line bg-panel shadow-[0_24px_60px_-20px_rgba(15,37,52,0.45)]"
        style={{ maxWidth: width }}
      >
        <div className="flex items-center justify-between gap-3 border-b border-line px-6 py-4">
          <h2 className="display text-heading font-semibold">{title}</h2>
          <button className="btn btn-quiet btn-sm" onClick={onClose} data-close>
            <X size={20} aria-hidden /> Close
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-6 py-5 scroll-thin">{children}</div>
        {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-6 py-4">{footer}</div>}
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
  return toBody(
    <div className="fixed inset-0 z-40 flex justify-end bg-ink/30" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside role="dialog" aria-modal="true" className="rise flex h-full w-full max-w-[700px] flex-col border-l border-line bg-panel shadow-[-20px_0_50px_-30px_rgba(15,37,52,0.5)]">
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h2 className="display text-heading leading-tight font-semibold">{title}</h2>
            {sub && <div className="mt-1 text-body text-ink-2">{sub}</div>}
          </div>
          <button className="btn btn-quiet btn-sm" onClick={onClose}>
            <X size={20} aria-hidden /> Close
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
            "relative -mb-px flex h-12 cursor-pointer items-center gap-2 border-b-[3px] px-4 text-body font-semibold whitespace-nowrap",
            value === t.id ? "border-brand text-ink" : "border-transparent text-ink-2 hover:text-ink",
          )}
        >
          {t.label}
          {t.count !== undefined && (
            <span className={cx("rounded-full px-2 text-caption", value === t.id ? "bg-ink text-white" : "bg-sunk text-ink-2")}>{t.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

/** Previous / Next under a long list, with "Page 2 of 5". Pages are counted from 0. */
export function Pager({ page, pages, onChange }: { page: number; pages: number; onChange: (page: number) => void }) {
  if (pages <= 1) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-4 sm:px-6">
      <div className="flex gap-2">
        <button className="btn btn-ghost" onClick={() => onChange(page - 1)} disabled={page === 0}>
          <ChevronLeft size={20} aria-hidden /> Previous
        </button>
        <button className="btn btn-ghost" onClick={() => onChange(page + 1)} disabled={page >= pages - 1}>
          Next <ChevronRight size={20} aria-hidden />
        </button>
      </div>
      <span className="text-body text-ink-2">
        Page {page + 1} of {pages}
      </span>
    </div>
  );
}

export function Field({ label, hint, children, className }: { label: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cx("block", className)}>
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block hint">{hint}</span>}
    </label>
  );
}

/** Stock level against reorder point and par: the bar fills to on-hand, ticks mark the thresholds. */
export function LevelBar({ value, reorder, par, width = 96 }: { value: number; reorder: number; par: number; width?: number }) {
  const max = Math.max(par * 1.15, value, 1);
  const pct = (n: number) => `${Math.min(100, (n / max) * 100)}%`;
  const tone = value <= 0 ? "var(--color-bad)" : value < reorder ? "var(--color-warn)" : "var(--color-ink-2)";
  return (
    <span className="relative inline-block h-2 rounded-full bg-sunk align-middle" style={{ width }} title={`Available ${value}, make more under ${reorder}, fill up to ${par}`}>
      <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: pct(value), background: tone }} />
      <span className="absolute -top-0.5 h-3 w-px bg-warn" style={{ left: pct(reorder) }} />
      <span className="absolute -top-0.5 h-3 w-px bg-ink-3" style={{ left: pct(par) }} />
    </span>
  );
}

export function Signature({ value, className }: { value?: string; className?: string }) {
  if (!value) return <span className="text-caption text-ink-3">No signature</span>;
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
      <p className="text-lead font-semibold">{title}</p>
      {children && <div className="text-body text-ink-2">{children}</div>}
    </div>
  );
}

/** `aboveNav` lifts toasts over the phone bottom navigation. */
export function Toaster({ aboveNav = false }: { aboveNav?: boolean }) {
  const toasts = useUi((s) => s.toasts);
  return (
    <div
      className={cx("pointer-events-none fixed right-4 z-[60] flex flex-col items-end gap-2", aboveNav ? "bottom-[calc(76px+env(safe-area-inset-bottom))] lg:bottom-4" : "bottom-4")}
      aria-live="polite"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cx(
            "rise pointer-events-auto max-w-sm rounded-xl border px-5 py-3.5 text-body font-semibold shadow-lg",
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
  return <kbd className="rounded border border-line-2 bg-white px-1 font-mono text-caption text-ink-2">{children}</kbd>;
}
