"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { clock, tempBare } from "@/lib/format";
import type { TempReading } from "@/lib/types";

export function useWidth(ref: RefObject<HTMLElement | null>, fallback = 600) {
  const [w, setW] = useState(fallback);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(120, Math.round(e.contentRect.width))));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}

export function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}

/** Bar with a 4px rounded data-end, square to the baseline. */
export function barPath(x: number, y: number, w: number, h: number) {
  const r = Math.min(4, w / 2, h);
  return `M${x} ${y + h}V${y + r}Q${x} ${y} ${x + r} ${y}H${x + w - r}Q${x + w} ${y} ${x + w} ${y + r}V${y + h}Z`;
}

export function Tip({ x, y, children, width }: { x: number; y: number; children: React.ReactNode; width: number }) {
  const left = Math.min(Math.max(x, 70), width - 70);
  return (
    <div
      className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg border border-line bg-white px-3 py-2 text-small whitespace-nowrap shadow-md"
      style={{ left, top: y - 8 }}
    >
      {children}
    </div>
  );
}

export function DailyBars({
  data,
  height = 190,
  format,
  highlightLast = true,
}: {
  data: { label: string; sub?: string; value: number; note?: string }[];
  height?: number;
  format: (n: number) => string;
  highlightLast?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const w = useWidth(ref);
  const [hover, setHover] = useState<number | null>(null);
  const pad = { l: 60, r: 6, t: 12, b: 30 };
  const iw = w - pad.l - pad.r;
  const ih = height - pad.t - pad.b;
  const step = niceMax(Math.max(...data.map((d) => d.value), 1) / 4);
  const max = step * 4;
  const band = iw / Math.max(1, data.length);
  const bw = Math.max(4, band * 0.62);
  const y = (v: number) => pad.t + ih - (v / max) * ih;
  const ticks = [0, 1, 2, 3, 4].map((k) => k * step);

  return (
    <div ref={ref} className="relative w-full" onMouseLeave={() => setHover(null)}>
      <svg width={w} height={height} role="img" aria-label="Sales by day">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={w - pad.r} y1={y(t)} y2={y(t)} stroke="var(--color-line)" strokeDasharray={t === 0 ? undefined : "2 4"} />
            <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" fontSize={14} fill="var(--color-ink-3)">
              {format(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = pad.l + i * band + (band - bw) / 2;
          const h = Math.max(0, pad.t + ih - y(d.value));
          const last = highlightLast && i === data.length - 1;
          return (
            <g key={i} onMouseEnter={() => setHover(i)}>
              <rect x={pad.l + i * band} y={pad.t} width={band} height={ih + pad.b} fill="transparent" />
              {d.value > 0 && (
                <path
                  d={barPath(x, y(d.value), bw, h)}
                  fill={last ? "var(--color-brand)" : "var(--color-brand-soft)"}
                  opacity={hover === null || hover === i ? 1 : 0.55}
                />
              )}
              <text x={x + bw / 2} y={height - 8} textAnchor="middle" fontSize={14} fill={last ? "var(--color-ink)" : "var(--color-ink-3)"} fontWeight={last ? 600 : 400}>
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
      {hover !== null && (
        <Tip x={pad.l + hover * band + band / 2} y={y(data[hover].value)} width={w}>
          <div className="font-semibold">{format(data[hover].value)}</div>
          <div className="text-ink-3">{data[hover].sub ?? data[hover].label}</div>
          {data[hover].note && <div className="text-ink-3">{data[hover].note}</div>}
        </Tip>
      )}
    </div>
  );
}

/**
 * Ref van temperature against the frozen limit. The trace turns red only where it crosses the limit,
 * so an excursion reads at a glance without a legend.
 */
export function TempTrace({
  temps,
  limit,
  marks = [],
  height = 200,
  start,
  end,
}: {
  temps: TempReading[];
  limit: number;
  marks?: { at: number; label: string }[];
  height?: number;
  start?: number;
  end?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const w = useWidth(ref);
  const [hover, setHover] = useState<number | null>(null);
  if (!temps.length)
    return (
      <div ref={ref} className="flex h-[120px] items-center justify-center rounded-md border border-dashed border-line text-small text-ink-3">
        No ref van readings yet. The log starts when the load goes on the truck.
      </div>
    );
  const pad = { l: 52, r: 12, t: marks.length ? 40 : 14, b: 28 };
  const iw = w - pad.l - pad.r;
  const ih = height - pad.t - pad.b;
  const t0 = start ?? temps[0].at;
  const t1 = Math.max(end ?? temps.at(-1)!.at, t0 + 60_000);
  const fs = temps.map((t) => t.c);
  const lo = Math.floor(Math.min(...fs, limit - 14) / 5) * 5;
  const hi = Math.ceil(Math.max(...fs, limit + 6) / 5) * 5;
  const x = (ts: number) => pad.l + ((ts - t0) / (t1 - t0)) * iw;
  const y = (f: number) => pad.t + (1 - (f - lo) / (hi - lo)) * ih;
  const d = temps.map((t, i) => `${i ? "L" : "M"}${x(t.at).toFixed(1)} ${y(t.c).toFixed(1)}`).join("");
  const ticks: number[] = [];
  for (let v = lo; v <= hi; v += 5) ticks.push(v);
  const hours: number[] = [];
  const h0 = new Date(t0);
  h0.setMinutes(0, 0, 0);
  const span = t1 - t0;
  const stepH = span > 8 * 3_600_000 ? 2 : 1;
  for (let t = h0.getTime() + 3_600_000; t < t1; t += stepH * 3_600_000) hours.push(t);
  const clipId = `above-${Math.round(t0)}-${limit}`;
  const peak = temps.reduce((m, t) => (t.c > m.c ? t : m), temps[0]);
  const over = peak.c > limit;

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const ts = t0 + ((mx - pad.l) / iw) * (t1 - t0);
    let best = 0;
    for (let i = 1; i < temps.length; i++) if (Math.abs(temps[i].at - ts) < Math.abs(temps[best].at - ts)) best = i;
    setHover(best);
  }

  return (
    <div ref={ref} className="relative w-full">
      <svg width={w} height={height} role="img" aria-label={`Ref van temperature, peak ${tempBare(peak.c)}C`} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        <defs>
          <clipPath id={clipId}>
            <rect x={0} y={0} width={w} height={y(limit)} />
          </clipPath>
        </defs>
        <rect x={pad.l} y={pad.t} width={iw} height={Math.max(0, y(limit) - pad.t)} fill="var(--color-bad-bg)" opacity={0.6} />
        {ticks.map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={w - pad.r} y1={y(v)} y2={y(v)} stroke="var(--color-line)" strokeDasharray={v === limit ? undefined : "2 4"} />
            <text x={pad.l - 8} y={y(v) + 4} textAnchor="end" fontSize={14} fill="var(--color-ink-3)">
              {tempBare(v, 0)}
            </text>
          </g>
        ))}
        <line x1={pad.l} x2={w - pad.r} y1={y(limit)} y2={y(limit)} stroke="var(--color-bad)" strokeWidth={1.25} />
        <text x={pad.l + 6} y={y(limit) - 6} fontSize={14} fill="var(--color-bad)" fontWeight={600} stroke="var(--color-panel)" strokeWidth={3} paintOrder="stroke">
          {tempBare(limit, 0)}C limit
        </text>
        {hours.map((t) => (
          <text key={t} x={x(t)} y={height - 6} textAnchor="middle" fontSize={14} fill="var(--color-ink-3)">
            {new Date(t).toLocaleTimeString("en-US", { hour: "numeric" })}
          </text>
        ))}
        {marks.map((m, i) => {
          // Labels that would collide with the previous one drop to a second row.
          const row = i > 0 && Math.abs(x(m.at) - x(marks[i - 1].at)) < 64 && i % 2 === 1 ? 1 : 0;
          return (
            <g key={i}>
              <line x1={x(m.at)} x2={x(m.at)} y1={pad.t - 4 - row * 14} y2={pad.t + ih} stroke="var(--color-ink-3)" strokeDasharray="1 3" />
              <text x={x(m.at)} y={pad.t - 9 - row * 16} textAnchor={x(m.at) > w - 70 ? "end" : x(m.at) < pad.l + 40 ? "start" : "middle"} fontSize={14} fill="var(--color-ink-2)" fontWeight={600}>
                {m.label}
              </text>
            </g>
          );
        })}
        <path d={d} fill="none" stroke="var(--color-ink-2)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        <path d={d} fill="none" stroke="var(--color-bad)" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" clipPath={`url(#${clipId})`} />
        {over && <circle cx={x(peak.at)} cy={y(peak.c)} r={4.5} fill="var(--color-bad)" stroke="var(--color-panel)" strokeWidth={2} />}
        {hover !== null && (
          <g>
            <line x1={x(temps[hover].at)} x2={x(temps[hover].at)} y1={pad.t} y2={pad.t + ih} stroke="var(--color-ink)" strokeOpacity={0.35} />
            <circle cx={x(temps[hover].at)} cy={y(temps[hover].c)} r={4.5} fill="var(--color-ink)" stroke="var(--color-panel)" strokeWidth={2} />
          </g>
        )}
      </svg>
      {hover !== null && (
        <Tip x={x(temps[hover].at)} y={y(temps[hover].c)} width={w}>
          <span className={temps[hover].c > limit ? "font-semibold text-bad" : "font-semibold"}>{tempBare(temps[hover].c)}C</span>
          <span className="ml-2 text-ink-3">{clock(temps[hover].at)}</span>
        </Tip>
      )}
    </div>
  );
}
