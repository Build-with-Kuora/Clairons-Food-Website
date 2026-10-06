"use client";

import { useRef, useState, type ReactNode } from "react";
import { Tip, barPath, niceMax, useWidth } from "./charts";

/** Smooth path through points (Catmull-Rom as cubic Béziers), so a trend reads as a line, not a staircase. */
function smooth(pts: { x: number; y: number }[]) {
  if (pts.length < 2) return pts.length ? `M${pts[0].x} ${pts[0].y}` : "";
  let d = `M${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += `C${c1.x.toFixed(1)} ${c1.y.toFixed(1)} ${c2.x.toFixed(1)} ${c2.y.toFixed(1)} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

/** One series over time as a red line with a soft fill, a hover guide and a tooltip. */
export function AreaTrend({
  data,
  height = 240,
  format,
  label = "Sales by day",
}: {
  data: { label: string; sub?: string; value: number; note?: string }[];
  height?: number;
  format: (n: number) => string;
  label?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const w = useWidth(ref);
  const [hover, setHover] = useState<number | null>(null);
  const pad = { l: 56, r: 14, t: 16, b: 30 };
  const iw = w - pad.l - pad.r;
  const ih = height - pad.t - pad.b;
  const step = niceMax(Math.max(...data.map((d) => d.value), 1) / 4);
  const max = step * 4;
  const x = (i: number) => pad.l + (data.length < 2 ? iw / 2 : (i / (data.length - 1)) * iw);
  const y = (v: number) => pad.t + ih - (v / max) * ih;
  const pts = data.map((d, i) => ({ x: x(i), y: y(d.value) }));
  const line = smooth(pts);
  const base = pad.t + ih;
  const area = pts.length ? `${line}L${pts.at(-1)!.x} ${base}L${pts[0].x} ${base}Z` : "";
  const every = Math.max(1, Math.ceil(data.length / Math.max(2, Math.floor(iw / 56))));
  const gid = `area-${data.length}-${Math.round(max)}`;

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const i = Math.round(((e.clientX - rect.left - pad.l) / iw) * (data.length - 1));
    setHover(Math.min(data.length - 1, Math.max(0, i)));
  }

  return (
    <div ref={ref} className="relative w-full">
      <svg width={w} height={height} role="img" aria-label={label} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-brand)" stopOpacity={0.22} />
            <stop offset="100%" stopColor="var(--color-brand)" stopOpacity={0} />
          </linearGradient>
          <clipPath id={`${gid}-clip`}>
            <rect x={0} y={0} width={w} height={base} />
          </clipPath>
        </defs>
        {[0, 1, 2, 3, 4].map((k) => (
          <g key={k}>
            <line x1={pad.l} x2={w - pad.r} y1={y(k * step)} y2={y(k * step)} stroke="var(--color-line)" strokeDasharray={k === 0 ? undefined : "2 5"} />
            <text x={pad.l - 10} y={y(k * step) + 4} textAnchor="end" fontSize={12} fill="var(--color-ink-3)">
              {format(k * step)}
            </text>
          </g>
        ))}
        <g clipPath={`url(#${gid}-clip)`}>
          <path d={area} fill={`url(#${gid})`} />
          <path d={line} fill="none" stroke="var(--color-brand)" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        </g>
        {data.map((d, i) =>
          i % every === 0 || i === data.length - 1 ? (
            <text key={i} x={x(i)} y={height - 8} textAnchor="middle" fontSize={12} fill={hover === i ? "var(--color-ink)" : "var(--color-ink-3)"} fontWeight={hover === i ? 600 : 400}>
              {d.label}
            </text>
          ) : null,
        )}
        {hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={base} stroke="var(--color-ink)" strokeOpacity={0.35} strokeDasharray="3 3" />
            <circle cx={x(hover)} cy={y(data[hover].value)} r={5} fill="var(--color-brand)" stroke="var(--color-panel)" strokeWidth={2.5} />
          </g>
        )}
      </svg>
      {hover !== null && (
        <Tip x={x(hover)} y={y(data[hover].value)} width={w}>
          <div className="font-semibold">{format(data[hover].value)}</div>
          <div className="text-ink-3">{data[hover].sub ?? data[hover].label}</div>
          {data[hover].note && <div className="text-ink-3">{data[hover].note}</div>}
        </Tip>
      )}
    </div>
  );
}

/** A ring split into parts, with something in the middle. Parts carry their own color. */
export function Donut({
  parts,
  size = 168,
  thickness = 22,
  children,
  label,
}: {
  parts: { value: number; color: string; label: string }[];
  size?: number;
  thickness?: number;
  children?: ReactNode;
  label: string;
}) {
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const total = parts.reduce((s, p) => s + p.value, 0);
  const gap = parts.filter((p) => p.value > 0).length > 1 ? 3 : 0;
  const starts = parts.reduce<number[]>((acc, p, i) => [...acc, i === 0 ? 0 : acc[i - 1] + (parts[i - 1].value / (total || 1)) * c], []);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-sunk)" strokeWidth={thickness} />
        {total > 0 &&
          parts.map((p, i) =>
            p.value > 0 ? (
              <circle
                key={p.label}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={p.color}
                strokeWidth={thickness}
                strokeDasharray={`${Math.max(0, (p.value / total) * c - gap)} ${c}`}
                strokeDashoffset={-starts[i]}
              />
            ) : null,
          )}
      </svg>
      {children && <div className="absolute inset-0 grid place-items-center text-center">{children}</div>}
    </div>
  );
}

/** Concentric arcs, one per item, each as long as its share of the largest. For a handful of categories. */
export function Rings({ items, size = 190, label, children }: { items: { value: number; color: string; label: string }[]; size?: number; label: string; children?: ReactNode }) {
  const thickness = 11;
  const gap = 6;
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label} className="-rotate-90">
        {items.map((it, i) => {
          const r = size / 2 - thickness / 2 - i * (thickness + gap);
          if (r <= thickness) return null;
          const c = 2 * Math.PI * r;
          // Three quarters of a turn is the longest arc.
          const full = c * 0.75;
          return (
            <g key={it.label}>
              <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-sunk)" strokeWidth={thickness} strokeDasharray={`${full} ${c}`} strokeLinecap="round" />
              {it.value > 0 && (
                <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={it.color} strokeWidth={thickness} strokeDasharray={`${(it.value / max) * full} ${c}`} strokeLinecap="round" />
              )}
            </g>
          );
        })}
      </svg>
      {children && <div className="absolute inset-0 grid place-items-center text-center">{children}</div>}
    </div>
  );
}

/** Two series side by side per period (e.g. walk-in and delivery), with a shared tooltip. */
export function PairedBars({
  data,
  names,
  height = 240,
  format,
}: {
  data: { label: string; sub?: string; a: number; b: number }[];
  names: [string, string];
  height?: number;
  format: (n: number) => string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const w = useWidth(ref);
  const [hover, setHover] = useState<number | null>(null);
  const pad = { l: 56, r: 6, t: 14, b: 28 };
  const iw = w - pad.l - pad.r;
  const ih = height - pad.t - pad.b;
  const step = niceMax(Math.max(...data.flatMap((d) => [d.a, d.b]), 1) / 4);
  const max = step * 4;
  const band = iw / Math.max(1, data.length);
  const bw = Math.max(3, Math.min(18, band * 0.3));
  const y = (v: number) => pad.t + ih - (v / max) * ih;
  const every = Math.max(1, Math.ceil(data.length / Math.max(2, Math.floor(iw / 44))));

  return (
    <div ref={ref} className="relative w-full" onMouseLeave={() => setHover(null)}>
      <svg width={w} height={height} role="img" aria-label={`${names[0]} and ${names[1]} by period`}>
        {[0, 1, 2, 3, 4].map((k) => (
          <g key={k}>
            <line x1={pad.l} x2={w - pad.r} y1={y(k * step)} y2={y(k * step)} stroke="var(--color-line)" strokeDasharray={k === 0 ? undefined : "2 5"} />
            <text x={pad.l - 10} y={y(k * step) + 4} textAnchor="end" fontSize={12} fill="var(--color-ink-3)">
              {format(k * step)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const mid = pad.l + i * band + band / 2;
          const dim = hover !== null && hover !== i ? 0.45 : 1;
          return (
            <g key={i} onMouseEnter={() => setHover(i)}>
              <rect x={pad.l + i * band} y={pad.t} width={band} height={ih + pad.b} fill="transparent" />
              {d.a > 0 && <path d={barPath(mid - bw - 1.5, y(d.a), bw, pad.t + ih - y(d.a))} fill="var(--color-brand)" opacity={dim} />}
              {d.b > 0 && <path d={barPath(mid + 1.5, y(d.b), bw, pad.t + ih - y(d.b))} fill="var(--color-ink)" opacity={dim} />}
              {(i % every === 0 || i === data.length - 1) && (
                <text x={mid} y={height - 8} textAnchor="middle" fontSize={12} fill="var(--color-ink-3)">
                  {d.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {hover !== null && (
        <Tip x={pad.l + hover * band + band / 2} y={y(Math.max(data[hover].a, data[hover].b))} width={w}>
          <div className="mb-0.5 text-ink-3">{data[hover].sub ?? data[hover].label}</div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-brand" /> {names[0]} <span className="ml-auto pl-3 font-semibold">{format(data[hover].a)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-ink" /> {names[1]} <span className="ml-auto pl-3 font-semibold">{format(data[hover].b)}</span>
          </div>
        </Tip>
      )}
    </div>
  );
}
